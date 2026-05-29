import React, { useState, useMemo } from 'react';
import { View, Image, StyleSheet, ActivityIndicator, Text } from 'react-native';
import { COLORS, FONTS } from '../constants/theme';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

interface Props {
  uri: string;
  blurRadius: number;
  width: number;
  height: number;
  /**
   * URL de secours affichée si `uri` échoue à charger.
   * Typiquement l'image Steam CDN du jeu local correspondant.
   */
  fallbackUri?: string;
  /**
   * Power-up "Zone HD" : si true, affiche une fenêtre centrale non-floutée
   * par-dessus l'image pixelisée.
   */
  revealZone?: boolean;
  /**
   * Index de tentative (1–5) : charge automatiquement la version pré-pixelisée
   * correspondante en remplaçant `.jpg` par `_1.jpg`, `_2.jpg`, etc.
   * Valeur ≥ 6 (ou absente) → image originale sans suffixe.
   */
  attemptIndex?: number;
  /** Appelé dès que le chargement de l'image démarre. */
  onLoadStart?: () => void;
  /** Appelé quand l'image est entièrement chargée (ou en erreur). */
  onLoadEnd?: () => void;
}

const CELL = 18; // taille d'une cellule de la grille en dp

// Power-up Zone HD — 20 petits carrés de 30 × 30 px
const SQUARE_SIZE    = 30;
const REVEAL_COUNT   = 10;
const SQUARE_MARGIN  = 4; // marges min par rapport aux bords de l'image

/**
 * Résout l'URI de l'image pré-pixelisée selon l'index de tentative.
 * - attemptIndex 1–5 : remplace `.jpg` par `_N.jpg`
 * - attemptIndex ≥ 6 ou absent : URI originale (image révélée / pas de suffixe)
 * - URI non-jpg : inchangée dans tous les cas
 */
function resolvePixelUri(uri: string, attemptIndex?: number): string {
  if (attemptIndex === undefined) return uri;
  if (!uri.toLowerCase().endsWith('.jpg')) return uri;
  if (attemptIndex >= 6) return uri;           // ≥ 6 → image originale, aucun suffixe
  return `${uri.slice(0, -4)}_${attemptIndex}.jpg`;
}

/**
 * Affiche une capture de jeu avec effet de pixelisation (blurRadius).
 * En cas d'erreur de chargement, bascule automatiquement sur `fallbackUri`.
 */
