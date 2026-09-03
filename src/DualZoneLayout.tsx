import { ReactNode, useCallback, useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated from 'react-native-reanimated'

import { DualZoneLayoutState } from './useDualZoneLayout'
import { ZoneBounds, ZoneBoundsProvider } from './useZoneBounds'

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
  // True while a popover/dropdown *inside that zone* is open and may need to paint over an
  // adjacent zone it isn't nested inside — e.g. a tall popover that visually overlaps the
  // neighboring zone's own rectangle rather than actually escaping this component's DOM (see
  // PopoverBody in @tastic/hud: never portaled, so an open popover is sized by its own content and
  // can genuinely extend past its zone's edge into whichever zone sits next to it).
  //
  // Each zone here (`sharedZone` below, and each of p1/p2's own wrapper) is a `position: 'relative'`
  // View, and React Native Web gives every one of those an explicit `zIndex: 0` rather than `auto` —
  // which, per the CSS stacking spec, makes each one the root of its own fresh stacking context.
  // That's why a popover's own internal elevation (e.g. LobbyPlayerPanel's `panelOpen`,
  // LobbySharedControls' `containerOpen` — every consuming app's own "am I open, then raise my own
  // zIndex above my siblings" pattern) only ever wins against siblings *within* the same zone: it
  // has no way to reach across a zone boundary this component itself owns, since this component is
  // the first ancestor both zones actually share. Without these props, whichever zone happens to be
  // the later DOM sibling always paints on top regardless of which one actually has something open —
  // for the side-by-side layout below, that's the players row over the shared row, every time.
  //
  // Each flag is independent (not e.g. a single `elevatedZone` union) because p1 and p2 can each
  // have something open on their own independent host at the same time in two-player mode, and
  // whichever zone(s) report true get raised the same way a consumer already raises its own popover
  // above its own siblings — see the styles below.
  p1Elevated?: boolean
  p2Elevated?: boolean
  sharedElevated?: boolean
}

// Renders whichever of the two layouts fits the committed orientation — face-to-face (portrait:
// p2's zone rotated 180° and stacked above p1's, `shared` between them) or side-by-side (landscape:
// p1/p2 in a plain left/right row ordered by p1OnRight, `shared` above) — and fades across a
// rotation using panelFadeStyle from useDualZoneLayout. Only covers the two-player case; a solo
// screen (nothing to rotate for) doesn't need this component at all, just render your own content.
//
// Also measures the boundary between the two zones (the shared row's own on-screen position) and
// provides each zone's own bounds via useZoneBounds — see that hook's own doc for why a zone needs
// this instead of just reading the full window height.
export function DualZoneLayout({ panelLayout, panelFadeStyle, p1, p2, shared, p1Elevated, p2Elevated, sharedElevated }: Props) {
  const isFaceToFace = panelLayout.orientationMode === 'faceToFace'
  const sharedRef = useRef<View>(null)
  // null until the first post-mount measurement lands — see measureShared below. Every zone's own
  // useZoneBounds() reads null until then too (see the ternaries below), same "not measured yet"
  // meaning as everywhere else this package/​@tastic/hud use it — in practice this resolves well
  // before a user could have tapped anything, since onLayout fires shortly after mount.
  const [sharedBounds, setSharedBounds] = useState<{ top: number; bottom: number } | null>(null)

  // measureInWindow (not onLayout's own pre-transform, parent-relative numbers) is what actually
  // gives an absolute screen position here — same reasoning as @tastic/hud's useAutoAlign measuring
  // its own trigger this way, just applied to the shared row instead. Re-runs via onLayout below
  // whenever the shared row's own layout changes (its content changing height, the window resizing,
  // etc.), so this never goes stale while mounted.
  const measureShared = useCallback(() => {
    sharedRef.current?.measureInWindow((_x, y, _width, height) => {
      setSharedBounds({ bottom: y + height, top: y })
    })
  }, [])

  const sharedZone = (
    <View ref={sharedRef} onLayout={measureShared} style={sharedElevated && styles.elevated}>
      {shared}
    </View>
  )

  if (isFaceToFace) {
    // p2 (top, rotated) sits above the shared row; p1 (bottom, unrotated) sits below it — that
    // much never changes. But `rotated` below is XOR'd with panelLayout.upsideDown, not hardcoded
    // per zone: the documented, intended use of upsideDown (see useDualZoneLayout's own doc) is a
    // caller wrapping this whole component in a FakeLandscapeView driven by that same committed
    // value, which adds a further 180° around EVERYTHING here in absolute terms once the device is
    // upside down. p2's own 180° then cancels that outer one back to 0° absolute, and p1's 0° picks
    // up the outer 180° it didn't have before — so without this, a popover relying on `rotated` for
    // its own local-vs-real-world positioning (see useZoneBounds' own doc) would get both zones
    // backwards the instant the caller's outer wrapper flips upside down.
    const p2Bounds: ZoneBounds | null = sharedBounds && { rotated: !panelLayout.upsideDown, sharedEdgeY: sharedBounds.top, zoneSide: 'aboveShared' }
    const p1Bounds: ZoneBounds | null = sharedBounds && { rotated: panelLayout.upsideDown, sharedEdgeY: sharedBounds.bottom, zoneSide: 'belowShared' }

    return (
      <View style={styles.dualZone}>
        <Animated.View style={[styles.rotated180, panelFadeStyle, p2Elevated && styles.elevated]}>
          <ZoneBoundsProvider value={p2Bounds}>{p2}</ZoneBoundsProvider>
        </Animated.View>
        {sharedZone}
        <Animated.View style={[panelFadeStyle, p1Elevated && styles.elevated]}>
          <ZoneBoundsProvider value={p1Bounds}>{p1}</ZoneBoundsProvider>
        </Animated.View>
      </View>
    )
  }

  // Side-by-side: p1/p2 sit in a row below `shared` rather than stacked, so they share one and the
  // same boundary instead of splitting it.
  const rowBounds: ZoneBounds | null = sharedBounds && { rotated: false, sharedEdgeY: sharedBounds.bottom, zoneSide: 'belowShared' }

  return (
    <View style={styles.stackedZone}>
      {sharedZone}
      {/* One shared wrapper for both zones here (unlike faceToFace's separate p1/p2 Animated.Views
      above), so either zone having something open elevates the same row — see p1Elevated/p2Elevated's
      own doc for why a plain OR is correct rather than needing to tell the two apart. */}
      <Animated.View style={[styles.playersRow, panelFadeStyle, (p1Elevated || p2Elevated) && styles.elevated]}>
        <ZoneBoundsProvider value={rowBounds}>{panelLayout.p1OnRight ? p2 : p1}</ZoneBoundsProvider>
        <ZoneBoundsProvider value={rowBounds}>{panelLayout.p1OnRight ? p1 : p2}</ZoneBoundsProvider>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  dualZone: {
    alignItems: 'center',
    gap: 28
  },
  // Matches the zIndex every consuming app's own popover-elevation styles already use (e.g.
  // LightCycles' LobbyPlayerPanel panelOpen/LobbySharedControls containerOpen) — see
  // p1Elevated/p2Elevated/sharedElevated's own doc for why this component needs its own copy of
  // that same trick at the zone-wrapper level.
  elevated: {
    zIndex: 100
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
