-- ============================================================
--  PixelNight — Supabase setup
--  À exécuter dans : Dashboard → SQL Editor → New query
-- ============================================================


-- ────────────────────────────────────────────────────────────
--  1. TABLE daily_games
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.daily_games (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  date       date        UNIQUE NOT NULL,
  game_name  text        NOT NULL,
  category   text        NOT NULL DEFAULT '',
  image_url  text        NOT NULL DEFAULT '',
  hint1      text        NOT NULL DEFAULT '',
  hint2      text        NOT NULL DEFAULT '',
  hint3      text        NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now() NOT NULL
);

COMMENT ON TABLE  public.daily_games              IS 'One row per day — the game the player must guess.';
COMMENT ON COLUMN public.daily_games.date         IS 'The calendar date for which this game is active (unique constraint).';
COMMENT ON COLUMN public.daily_games.game_name    IS 'Exact title used for answer comparison (case-insensitive normalized in app).';
COMMENT ON COLUMN public.daily_games.image_url    IS 'Full https:// URL or a Storage path inside the "games" bucket (e.g. "covers/zelda.jpg").';
COMMENT ON COLUMN public.daily_games.category     IS 'Genre label shown in the result modal (e.g. "Action-RPG").';


-- ────────────────────────────────────────────────────────────
--  2. INDEX — fast lookup by date (called on every app launch)
-- ────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_daily_games_date
  ON public.daily_games (date DESC);


-- ────────────────────────────────────────────────────────────
--  3. ROW LEVEL SECURITY
-- ────────────────────────────────────────────────────────────

ALTER TABLE public.daily_games ENABLE ROW LEVEL SECURITY;

-- Anon (mobile app) → SELECT only
CREATE POLICY "anon_select"
  ON public.daily_games
  FOR SELECT
  TO anon
  USING (true);

-- Authenticated (dashboard / admin) → full access
CREATE POLICY "auth_all"
  ON public.daily_games
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);


-- ────────────────────────────────────────────────────────────
--  4. SAMPLE DATA — prêt à jouer
--     Remplacez les image_url par vos propres URLs ou par
--     des chemins Storage ("covers/portal2.jpg")
-- ────────────────────────────────────────────────────────────

INSERT INTO public.daily_games (date, game_name, category, image_url, hint1, hint2, hint3)
VALUES

  -- Aujourd'hui
  (CURRENT_DATE,
   'Portal 2',
   'Puzzle',
   'https://cdn.cloudflare.steamstatic.com/steam/apps/620/header.jpg',
   'Jeu de puzzle avec un canon créant des portails',
   'Développé par Valve Corporation en 2011',
   'La protagoniste s''appelle Chell et affronte l''IA GLaDOS'),

  -- Demain
  (CURRENT_DATE + 1,
   'Hollow Knight',
   'Metroidvania',
   'https://cdn.cloudflare.steamstatic.com/steam/apps/367520/header.jpg',
   'Metroidvania dans un royaume d''insectes souterrain',
   'Développé par Team Cherry, sorti en 2017',
   'Un chevalier sans nom explore le royaume de Hallownest'),

  -- Après-demain
  (CURRENT_DATE + 2,
   'Celeste',
   'Plateforme',
   'https://cdn.cloudflare.steamstatic.com/steam/apps/504230/header.jpg',
   'Jeu de plateforme pixelisé sur l''escalade d''une montagne',
   'Aborde les thèmes de la santé mentale et de l''anxiété',
   'La protagoniste Madeline escalade le mont Celeste'),

  (CURRENT_DATE + 3,
   'Hades',
   'Roguelike',
   'https://cdn.cloudflare.steamstatic.com/steam/apps/1145360/header.jpg',
   'Roguelike où vous jouez le fils du dieu des Enfers grecs',
   'Développé par Supergiant Games, sorti en 2020',
   'Zagreus tente de s''échapper des Enfers avec l''aide des Olympiens'),

  (CURRENT_DATE + 4,
   'Disco Elysium',
   'RPG',
   'https://cdn.cloudflare.steamstatic.com/steam/apps/632470/header.jpg',
   'RPG isométrique sans combat, axé sur les dialogues',
   'Un détective amnésique dans une ville post-révolutionnaire',
   'Le personnage souffre de la pire gueule de bois de sa vie'),

  (CURRENT_DATE + 5,
   'Stardew Valley',
   'Simulation',
   'https://cdn.cloudflare.steamstatic.com/steam/apps/413150/header.jpg',
   'Simulation de ferme avec des éléments RPG',
   'Développé seul par ConcernedApe, sorti en 2016',
   'Vous héritez de la ferme de votre grand-père à Pelican Town'),

  (CURRENT_DATE + 6,
   'Elden Ring',
   'Action-RPG',
   'https://cdn.cloudflare.steamstatic.com/steam/apps/1245620/header.jpg',
   'Action-RPG en monde ouvert dans les Terres Intermédiaires',
   'Développé par FromSoftware, sorti en 2022',
   'Scénario co-écrit par George R.R. Martin')

ON CONFLICT (date) DO NOTHING;  -- safe to re-run


-- ────────────────────────────────────────────────────────────
--  5. STORAGE BUCKET "games"  (commandes SQL)
--     Alternative : Dashboard → Storage → New bucket
-- ────────────────────────────────────────────────────────────

-- Crée le bucket public "games" (idempotent)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'games',
  'games',
  true,                          -- public = URL directement accessible sans token
  5242880,                       -- 5 MB max par fichier
  ARRAY['image/jpeg','image/png','image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Politique de lecture publique sur les objets du bucket
CREATE POLICY "public_read_games"
  ON storage.objects
  FOR SELECT
  TO anon
  USING (bucket_id = 'games');

-- Seuls les utilisateurs authentifiés (admin) peuvent uploader
CREATE POLICY "auth_upload_games"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'games');

CREATE POLICY "auth_delete_games"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'games');


-- ────────────────────────────────────────────────────────────
--  6. VÉRIFICATION
-- ────────────────────────────────────────────────────────────

-- Doit retourner le jeu du jour :
SELECT * FROM public.daily_games WHERE date = CURRENT_DATE;

-- Doit retourner 1 ligne avec public = true :
SELECT id, name, public FROM storage.buckets WHERE id = 'games';
