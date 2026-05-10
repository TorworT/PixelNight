-- ══════════════════════════════════════════════════════════════════════════════
-- PixelNight — referral.sql
-- Système de parrainage : codes uniques auto-générés, crédits mutuels +50🪙
--
-- À exécuter dans Supabase Dashboard → SQL Editor → New query
-- ══════════════════════════════════════════════════════════════════════════════

-- ─── 1. COLONNES SUR PROFILES ─────────────────────────────────────────────────

-- Code unique du joueur (8 chars alphanum majuscule, auto-généré à l'inscription)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;

-- UUID du parrain (NULL si non parrainé)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Index de recherche rapide par code
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_referral_code
  ON public.profiles (referral_code)
  WHERE referral_code IS NOT NULL;

-- ─── 2. GÉNÉRATION D'UN CODE UNIQUE ──────────────────────────────────────────
-- Alphabet sans O/0/I/1 pour éviter la confusion visuelle (32 chars).

CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  chars    TEXT    := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code     TEXT    := '';
  i        INT;
  occupied BOOLEAN;
BEGIN
  LOOP
    code := '';
    FOR i IN 1..8 LOOP
      code := code || substr(chars, (floor(random() * length(chars)) + 1)::int, 1);
    END LOOP;
    -- Garantit l'unicité (collision extrêmement rare mais gérée proprement)
    SELECT EXISTS(SELECT 1 FROM public.profiles WHERE referral_code = code)
      INTO occupied;
    EXIT WHEN NOT occupied;
  END LOOP;
  RETURN code;
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_referral_code() TO authenticated;

-- ─── 3. MISE À JOUR DU TRIGGER handle_new_user ────────────────────────────────
-- Remplace la version de profiles.sql pour :
--   a) Générer un referral_code unique à chaque inscription
--   b) Appliquer automatiquement un code de parrainage passé dans les métadonnées

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ref_code    TEXT;
  v_referrer_id UUID;
BEGIN
  -- Insère le profil avec le code de parrainage auto-généré
  INSERT INTO public.profiles (id, pseudo, referral_code)
  VALUES (
    NEW.id,
    COALESCE(
      NULLIF(TRIM(NEW.raw_user_meta_data->>'pseudo'), ''),
      split_part(NEW.email, '@', 1)
    ),
    public.generate_referral_code()
  )
  ON CONFLICT (id) DO NOTHING;

  -- Tente d'appliquer le code de parrainage passé dans les métadonnées (si présent)
  v_ref_code := UPPER(TRIM(COALESCE(NEW.raw_user_meta_data->>'referral_code', '')));

  IF v_ref_code <> '' THEN
    SELECT id INTO v_referrer_id
      FROM public.profiles
     WHERE referral_code = v_ref_code
       AND id <> NEW.id;

    IF FOUND THEN
      -- Crédite le nouveau joueur (+50 pièces + enregistre le parrain)
      UPDATE public.profiles
         SET coins       = coins + 50,
             referred_by = v_referrer_id
       WHERE id = NEW.id;

      -- Crédite le parrain (+50 pièces)
      UPDATE public.profiles
         SET coins = coins + 50
       WHERE id = v_referrer_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Le trigger existant est déjà attaché (défini dans profiles.sql) —
-- aucun DROP/CREATE TRIGGER nécessaire, on remplace juste la fonction.

-- ─── 4. APPLY_REFERRAL RPC (application post-inscription) ────────────────────
-- Permet à un joueur connecté d'appliquer un code APRÈS son inscription.
-- Retourne un objet JSON { success: bool, error?: string }.

CREATE OR REPLACE FUNCTION public.apply_referral(p_code text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id   UUID;
  v_referrer_id UUID;
BEGIN
  v_caller_id := auth.uid();

  IF v_caller_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  -- Vérifie que le joueur n'a pas déjà été parrainé
  IF EXISTS (
    SELECT 1 FROM public.profiles
     WHERE id = v_caller_id AND referred_by IS NOT NULL
  ) THEN
    RETURN json_build_object('success', false, 'error', 'already_referred');
  END IF;

  -- Vérifie que le joueur n'utilise pas son propre code
  IF EXISTS (
    SELECT 1 FROM public.profiles
     WHERE id = v_caller_id AND referral_code = UPPER(TRIM(p_code))
  ) THEN
    RETURN json_build_object('success', false, 'error', 'own_code');
  END IF;

  -- Trouve le parrain
  SELECT id INTO v_referrer_id
    FROM public.profiles
   WHERE referral_code = UPPER(TRIM(p_code));

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'invalid_code');
  END IF;

  -- Crédite le filleul
  UPDATE public.profiles
     SET coins       = coins + 50,
         referred_by = v_referrer_id
   WHERE id = v_caller_id;

  -- Crédite le parrain
  UPDATE public.profiles
     SET coins = coins + 50
   WHERE id = v_referrer_id;

  RETURN json_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_referral(text) TO authenticated;

-- ─── 5. ENSURE_REFERRAL_CODE RPC ─────────────────────────────────────────────
-- Utilisé par le client quand referral_code est NULL sur un profil existant.
-- Génère le code (ou le retourne s'il existe déjà) — idempotent et thread-safe.
-- Le code est dérivé de l'UUID du joueur (MD5) pour être déterministe tout en
-- restant unique à 16^8 ≈ 4,3 milliards de possibilités.

CREATE OR REPLACE FUNCTION public.ensure_referral_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid  UUID;
  v_code TEXT;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RETURN NULL; END IF;

  -- Retourne le code existant immédiatement s'il est déjà défini
  SELECT referral_code INTO v_code
    FROM public.profiles
   WHERE id = v_uid;

  IF v_code IS NOT NULL THEN
    RETURN v_code;
  END IF;

  -- Génère un code déterministe à partir de l'UUID du joueur :
  --   MD5(uuid) → 32 chars hex → garde les 8 premiers → majuscules
  -- Unicité garantie sauf collision MD5 tronquée (probabilité < 1/16^8 ≈ negligeable)
  v_code := UPPER(SUBSTRING(MD5(v_uid::TEXT) FROM 1 FOR 8));

  -- INSERT-or-skip atomique : si une autre session vient d'écrire, on lit simplement
  UPDATE public.profiles
     SET referral_code = v_code
   WHERE id = v_uid
     AND referral_code IS NULL;

  -- En cas de race condition (update 0 rows), on relit ce que l'autre session a écrit
  IF NOT FOUND THEN
    SELECT referral_code INTO v_code
      FROM public.profiles
     WHERE id = v_uid;
  END IF;

  RETURN v_code;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_referral_code() TO authenticated;

-- ─── 6. PATCHER LES PROFILS EXISTANTS (backfill referral_code) ────────────────
-- Génère un code pour les profils créés avant cette migration.
-- Utilise MD5(id) pour cohérence avec ensure_referral_code().

UPDATE public.profiles
   SET referral_code = UPPER(SUBSTRING(MD5(id::TEXT) FROM 1 FOR 8))
 WHERE referral_code IS NULL;

-- ─── 7. VÉRIFICATION RAPIDE ───────────────────────────────────────────────────
-- SELECT id, pseudo, referral_code, referred_by FROM public.profiles LIMIT 10;
