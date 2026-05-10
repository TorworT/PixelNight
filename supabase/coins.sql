-- ─── Pièces (coins) ──────────────────────────────────────────────────────────
-- Ajoute la colonne coins à la table profiles, et deux RPCs pour
-- créditer (add_coins) et débiter (spend_coins) le solde.

-- 1. Colonne coins
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS coins INTEGER NOT NULL DEFAULT 0;

-- 2. RPC: add_coins — crédite des pièces à l'utilisateur connecté
CREATE OR REPLACE FUNCTION public.add_coins(p_amount INTEGER)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_amount <= 0 THEN RETURN; END IF;
  UPDATE profiles
  SET coins      = coins + p_amount,
      updated_at = now()
  WHERE id = auth.uid();
END;
$$;

-- 3. RPC: spend_coins — débite des pièces ; lève une exception si solde insuffisant
CREATE OR REPLACE FUNCTION public.spend_coins(p_amount INTEGER)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_coins INTEGER;
BEGIN
  IF p_amount <= 0 THEN RETURN; END IF;

  -- Verrou ligne pour atomicité
  SELECT coins INTO v_coins
  FROM   profiles
  WHERE  id = auth.uid()
  FOR UPDATE;

  IF v_coins IS NULL THEN
    RAISE EXCEPTION 'profile_not_found';
  END IF;
  IF v_coins < p_amount THEN
    RAISE EXCEPTION 'insufficient_coins';
  END IF;

  UPDATE profiles
  SET coins      = coins - p_amount,
      updated_at = now()
  WHERE id = auth.uid();
END;
$$;

-- 4. Droits d'exécution pour les utilisateurs connectés
GRANT EXECUTE ON FUNCTION public.add_coins(INTEGER)   TO authenticated;
GRANT EXECUTE ON FUNCTION public.spend_coins(INTEGER) TO authenticated;
