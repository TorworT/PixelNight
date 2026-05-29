-- ─────────────────────────────────────────────────────────────────────────────
-- Migration : bonus de bienvenue
--
-- 1. Ajoute la colonne `welcome_bonus_claimed` sur la table profiles.
-- 2. Crée la fonction RPC `claim_welcome_bonus()` qui :
--    • Crédite 50 pièces
--    • Ajoute 1 hint_letter, 1 hint_zone, 1 extra_life
--    • Active le mode infini pour 24 h (infinite_until = now() + 24h)
--    • Pose welcome_bonus_claimed = true (idempotent : lève une exception si déjà réclamé)
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Colonne flag
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS welcome_bonus_claimed boolean NOT NULL DEFAULT false;

-- 2. RPC
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
    -- Si infinite_until est déjà dans le futur on l'étend, sinon on part de now()
    infinite_until         = GREATEST(COALESCE(infinite_until, NOW()), NOW()) + INTERVAL '24 hours',
    welcome_bonus_claimed  = true,
    updated_at             = NOW()
  WHERE id = v_uid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile_not_found';
  END IF;
END;
$$;

-- Révoque toute exécution publique, n'autorise que les utilisateurs authentifiés
REVOKE EXECUTE ON FUNCTION public.claim_welcome_bonus() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.claim_welcome_bonus() TO authenticated;
