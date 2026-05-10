import React, { useState } from 'react';
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
}

const CELL = 18; // taille d'une cellule de la grille en dp

// Zone révélée : 42 % de la largeur / hauteur, centrée
const REVEAL_RATIO = 0.42;

/**
 * Affiche une capture de jeu avec effet de pixelisation (blurRadius).
 * En cas d'erreur de chargement, bascule automatiquement sur `fallbackUri`.
 */
export function PixelImage({ uri, blurRadius, width, height, fallbackUri, revealZone }: Props) {
  const [loading, setLoading]           = useState(true);
  const [hasError, setHasError]         = useState(false);
  const [activeFallback, setActiveFallback] = useState(false);
  const isOnline = useNetworkStatus();

  const activeUri = activeFallback && fallbackUri ? fallbackUri : uri;

  const handleLoadStart = () => {
    setLoading(true);
  };

  const handleLoadEnd = () => {
    setLoading(false);
    setHasError(false);
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

  // Dimensions of the central reveal window
  const revealW    = Math.round(width  * REVEAL_RATIO);
  const revealH    = Math.round(height * REVEAL_RATIO);
  const revealLeft = Math.round((width  - revealW) / 2);
  const revealTop  = Math.round((height - revealH) / 2);

  return (
    <View style={[styles.container, { width, height }]}>
      {/* Blurred full image */}
      <Image
        key={activeUri}
        source={{ uri: activeUri }}
        style={StyleSheet.absoluteFill}
        blurRadius={Math.round(blurRadius)}
        resizeMode="cover"
        onLoadStart={handleLoadStart}
        onLoadEnd={handleLoadEnd}
        onError={handleError}
      />

      {/* Power-up: Zone HD — unblurred centre window */}
      {revealZone && blurRadius > 0 && (
        <View
          style={[
            styles.revealWindow,
            { width: revealW, height: revealH, left: revealLeft, top: revealTop },
          ]}
          pointerEvents="none"
        >
          <Image
            source={{ uri: activeUri }}
            style={{
              width,
              height,
              position: 'absolute',
              left: -revealLeft,
              top:  -revealTop,
            }}
            blurRadius={0}
            resizeMode="cover"
          />
        </View>
      )}

      {/* Grille pixel — s'estompe quand le blur diminue */}
      {blurRadius > 5 && (
        <PixelGrid
          width={width}
          height={height}
          opacity={Math.min(0.35, (blurRadius - 5) / 23)}
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
  // Power-up Zone HD
  revealWindow: {
    position: 'absolute',
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
