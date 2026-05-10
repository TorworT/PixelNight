-- ══════════════════════════════════════════════════════════════════════════════
-- PixelNight — profiles.sql
-- Run this in your Supabase SQL editor (Dashboard → SQL Editor → New query)
-- ══════════════════════════════════════════════════════════════════════════════

-- ─── 1. PROFILES TABLE ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.profiles (
  id                UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  pseudo            TEXT        NOT NULL DEFAULT '',
  avatar_url        TEXT,

  -- Scoring
  score_total       INTEGER     NOT NULL DEFAULT 0,
  serie_actuelle    INTEGER     NOT NULL DEFAULT 0,
  meilleure_serie   INTEGER     NOT NULL DEFAULT 0,

  -- Game counters
  parties_jouees    INTEGER     NOT NULL DEFAULT 0,
  parties_gagnees   INTEGER     NOT NULL DEFAULT 0,

  -- Timestamps
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for leaderboard query (score_total DESC)
CREATE INDEX IF NOT EXISTS idx_profiles_score_total
  ON public.profiles (score_total DESC);

-- ─── 2. ROW LEVEL SECURITY ───────────────────────────────────────────────────

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Anyone can read profiles (leaderboard)
CREATE POLICY "profiles_select_all"
  ON public.profiles FOR SELECT
  USING (true);

-- Users can only update their own profile
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Inserts are handled by the trigger below (service role)
-- But also allow users to insert their own row (belt-and-suspenders)
CREATE POLICY "profiles_insert_own"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- ─── 3. AUTO-CREATE PROFILE ON SIGNUP ────────────────────────────────────────

-- Function called by trigger on every new auth.users row
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, pseudo)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'pseudo',  -- passed via signUp({ data: { pseudo } })
      split_part(NEW.email, '@', 1)       -- fallback: part before @ in email
    )
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Attach trigger to auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─── 4. UPDATED_AT AUTO-UPDATE ───────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── 5. SUBMIT GAME RESULT (RPC) ─────────────────────────────────────────────
--
-- Called from the app via: supabase.rpc('submit_game_result', { ... })
-- Updates score, streaks, and game counters atomically.
-- Runs as SECURITY DEFINER so it bypasses RLS (writes to own row only).

CREATE OR REPLACE FUNCTION public.submit_game_result(
  p_score       INTEGER,
  p_won         BOOLEAN,
  p_new_serie   INTEGER   -- caller sends current streak value (≥ 1 if won)
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_serie   INTEGER;
  v_best_serie      INTEGER;
  v_computed_serie  INTEGER;
BEGIN
  -- Fetch current streak values
  SELECT serie_actuelle, meilleure_serie
    INTO v_current_serie, v_best_serie
    FROM public.profiles
   WHERE id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found for user %', auth.uid();
  END IF;

  IF p_won THEN
    v_computed_serie := v_current_serie + 1;
  ELSE
    v_computed_serie := 0;
  END IF;

  UPDATE public.profiles
  SET
    score_total     = score_total + p_score,
    serie_actuelle  = v_computed_serie,
    meilleure_serie = GREATEST(meilleure_serie, v_computed_serie),
    parties_jouees  = parties_jouees + 1,
    parties_gagnees = parties_gagnees + (CASE WHEN p_won THEN 1 ELSE 0 END)
  WHERE id = auth.uid();
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.submit_game_result(INTEGER, BOOLEAN, INTEGER)
  TO authenticated;

-- ─── 6. LEADERBOARD VIEW (optional convenience) ──────────────────────────────

CREATE OR REPLACE VIEW public.leaderboard AS
SELECT
  id,
  pseudo,
  score_total,
  serie_actuelle,
  meilleure_serie,
  parties_jouees,
  parties_gagnees,
  ROW_NUMBER() OVER (ORDER BY score_total DESC) AS rank
FROM public.profiles
ORDER BY score_total DESC
LIMIT 50;

-- ─── 7. QUICK VERIFICATION ───────────────────────────────────────────────────
-- After running this script, verify with:
--   SELECT * FROM public.profiles LIMIT 5;
--   SELECT * FROM public.leaderboard LIMIT 10;
