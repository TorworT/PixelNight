-- ─────────────────────────────────────────────────────────────────────────────
-- Migration : Pièces quotidiennes par abonnement (Pro / Legend)
-- À exécuter UNE SEULE FOIS dans le Supabase SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

-- ① Ajouter la colonne de traçage au profil
-- (idempotent grâce à IF NOT EXISTS)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS daily_coins_claimed_at TIMESTAMPTZ;


-- ② Fonction RPC atomique --------------------------------------------------
--
--   Paramètres :
--     p_amount    INT   — nombre de pièces à créditer (déterminé côté client
--                         selon le tier RevenueCat : 20 pour Pro, 50 pour Legend)
--     p_game_date DATE  — « date jeu » du client (YYYY-MM-DD) calculée avec
--                         le pivot 7h de l'app. Garantit la cohérence avec
--                         le reset quotidien du jeu du jour.
--
--   Retour JSONB :
--     { "coins_awarded": <int>, "already_claimed": <bool> }
--
--   Sécurité :
--     SECURITY DEFINER → s'exécute avec les droits du propriétaire de la
--     fonction (postgres), bypasse RLS pour le SELECT/UPDATE sur profiles.
--     Seul auth.uid() est utilisé pour cibler la ligne — aucun risque de
--     manipulation par l'utilisateur.
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION claim_daily_coins(p_amount INT, p_game_date DATE)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid  UUID      := auth.uid();
  v_last TIMESTAMPTZ;
BEGIN
  -- Utilisateur non authentifié
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('coins_awarded', 0, 'already_claimed', true);
  END IF;

  -- Lire la date du dernier claim
  SELECT daily_coins_claimed_at
    INTO v_last
    FROM profiles
   WHERE id = v_uid;

  -- Déjà réclamé pour ce jour de jeu ?
  -- On compare la date UTC du dernier claim avec p_game_date.
  IF v_last IS NOT NULL
     AND v_last::DATE = p_game_date
  THEN
    RETURN jsonb_build_object('coins_awarded', 0, 'already_claimed', true);
  END IF;

  -- Créditer les pièces et horodater le claim (opération atomique)
  UPDATE profiles
     SET coins                  = coins + p_amount,
         daily_coins_claimed_at = NOW(),
         updated_at             = NOW()
   WHERE id = v_uid;

  RETURN jsonb_build_object('coins_awarded', p_amount, 'already_claimed', false);
END;
$$;


-- ③ Accorder l'exécution aux utilisateurs authentifiés
GRANT EXECUTE ON FUNCTION claim_daily_coins(INT, DATE) TO authenticated;
