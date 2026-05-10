-- ─── Table changelogs ────────────────────────────────────────────────────────
-- Stocke une entrée par version de l'application.
-- Lue par le client (RLS public SELECT) pour afficher la modale "Nouveautés".

CREATE TABLE IF NOT EXISTS changelogs (
  id         SERIAL      PRIMARY KEY,
  version    TEXT        NOT NULL UNIQUE,
  title      TEXT        NOT NULL,
  changes    TEXT[]      NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS : lecture publique (pas d'auth requise — le changelog est une info publique)
ALTER TABLE changelogs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_changelogs" ON changelogs;
CREATE POLICY "public_read_changelogs"
  ON changelogs FOR SELECT
  USING (true);

-- ─── Seed : v1.0.2 ───────────────────────────────────────────────────────────

INSERT INTO changelogs (version, title, changes)
VALUES (
  '1.0.2',
  'Mode Infini & Abonnements',
  ARRAY[
    'Mode Infini — rejoue tous les jeux du passé (Pro & Legend)',
    'Abonnements Basic, Pro et Legend avec badges dans le classement',
    'Pièces quotidiennes offertes automatiquement selon ton abonnement',
    'Indices et chances supplémentaires gratuits pour les abonnés',
    'Boutons de navigation agrandis et plus visibles',
    'Corrections de bugs et améliorations de performance'
  ]
)
ON CONFLICT (version) DO NOTHING;
