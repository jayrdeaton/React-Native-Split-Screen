import { ReactNode } from 'react'
import { StyleProp, StyleSheet, useWindowDimensions, View, ViewStyle } from 'react-native'

import { getViewRotation } from './rotation'
import { OrientationMode } from './types'

export interface FakeLandscapeViewProps {
  orientationMode: OrientationMode
  p1OnRight: boolean
  upsideDown: boolean
  style?: StyleProp<ViewStyle>
  children: ReactNode
}

// Wraps `children` in whatever rotation keeps it gravity-upright for however the device is
// currently being held — see getViewRotation for the angle itself, and its own comment for why this
// is needed at all now that the app is portrait-locked at the OS level.
//
// A 90°/-90° rotation swaps the content's effective footprint (what was width becomes height), so
// those two cases render into an inner container explicitly sized/centered for the swap — the
// standard "fake landscape inside a portrait-locked app" trick — rather than just rotating in place,
// which would clip against the real (unswapped, portrait-shaped) window. 180° doesn't change the
// footprint at all, so it skips straight to a plain rotate.
//
// Safe for tap-driven content — React Native's own touch responder system hit-tests against the
// rendered/transformed layout correctly. NOT safe for continuous gesture tracking
// (react-native-gesture-handler's translation deltas read raw, untransformed native coordinates) —
// never wrap the game board/touch layer in this.
export function FakeLandscapeView({ orientationMode, p1OnRight, upsideDown, style, children }: FakeLandscapeViewProps) {
  const { width, height } = useWindowDimensions()
  const rotation = getViewRotation(orientationMode, p1OnRight, upsideDown)

  if (rotation === 0) return <View style={style}>{children}</View>

  if (rotation === 180) return <View style={[style, styles.flip180]}>{children}</View>

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents='box-none'>
      <View style={[style, { height: width, left: (width - height) / 2, position: 'absolute', top: (height - width) / 2, transform: [{ rotate: `${rotation}deg` }], width: height }]}>{children}</View>
    </View>
  )
}

const styles = StyleSheet.create({
  flip180: {
    transform: [{ rotate: '180deg' }]
  }
})
