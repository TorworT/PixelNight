-- ─── Inventaire des power-ups ────────────────────────────────────────────────
-- Ajoute 4 colonnes d'inventaire à profiles + 2 RPCs atomiques :
--   buy_item  : déduit les pièces ET incrémente le stock en une transaction
--   use_item  : décrémente le stock (vérifie que > 0)

-- 1. Colonnes inventaire
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS hint_letter INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS hint_zone   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS extra_life  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS skip        INTEGER NOT NULL DEFAULT 0;

-- 2. RPC: buy_item — atomique : vérifie/déduit les pièces + incrémente le stock
CREATE OR REPLACE FUNCTION public.buy_item(p_type TEXT, p_cost INTEGER)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_coins INTEGER;
BEGIN
  -- Verrou ligne + vérification solde
  SELECT coins INTO v_coins
  FROM   profiles
  WHERE  id = auth.uid()
  FOR UPDATE;

  IF v_coins IS NULL THEN
    RAISE EXCEPTION 'profile_not_found';
  END IF;
  IF v_coins < p_cost THEN
    RAISE EXCEPTION 'insufficient_coins';
  END IF;

  -- Déduction coins
  UPDATE profiles
  SET coins = coins - p_cost, updated_at = now()
  WHERE id = auth.uid();

  -- Incrément inventaire
  CASE p_type
    WHEN 'hint_letter' THEN
      UPDATE profiles SET hint_letter = hint_letter + 1 WHERE id = auth.uid();
    WHEN 'hint_zone' THEN
      UPDATE profiles SET hint_zone = hint_zone + 1 WHERE id = auth.uid();
    WHEN 'extra_life' THEN
      UPDATE profiles SET extra_life = extra_life + 1 WHERE id = auth.uid();
    WHEN 'skip' THEN
      UPDATE profiles SET skip = skip + 1 WHERE id = auth.uid();
    ELSE
      RAISE EXCEPTION 'unknown_item_type: %', p_type;
  END CASE;
END;
$$;

-- 3. RPC: use_item — décrémente le stock (erreur si épuisé)
CREATE OR REPLACE FUNCTION public.use_item(p_type TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  CASE p_type
    WHEN 'hint_letter' THEN
      SELECT hint_letter INTO v_count FROM profiles WHERE id = auth.uid() FOR UPDATE;
      IF v_count <= 0 THEN RAISE EXCEPTION 'item_not_available'; END IF;
      UPDATE profiles SET hint_letter = hint_letter - 1, updated_at = now() WHERE id = auth.uid();
    WHEN 'hint_zone' THEN
      SELECT hint_zone INTO v_count FROM profiles WHERE id = auth.uid() FOR UPDATE;
      IF v_count <= 0 THEN RAISE EXCEPTION 'item_not_available'; END IF;
      UPDATE profiles SET hint_zone = hint_zone - 1, updated_at = now() WHERE id = auth.uid();
    WHEN 'extra_life' THEN
      SELECT extra_life INTO v_count FROM profiles WHERE id = auth.uid() FOR UPDATE;
      IF v_count <= 0 THEN RAISE EXCEPTION 'item_not_available'; END IF;
      UPDATE profiles SET extra_life = extra_life - 1, updated_at = now() WHERE id = auth.uid();
    WHEN 'skip' THEN
      SELECT skip INTO v_count FROM profiles WHERE id = auth.uid() FOR UPDATE;
      IF v_count <= 0 THEN RAISE EXCEPTION 'item_not_available'; END IF;
      UPDATE profiles SET skip = skip - 1, updated_at = now() WHERE id = auth.uid();
    ELSE
      RAISE EXCEPTION 'unknown_item_type: %', p_type;
  END CASE;
END;
$$;

-- 4. Droits d'exécution
GRANT EXECUTE ON FUNCTION public.buy_item(TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.use_item(TEXT)          TO authenticated;
