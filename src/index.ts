// Orientation-tracking (the sensor Provider/hook and the pure rotation/inset math) moved to
// @tastic/core as of 0.4.0 — @tastic/hud's own components need the same rotation reading with no
// reason to depend on a two-player split-screen layout engine to get it, so it now lives in the
// lower-level package both this package and hud already sit above (hud) or now sit above too
// (split-screen, as of this version). Re-exported here under the original names so every existing
// consumer's `import {...} from '@tastic/split-screen'` keeps working unchanged — this is a minor,
// non-breaking release. New consumers should prefer importing directly from @tastic/core (as
// `useOrientationState`/`OrientationProvider`/etc.) and reach for @tastic/split-screen only for the
// genuinely two-player-specific pieces below (DualZoneLayout and friends).
export { needsSharedNeutralZone } from './actionZone'
export { DualZoneLayout } from './DualZoneLayout'
export { FakeLandscapeView, type FakeLandscapeViewProps } from './FakeLandscapeView'
export { type DualZoneLayoutState, useDualZoneLayout } from './useDualZoneLayout'
export { useZoneBounds, type ZoneBounds } from './useZoneBounds'
export { OrientationProvider as AccelerometerOrientationProvider, type OrientationState as AccelerometerOrientationState, type EdgeInsets, getOrientationSnapshot as getAccelerometerOrientationSnapshot, getFixedZoneRotation, getOpposingZoneRotation, getViewRotation, type OrientationMode, rotateInsets, useOrientationState as useAccelerometerOrientation, useRotation, type ViewRotation } from '@tastic/core'
