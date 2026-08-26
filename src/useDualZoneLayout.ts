import { useCallback, useState } from 'react'
import { runOnJS, useAnimatedReaction, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'

import { OrientationMode } from './types'

export interface DualZoneLayoutState {
  orientationMode: OrientationMode
  p1OnRight: boolean
  // Only meaningful when orientationMode === 'faceToFace' — see useAccelerometerOrientation and
  // getViewRotation. Carried through this same commit/fade mechanism (rather than tracked
  // separately, live) so a FakeLandscapeView driven by this committed state stays in lockstep with
  // whichever arrangement DualZoneLayout itself is actually painting, mid-fade included.
  upsideDown: boolean
}

const DEFAULT_FADE_MS = 200

// Committed layout state (which branch renders, which side each player is on) plus the opacity
// style to drive a fade across a mid-lobby rotation — factored out of the rendering itself (see
// DualZoneLayout) because callers typically need this same committed state for more than the
// layout: e.g. sizing a press-away zone rect to match whichever side is currently on screen (see
// this package's README) needs to agree with the *painted* layout, not the live device orientation,
// mid-fade included.
//
// The returned `panelLayout` deliberately lags one fade behind the live `orientationMode`/
// `p1OnRight` passed in — a rotation fades the old layout out, swaps the underlying content, then
// fades the new one in, rather than snapping instantly (which reads as content teleporting/
// flickering mid-rotation, since native panel content can reflow a frame or two before the fade
// visually covers it).
export function useDualZoneLayout(orientationMode: OrientationMode, p1OnRight: boolean, p1OnRightResolved: boolean, upsideDown = false, fadeDurationMs = DEFAULT_FADE_MS): { panelLayout: DualZoneLayoutState; panelFadeStyle: ReturnType<typeof useAnimatedStyle> } {
  // The panel area's own layout lags one fade behind the live orientationMode/p1OnRight/upsideDown
  // above — see panelOpacity below.
  const [panelLayout, setPanelLayout] = useState<DualZoneLayoutState>({ orientationMode, p1OnRight, upsideDown })
  const panelOpacity = useSharedValue(1)

  // Committing the swap (setPanelLayout) and starting the fade back in used to both live inside the
  // reaction below, on the theory that comparing live values against the already-committed
  // panelLayout would keep the fade-in from firing until the new layout was "the one on screen." In
  // practice it wasn't: setPanelLayout finishing on the JS thread only means React has reconciled
  // the new prop order, not that Fabric has actually mounted/painted it — the panelOpacity fade-in,
  // being a UI-thread worklet, can start climbing back to 1 a frame or two before that native paint
  // catches up, so the swap becomes visible mid-fade instead of hidden behind it. commitPanelSwap
  // below inserts an explicit couple of frames between the commit and the reveal so the reveal
  // always starts after the swap has actually landed on screen; the reaction below only ever kicks
  // off the fade *out*.
  const commitPanelSwap = useCallback(
    (nextOrientationMode: OrientationMode, nextP1OnRight: boolean, nextUpsideDown: boolean) => {
      setPanelLayout({ orientationMode: nextOrientationMode, p1OnRight: nextP1OnRight, upsideDown: nextUpsideDown })
      // Double rAF, not a single one: the first only guarantees this render has been requested,
      // not that Fabric has mounted/painted it. Waiting a further frame is what actually gives the
      // native side time to flush the swapped panel content before we start revealing it.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          panelOpacity.value = withTiming(1, { duration: fadeDurationMs })
        })
      })
    },
    [panelOpacity, fadeDurationMs]
  )

  useAnimatedReaction(
    () => {
      if (!p1OnRightResolved) return 'unresolved'
      return `${orientationMode}:${p1OnRight}:${upsideDown}` === `${panelLayout.orientationMode}:${panelLayout.p1OnRight}:${panelLayout.upsideDown}` ? 'match' : 'mismatch'
    },
    (phase, previousPhase) => {
      if (previousPhase === null || phase !== 'mismatch' || phase === previousPhase) return
      // The 'unresolved' phase exists so a fresh mount doesn't itself fade: p1OnRight starts as a
      // guess (see useP1OnRight) and corrects itself moments later once its own initial orientation
      // check resolves — that correction isn't a real rotation, so it snaps straight to the right
      // layout instead of fading like an actual mid-lobby rotation would.
      if (previousPhase === 'unresolved') {
        runOnJS(setPanelLayout)({ orientationMode, p1OnRight, upsideDown })
        return
      }
      panelOpacity.value = withTiming(0, { duration: fadeDurationMs }, (finished) => {
        if (finished) runOnJS(commitPanelSwap)(orientationMode, p1OnRight, upsideDown)
      })
    }
  )

  const panelFadeStyle = useAnimatedStyle(() => ({ opacity: panelOpacity.value }))

  return { panelLayout, panelFadeStyle }
}
