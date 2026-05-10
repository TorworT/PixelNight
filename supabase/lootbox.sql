-- ══════════════════════════════════════════════════════════════════════════════
-- PixelNight — lootbox.sql
-- Coffre gratuit toutes les 48h : last_lootbox_claimed_at + claim_lootbox() RPC
-- À exécuter dans Supabase Dashboard → SQL Editor → New query
-- ══════════════════════════════════════════════════════════════════════════════

-- ─── 1. COLONNE SUR PROFILES ──────────────────────────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_lootbox_claimed_at TIMESTAMPTZ;

-- ─── 2. CLAIM_LOOTBOX RPC ─────────────────────────────────────────────────────
-- Vérifie le cooldown 48h, tire au sort les pièces selon le système de rareté,
-- crédite le joueur et met à jour le timestamp — tout en une transaction.
--
-- Système de rareté :
--   5  pièces → 30,0 %
--   10 pièces → 20,0 %
--   20 pièces → 15,0 %
--   30 pièces → 12,0 %
--   40 pièces →  8,0 %
--   50 pièces →  6,0 %
--   60 pièces →  4,0 %
--   70 pièces →  2,5 %
--   80 pièces →  1,5 %
--   90 pièces →  0,7 %
--  100 pièces →  0,3 %
--
-- Retourne : { success, coins } | { success: false, error, next_available? }

CREATE OR REPLACE FUNCTION public.claim_lootbox()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid        UUID;
  v_last_claim TIMESTAMPTZ;
  v_next       TIMESTAMPTZ;
  v_rand       FLOAT;
  v_coins      INTEGER;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  -- ── Lecture du dernier claim ──────────────────────────────────────────────
  SELECT last_lootbox_claimed_at
    INTO v_last_claim
    FROM public.profiles
   WHERE id = v_uid;

  -- ── Vérification du cooldown 48 h ─────────────────────────────────────────
  IF v_last_claim IS NOT NULL THEN
    v_next := v_last_claim + INTERVAL '48 hours';
    IF NOW() < v_next THEN
      RETURN json_build_object(
        'success',        false,
        'error',          'cooldown',
        'next_available', v_next
      );
    END IF;
  END IF;

  -- ── Tirage aléatoire selon le système de rareté ───────────────────────────
  --
  --  Seuils cumulatifs :
  --   [0.000 , 0.300) →   5 pièces  (30,0 %)
  --   [0.300 , 0.500) →  10 pièces  (20,0 %)
  --   [0.500 , 0.650) →  20 pièces  (15,0 %)
  --   [0.650 , 0.770) →  30 pièces  (12,0 %)
  --   [0.770 , 0.850) →  40 pièces  ( 8,0 %)
  --   [0.850 , 0.910) →  50 pièces  ( 6,0 %)
  --   [0.910 , 0.950) →  60 pièces  ( 4,0 %)
  --   [0.950 , 0.975) →  70 pièces  ( 2,5 %)
  --   [0.975 , 0.990) →  80 pièces  ( 1,5 %)
  --   [0.990 , 0.997) →  90 pièces  ( 0,7 %)
  --   [0.997 , 1.000) → 100 pièces  ( 0,3 %)

  v_rand := random();

  IF    v_rand < 0.300 THEN v_coins :=   5;
  ELSIF v_rand < 0.500 THEN v_coins :=  10;
  ELSIF v_rand < 0.650 THEN v_coins :=  20;
  ELSIF v_rand < 0.770 THEN v_coins :=  30;
  ELSIF v_rand < 0.850 THEN v_coins :=  40;
  ELSIF v_rand < 0.910 THEN v_coins :=  50;
  ELSIF v_rand < 0.950 THEN v_coins :=  60;
  ELSIF v_rand < 0.975 THEN v_coins :=  70;
  ELSIF v_rand < 0.990 THEN v_coins :=  80;
  ELSIF v_rand < 0.997 THEN v_coins :=  90;
  ELSE                       v_coins := 100;
  END IF;

  -- ── Crédit + mise à jour du timestamp ─────────────────────────────────────
  UPDATE public.profiles
     SET coins                   = coins + v_coins,
         last_lootbox_claimed_at = NOW()
   WHERE id = v_uid;

  RETURN json_build_object('success', true, 'coins', v_coins);
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_lootbox() TO authenticated;

-- ─── 3. VÉRIFICATION ──────────────────────────────────────────────────────────
-- SELECT id, pseudo, coins, last_lootbox_claimed_at FROM public.profiles LIMIT 5;
