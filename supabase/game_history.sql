-- ─── Historique des parties ──────────────────────────────────────────────────
-- Une ligne par joueur par jour (contrainte UNIQUE).
-- record_game_history : UPSERT atomique appelé à la fin de chaque partie.

-- 1. Table
CREATE TABLE IF NOT EXISTS public.game_history (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date         DATE        NOT NULL,
  won          BOOLEAN     NOT NULL DEFAULT false,
  attempts     INTEGER     NOT NULL DEFAULT 0,
  score        INTEGER     NOT NULL DEFAULT 0,
  coins_earned INTEGER     NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, date)
);

-- 2. RLS
ALTER TABLE public.game_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_own" ON public.game_history;
CREATE POLICY "allow_own" ON public.game_history
  FOR ALL
  USING     (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 3. Index perf
CREATE INDEX IF NOT EXISTS idx_game_history_user_date
  ON public.game_history(user_id, date DESC);

-- 4. RPC : record_game_history
--    UPSERT atomique : si le joueur avait déjà une entrée ce jour (ex: test),
--    on met à jour. En production, markScoreSubmitted() empêche le double appel.
CREATE OR REPLACE FUNCTION public.record_game_history(
  p_won      BOOLEAN,
  p_attempts INTEGER,
  p_score    INTEGER,
  p_coins    INTEGER
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO game_history(user_id, date, won, attempts, score, coins_earned)
  VALUES (auth.uid(), CURRENT_DATE, p_won, p_attempts, p_score, p_coins)
  ON CONFLICT (user_id, date) DO UPDATE
    SET won          = EXCLUDED.won,
        attempts     = EXCLUDED.attempts,
        score        = EXCLUDED.score,
        coins_earned = EXCLUDED.coins_earned;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_game_history(BOOLEAN, INTEGER, INTEGER, INTEGER)
  TO authenticated;

-- 5. BONUS : Vue agrégée (optionnel, non requise par l'app)
--    Permet d'observer les stats dans le dashboard Supabase.
CREATE OR REPLACE VIEW public.v_player_stats AS
SELECT
  user_id,
  COUNT(*)                                           AS total_played,
  SUM(CASE WHEN won THEN 1 ELSE 0 END)              AS total_won,
  ROUND(AVG(CASE WHEN won THEN 1.0 ELSE 0.0 END) * 100, 1) AS win_pct,
  SUM(coins_earned)                                  AS total_coins_earned
FROM public.game_history
GROUP BY user_id;
