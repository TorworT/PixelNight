-- ─────────────────────────────────────────────────────────────────────────────
-- Migration : bonus de fidélité pour les anciens inscrits
--
-- Contexte :
--   La migration 20240601_welcome_bonus.sql a ajouté welcome_bonus_claimed = false
--   pour TOUS les profils (colonne DEFAULT false). Les utilisateurs inscrits AVANT
--   cette feature doivent recevoir le bonus fidélité, pas le bonus de bienvenue.
--
-- Stratégie :
--   1. Ajoute loyalty_bonus_claimed boolean DEFAULT false.
--   2. Pour tous les comptes existants : welcome_bonus_claimed → true
--      (ils sautent le WelcomeModal et atterrissent sur le LoyaltyModal).
--   3. Crée claim_loyalty_bonus() : 100 pièces + 2×powerups + infini 48h.
--   4. Met à jour claim_welcome_bonus() : pose aussi loyalty_bonus_claimed = true
--      afin que les nouveaux inscrits n'aient jamais droit au bonus fidélité.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Colonne flag fidélité ─────────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS loyalty_bonus_claimed boolean NOT NULL DEFAULT false;

-- ── 2. Marquer tous les comptes existants comme ayant déjà reçu le welcome ──
--  Effet : welcome_bonus_claimed = true  → pas de WelcomeModal
--           loyalty_bonus_claimed = false → LoyaltyModal s'affiche une fois
UPDATE public.profiles
SET welcome_bonus_claimed = true
WHERE welcome_bonus_claimed = false;

-- ── 3. RPC claim_loyalty_bonus ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.claim_loyalty_bonus()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  -- Idempotent : refus si déjà réclamé
  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = v_uid AND loyalty_bonus_claimed = true
  ) THEN
    RAISE EXCEPTION 'loyalty_bonus_already_claimed';
  END IF;

  UPDATE public.profiles
  SET
    coins               = coins + 100,
    hint_letter         = hint_letter + 2,
    hint_zone           = hint_zone + 2,
    extra_life          = extra_life + 2,
    -- Étend infinite_until si déjà actif, sinon part de now()
    infinite_until      = GREATEST(COALESCE(infinite_until, NOW()), NOW()) + INTERVAL '48 hours',
    loyalty_bonus_claimed = true,
    updated_at          = NOW()
  WHERE id = v_uid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile_not_found';
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.claim_loyalty_bonus() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.claim_loyalty_bonus() TO authenticated;

-- ── 4. Mise à jour de claim_welcome_bonus ────────────────────────────────────
--  Les nouveaux inscrits posent loyalty_bonus_claimed = true en même temps
--  que welcome_bonus_claimed = true → ils n'auront jamais le LoyaltyModal.
CREATE OR REPLACE FUNCTION public.claim_welcome_bonus()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  -- Idempotent : refus si déjà réclamé
  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = v_uid AND welcome_bonus_claimed = true
  ) THEN
    RAISE EXCEPTION 'welcome_bonus_already_claimed';
  END IF;

  UPDATE public.profiles
  SET
    coins                  = coins + 50,
    hint_letter            = hint_letter + 1,
    hint_zone              = hint_zone + 1,
    extra_life             = extra_life + 1,
    infinite_until         = GREATEST(COALESCE(infinite_until, NOW()), NOW()) + INTERVAL '24 hours',
    welcome_bonus_claimed  = true,
    -- Nouveaux inscrits : pas de bonus fidélité
    loyalty_bonus_claimed  = true,
    updated_at             = NOW()
  WHERE id = v_uid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile_not_found';
  END IF;
END;
$$;

-- Les grants sont déjà en place depuis la migration précédente (CREATE OR REPLACE
-- ne les révoque pas), mais on les réapplique par sécurité.
REVOKE EXECUTE ON FUNCTION public.claim_welcome_bonus() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.claim_welcome_bonus() TO authenticated;
