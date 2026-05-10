-- ─── Synchronisation hors ligne ──────────────────────────────────────────────
--
-- RPC idempotente pour synchroniser les parties jouées sans connexion.
--
-- GARANTIE D'IDEMPOTENCE :
--   INSERT … ON CONFLICT DO NOTHING sur game_history (UNIQUE user_id, date).
--   → La mise à jour du profil n'a lieu QUE si la ligne était absente.
--   → Si le chemin en ligne a déjà inséré la ligne, le profil n'est PAS
--     mis à jour une seconde fois : zéro risque de double-comptage.
--
-- À exécuter dans le SQL Editor de Supabase.

CREATE OR REPLACE FUNCTION public.sync_offline_result(
  p_date       DATE,
  p_won        BOOLEAN,
  p_attempts   INTEGER,
  p_score      INTEGER,
  p_coins      INTEGER,
  p_new_serie  INTEGER
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted INTEGER;
BEGIN
  -- Tentative d'insertion (DO NOTHING si la date existe déjà)
  INSERT INTO game_history(user_id, date, won, attempts, score, coins_earned)
  VALUES (auth.uid(), p_date, p_won, p_attempts, p_score, p_coins)
  ON CONFLICT (user_id, date) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  -- Mise à jour du profil UNIQUEMENT si la ligne était nouvelle
  IF v_inserted = 1 THEN
    UPDATE profiles
    SET
      score_total     = score_total + p_score,
      parties_jouees  = parties_jouees + 1,
      parties_gagnees = parties_gagnees + (CASE WHEN p_won THEN 1 ELSE 0 END),
      coins           = coins + p_coins,
      serie_actuelle  = CASE WHEN p_won THEN p_new_serie ELSE 0 END,
      meilleure_serie = GREATEST(
                          meilleure_serie,
                          CASE WHEN p_won THEN p_new_serie ELSE 0 END
                        ),
      updated_at      = now()
    WHERE id = auth.uid();
  END IF;
END;
$$;

GRANT EXECUTE
  ON FUNCTION public.sync_offline_result(DATE, BOOLEAN, INTEGER, INTEGER, INTEGER, INTEGER)
  TO authenticated;
