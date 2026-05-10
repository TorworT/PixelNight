/**
 * OfflineBanner.tsx
 * Bandeau non-bloquant qui glisse depuis le haut quand l'appareil perd internet.
 * Disparaît automatiquement dès la reconnexion.
 */

import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { FONTS, SPACING } from '../constants/theme';

const BANNER_H = 42;

export function OfflineBanner() {
  const isConnected  = useNetworkStatus();
  const translateY   = useRef(new Animated.Value(-BANNER_H)).current;
  const wasOffline   = useRef(false);

  useEffect(() => {
    if (!isConnected) {
      wasOffline.current = true;
      Animated.spring(translateY, {
        toValue: 0,
        tension: 90,
        friction: 12,
        useNativeDriver: true,
      }).start();
    } else if (wasOffline.current) {
      Animated.timing(translateY, {
        toValue: -BANNER_H,
        duration: 280,
        useNativeDriver: true,
      }).start();
    }
  }, [isConnected, translateY]);

  return (
    <Animated.View
      style={[styles.banner, { transform: [{ translateY }] }]}
      pointerEvents={isConnected ? 'none' : 'auto'}
    >
      <Ionicons name="cloud-offline-outline" size={14} color="#fde68a" />
      <Text style={styles.text} numberOfLines={1}>
        Mode hors ligne
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position:      'absolute',
    top:           0,
    left:          0,
    right:         0,
    zIndex:        9999,
    height:        BANNER_H,
    flexDirection: 'row',
    alignItems:    'center',
    gap:           SPACING.xs,
    backgroundColor:     '#78350f',
    borderBottomWidth:   1,
    borderBottomColor:   '#fbbf24',
    paddingHorizontal:   SPACING.md,
  },
  text: {
    color:      '#fde68a',
    fontSize:   FONTS.size.xs,
    flex:       1,
    lineHeight: 16,
  },
});
