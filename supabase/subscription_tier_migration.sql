-- ─────────────────────────────────────────────────────────────────────────────
-- Migration : colonne subscription_tier dans profiles
-- À exécuter UNE SEULE FOIS dans le Supabase SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

-- ① Ajouter la colonne (idempotent)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS subscription_tier TEXT NOT NULL DEFAULT 'free'
  CHECK (subscription_tier IN ('free', 'basic', 'pro', 'legend'));


-- ② RPC de synchronisation du tier -------------------------------------------
--
--   Appelée côté client après chaque appel RevenueCat réussi.
--   Met à jour profiles.subscription_tier pour l'utilisateur connecté,
--   ce qui permet de l'afficher dans le classement.
--
--   SECURITY DEFINER : bypass RLS pour l'UPDATE (colonnes subscription_tier
--   uniquement) ; le ciblage par auth.uid() empêche toute élévation de privilèges.
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sync_subscription_tier(p_tier TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RETURN; END IF;

  -- Valider la valeur avant d'écrire (défense en profondeur)
  IF p_tier NOT IN ('free', 'basic', 'pro', 'legend') THEN
    RAISE EXCEPTION 'invalid_tier: %', p_tier;
  END IF;

  UPDATE profiles
     SET subscription_tier = p_tier,
         updated_at         = NOW()
   WHERE id = v_uid
     AND subscription_tier IS DISTINCT FROM p_tier; -- évite les writes inutiles
END;
$$;

GRANT EXECUTE ON FUNCTION sync_subscription_tier(TEXT) TO authenticated;
