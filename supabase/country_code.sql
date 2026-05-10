-- ══════════════════════════════════════════════════════════════════════════════
-- PixelNight — country_code.sql
-- Ajoute la colonne country_code à la table profiles et met à jour le trigger.
-- Exécute dans : Supabase Dashboard → SQL Editor → New query
-- ══════════════════════════════════════════════════════════════════════════════

-- ─── 1. COLONNE country_code ──────────────────────────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS country_code TEXT NOT NULL DEFAULT 'FR';

-- ─── 2. TRIGGER handle_new_user mis à jour ────────────────────────────────────
-- Lit country_code depuis raw_user_meta_data (passé via signUp({ data: { country_code } }))

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, pseudo, country_code)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'pseudo',
      split_part(NEW.email, '@', 1)
    ),
    COALESCE(
      NEW.raw_user_meta_data->>'country_code',
      'FR'
    )
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- ─── 3. VÉRIFICATION ──────────────────────────────────────────────────────────
-- SELECT id, pseudo, country_code FROM public.profiles LIMIT 5;
