-- ─────────────────────────────────────────────────────────────────────────────
-- Migration : Mode infini 24h
-- À exécuter UNE SEULE FOIS dans le Supabase SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

-- ① Ajouter la colonne au profil (idempotent)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS infinite_until TIMESTAMPTZ DEFAULT NULL;


-- ② Fonction RPC atomique --------------------------------------------------
--
--   Vérifie les coins, les déduit et active le mode infini pour 24 heures.
--   Si une session est déjà active, elle est prolongée de 24h depuis NOW().
--
--   Retour TIMESTAMPTZ : la nouvelle valeur de infinite_until.
--
--   Sécurité :
--     SECURITY DEFINER → bypasse RLS, seul auth.uid() cible la ligne.
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION activate_infinite_mode()
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid         UUID        := auth.uid();
  v_coins       INT;
  v_until       TIMESTAMPTZ;
  v_cost        CONSTANT INT := 900;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- Lire le solde actuel
  SELECT coins INTO v_coins
    FROM profiles
   WHERE id = v_uid;

  IF v_coins < v_cost THEN
    RAISE EXCEPTION 'insufficient_coins';
  END IF;

  -- Calculer la nouvelle expiration :
  --   Si déjà actif → prolonge de 24h depuis maintenant
  --   Sinon         → 24h depuis maintenant
  v_until := NOW() + INTERVAL '24 hours';

  -- Déduire les pièces et mettre à jour infinite_until (atomique)
  UPDATE profiles
     SET coins         = coins - v_cost,
         infinite_until = v_until,
         updated_at     = NOW()
   WHERE id = v_uid;

  RETURN v_until;
END;
$$;


-- ③ Accorder l'exécution aux utilisateurs authentifiés
GRANT EXECUTE ON FUNCTION activate_infinite_mode() TO authenticated;
