import * as index from '../index'

// Orientation-tracking moved to @tastic/core as of 0.4.0 (see index.ts's own top comment). This
// file's jest config maps '@tastic/core' to a manual mock (needed for FakeLandscapeView.test.tsx's
// own controllable ambient reads), so a behavioral test here would exercise the MOCK, not the real
// package — exactly backwards for a test whose whole point is guarding the re-export wiring itself.
// jest.requireActual bypasses that mapping just for this file, to assert against the real thing.
// Full behavioral coverage for each of these already lives in @tastic/core's own test suite.
const realCore = jest.requireActual('@tastic/core')

describe('@tastic/core re-exports (backward compatibility)', () => {
  it('re-exports the pure rotation/inset functions under their original names, identical to the real implementation', () => {
    expect(index.getViewRotation).toBe(realCore.getViewRotation)
    expect(index.getFixedZoneRotation).toBe(realCore.getFixedZoneRotation)
    expect(index.getOpposingZoneRotation).toBe(realCore.getOpposingZoneRotation)
    expect(index.rotateInsets).toBe(realCore.rotateInsets)
    expect(index.rotateDimensions).toBe(realCore.rotateDimensions)
  })

  it('re-exports the orientation Provider/hook/snapshot under their original Accelerometer-prefixed names, identical to the real implementation', () => {
    expect(index.AccelerometerOrientationProvider).toBe(realCore.OrientationProvider)
    expect(index.useAccelerometerOrientation).toBe(realCore.useOrientationState)
    expect(index.getAccelerometerOrientationSnapshot).toBe(realCore.getOrientationSnapshot)
  })

  it('also re-exports the new useRotation convenience hook for a consumer that wants to adopt it directly', () => {
    expect(index.useRotation).toBe(realCore.useRotation)
  })

  // FakeLandscapeView moved here from this package's own src/ as of core 0.5.0 (see index.ts's own
  // updated top comment) — it never had any real dependency on this package's two-player pieces, so
  // this compat re-export is now checked the exact same way as every other moved-to-core primitive
  // above, not tested behaviorally in this package anymore (full coverage lives in core's own suite).
  it('re-exports FakeLandscapeView (moved to core in 0.5.0) and useRotatedWindowDimensions under their original names, identical to the real implementation', () => {
    expect(index.FakeLandscapeView).toBe(realCore.FakeLandscapeView)
    expect(index.useRotatedWindowDimensions).toBe(realCore.useRotatedWindowDimensions)
  })
})
