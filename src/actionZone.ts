import { OrientationMode } from './types'

// True when two players are sharing one device face-to-face — the one layout where a fixed corner
// (top-left/top-right) isn't reachable by both: one player's zone always reads upside-down there
// (see getOpposingZoneRotation), so a shared, vertically-centered position is the only place both
// players can reach right-side-up. Every other case — a single player (vsCpu, no second zone to
// keep neutral for) or sideBySide (each player already owns a dedicated screen half, so a fixed
// corner never falls inside the OTHER player's rotated zone) — can use plain fixed corners instead.
//
// Deliberately takes orientationMode as already-resolved state rather than reading
// useAccelerometerOrientation itself, and deliberately has no Platform.OS check of its own —
// orientationMode already resolves correctly on web (a narrow/tall browser window reads
// 'faceToFace' same as a handheld phone would; a wide one reads 'sideBySide' same as a landscape
// hold — see useAccelerometerOrientation's own web fallback), so a bare web check here would wrongly
// force corner placement on a genuinely face-to-face mobile-web session. This was gotten wrong once
// (LightCycles' own in-match action buttons briefly forced corners on ANY web session, putting them
// in a spot that only made sense once mobile web's own upside-down far-player zone was ignored) —
// baked in as this function's own shape so every caller gets it right by construction instead of
// re-deriving the same three-way OR/AND by hand.
export function needsSharedNeutralZone(orientationMode: OrientationMode, humanPlayerCount: number): boolean {
  return humanPlayerCount > 1 && orientationMode === 'faceToFace'
}
