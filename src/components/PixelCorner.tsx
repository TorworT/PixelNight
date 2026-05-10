import React from 'react';
import { View, StyleSheet } from 'react-native';
import { COLORS } from '../constants/theme';

type Position = 'tl' | 'tr' | 'bl' | 'br';

interface Props {
  position: Position;
  size?: number;
  thickness?: number;
  color?: string;
}

/**
 * An L-shaped pixel art corner bracket.
 * Combine four of these to create a retro targeting-reticle frame.
 */
export function PixelCorner({
  position,
  size = 28,
  thickness = 3,
  color = COLORS.accent,
}: Props) {
  const isTop = position[0] === 't';
  const isLeft = position[1] === 'l';

  return (
    <View style={{ width: size, height: size }}>
      {/* Horizontal arm */}
      <View
        style={[
          styles.arm,
          {
            width: size,
            height: thickness,
            backgroundColor: color,
            top: isTop ? 0 : undefined,
            bottom: isTop ? undefined : 0,
            left: isLeft ? 0 : undefined,
            right: isLeft ? undefined : 0,
          },
        ]}
      />
      {/* Vertical arm */}
      <View
        style={[
          styles.arm,
          {
            width: thickness,
            height: size,
            backgroundColor: color,
            top: isTop ? 0 : undefined,
            bottom: isTop ? undefined : 0,
            left: isLeft ? 0 : undefined,
            right: isLeft ? undefined : 0,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  arm: { position: 'absolute' },
});
