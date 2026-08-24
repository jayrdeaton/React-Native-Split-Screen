import { ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated from 'react-native-reanimated'

import { DualZoneLayoutState } from './useDualZoneLayout'

interface Props {
  // From useDualZoneLayout — the committed layout (not the live orientation) and its fade style.
  panelLayout: DualZoneLayoutState
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  panelFadeStyle: any
  // P1 is assumed to be the device's owner — in face-to-face mode their zone renders unrotated,
  // facing them; p2's zone is rotated 180° to face them from the opposite side of the device. In
  // side-by-side mode neither is rotated, they're just ordered left/right by p1OnRight.
  p1: ReactNode
  p2: ReactNode
  // Rendered above both zones in face-to-face mode (between p2's rotated zone and p1's own), and
  // above the p1/p2 row in side-by-side mode — the one thing on screen that reads right-side-up
  // for both players regardless of which zone is rotated, so it's meant for whatever's shared
  // rather than owned by either player individually.
  shared?: ReactNode
}

// Renders whichever of the two layouts fits the committed orientation — face-to-face (portrait:
// p2's zone rotated 180° and stacked above p1's, `shared` between them) or side-by-side (landscape:
// p1/p2 in a plain left/right row ordered by p1OnRight, `shared` above) — and fades across a
// rotation using panelFadeStyle from useDualZoneLayout. Only covers the two-player case; a solo
// screen (nothing to rotate for) doesn't need this component at all, just render your own content.
export function DualZoneLayout({ panelLayout, panelFadeStyle, p1, p2, shared }: Props) {
  const isFaceToFace = panelLayout.orientationMode === 'faceToFace'

  if (isFaceToFace) {
    return (
      <View style={styles.dualZone}>
        <Animated.View style={[styles.rotated180, panelFadeStyle]}>{p2}</Animated.View>
        {shared}
        <Animated.View style={panelFadeStyle}>{p1}</Animated.View>
      </View>
    )
  }

  return (
    <View style={styles.stackedZone}>
      {shared}
      <Animated.View style={[styles.playersRow, panelFadeStyle]}>
        {panelLayout.p1OnRight ? p2 : p1}
        {panelLayout.p1OnRight ? p1 : p2}
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  dualZone: {
    alignItems: 'center',
    gap: 28
  },
  playersRow: {
    alignItems: 'center',
    flexDirection: 'row',
    // Side-by-side only renders once the phone is actually held in landscape, which is genuinely
    // wide, so the two zones get real breathing room between them — wide enough that each
    // player's own popovers stay clear of the other's reach even when both are open at once.
    gap: 180
  },
  rotated180: {
    transform: [{ rotate: '180deg' }]
  },
  stackedZone: {
    alignItems: 'center',
    gap: 28
  }
})