export function PixelImage({ uri, blurRadius, width, height, fallbackUri, revealZone, attemptIndex, onLoadStart: onLoadStartProp, onLoadEnd: onLoadEndProp }: Props) {
  const [loading, setLoading]           = useState(true);
  const [hasError, setHasError]         = useState(false);
  const [activeFallback, setActiveFallback] = useState(false);
  const isOnline = useNetworkStatus();

  // URI effective : version pré-pixelisée si attemptIndex fourni, originale sinon.
  // Le fallback (Steam CDN / asset local) utilise toujours l'URI originale.
  const pixelUri  = resolvePixelUri(uri, attemptIndex);
  const activeUri = activeFallback && fallbackUri ? fallbackUri : pixelUri;

  // Si une image pré-pixelisée est chargée (pixelUri differ de uri original),
  // le flou gaussien natif est désactivé — la pixelisation par blocs suffit.
  const effectiveBlurRadius = pixelUri !== uri ? 0 : blurRadius;


  const handleLoadStart = () => {
    setLoading(true);
    onLoadStartProp?.();
  };

  const handleLoadEnd = () => {
    setLoading(false);
    setHasError(false);
    onLoadEndProp?.();
  };

  const handleError = (_e: any) => {
    if (!activeFallback && fallbackUri) {
      setActiveFallback(true);
      setLoading(true);
      setHasError(false);
    } else {
      setLoading(false);
      setHasError(true);
    }
  };

  // Positions aléatoires des 20 carrés — calculées une seule fois par dimensions.
  const revealSquares = useMemo(() => {
    if (!revealZone) return [];
    const maxLeft = Math.max(0, width  - SQUARE_SIZE - SQUARE_MARGIN);
    const maxTop  = Math.max(0, height - SQUARE_SIZE - SQUARE_MARGIN);
    return Array.from({ length: REVEAL_COUNT }, () => ({
      left: SQUARE_MARGIN + Math.floor(Math.random() * (maxLeft - SQUARE_MARGIN)),
      top:  SQUARE_MARGIN + Math.floor(Math.random() * (maxTop  - SQUARE_MARGIN)),
    }));
  }, [revealZone, width, height]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={[styles.container, { width, height }]}>
      {/* Blurred full image */}
      <Image
        key={`${activeUri}_${attemptIndex ?? 0}`}
        source={{ uri: activeUri }}
        style={StyleSheet.absoluteFill}
        blurRadius={Math.round(effectiveBlurRadius)}
        resizeMode="cover"
        onLoadStart={handleLoadStart}
        onLoadEnd={handleLoadEnd}
        onError={handleError}
      />

      {/* Power-up: Zone HD — 20 petits carrés aléatoires nets */}
      {revealZone && revealSquares.map((pos, i) => (
        <View
          key={i}
          style={[styles.revealSquare, { left: pos.left, top: pos.top }]}
          pointerEvents="none"
        >
          <Image
            source={{ uri: fallbackUri ?? uri }}
            // fallbackUri (ex: Steam CDN) si disponible → image nette garantie même si
            // l'original Supabase n'a pas été uploadé (cas JV : seuls _1.jpg–_5.jpg existent).
            // Pour Animé/Cinéma sans fallback → uri (original dans le bucket).
            style={{
              width,
              height,
              position: 'absolute',
              left: -pos.left,
              top:  -pos.top,
            }}
            blurRadius={0}
            resizeMode="cover"
          />
        </View>
      ))}

      {/* Grille pixel — s'estompe quand le blur diminue */}
      {effectiveBlurRadius > 5 && (
        <PixelGrid
          width={width}
          height={height}
          opacity={Math.min(0.35, (effectiveBlurRadius - 5) / 23)}
        />
      )}

      {/* Spinner pendant le chargement */}
      {loading && !hasError && (
        <View style={[StyleSheet.absoluteFill, styles.loader]}>
          <ActivityIndicator color={COLORS.accent} size="large" />
        </View>
      )}

      {/* État d'erreur final */}
      {hasError && (
        <View style={[StyleSheet.absoluteFill, styles.errorState]}>
          <Text style={styles.errorIcon}>🖼️</Text>
          <Text style={styles.errorText}>{isOnline ? 'Image indisponible' : 'Image indisponible hors ligne'}</Text>
          {__DEV__ && (
            <Text style={styles.errorUrl} numberOfLines={2}>{activeUri}</Text>
          )}
        </View>
      )}

      {/* Coins pixel décoratifs */}
      <View style={[styles.corner, styles.tl]} />
      <View style={[styles.corner, styles.tr]} />
      <View style={[styles.corner, styles.bl]} />
      <View style={[styles.corner, styles.br]} />
    </View>
  );
}

// ─── Grille pixel ─────────────────────────────────────────────────────────────

function PixelGrid({ width, height, opacity }: { width: number; height: number; opacity: number }) {
  const cols  = Math.ceil(width / CELL);
  const rows  = Math.ceil(height / CELL);
  const cells = Array.from({ length: rows * cols }, (_, i) => i);

  return (
    <View style={[StyleSheet.absoluteFill, { opacity }]} pointerEvents="none">
      {cells.map((i) => {
        const r = Math.floor(i / cols);
        const c = i % cols;
        return (
          <View
            key={i}
            style={{
              position: 'absolute',
              top:    r * CELL,
              left:   c * CELL,
              width:  CELL,
              height: CELL,
              borderWidth: 0.5,
              borderColor: 'rgba(0,0,0,0.35)',
            }}
          />
        );
      })}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const CORNER = 10;

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    borderRadius: 2,
    backgroundColor: COLORS.card,
  },
  loader: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.card,
  },
  errorState: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.card,
    gap: 8,
    padding: 16,
  },
  errorIcon: { fontSize: 32 },
  errorText: { color: COLORS.textMuted, fontSize: FONTS.size.sm, textAlign: 'center' },
  errorUrl:  { color: COLORS.textMuted, fontSize: 9, textAlign: 'center', opacity: 0.6 },
  // Power-up Zone HD — carré individuel
  revealSquare: {
    position: 'absolute',
    width:    SQUARE_SIZE,
    height:   SQUARE_SIZE,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: COLORS.warning,
    borderRadius: 3,
  },
  corner: {
    position: 'absolute',
    width: CORNER,
    height: CORNER,
    backgroundColor: COLORS.accent,
  },
  tl: { top: 0, left: 0 },
  tr: { top: 0, right: 0 },
  bl: { bottom: 0, left: 0 },
  br: { bottom: 0, right: 0 },
});
