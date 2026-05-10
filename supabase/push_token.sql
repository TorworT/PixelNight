-- ─── Push token pour les notifications distantes ────────────────────────────
-- Ajoute la colonne push_token à profiles
-- + RPC atomique pour la sauvegarder depuis le client

-- 1. Colonne
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS push_token TEXT;

-- 2. RPC: save_push_token
CREATE OR REPLACE FUNCTION public.save_push_token(p_token TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE profiles
  SET    push_token = p_token,
         updated_at = now()
  WHERE  id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile_not_found';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_push_token(TEXT) TO authenticated;
