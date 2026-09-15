// Real @tastic/core's package.json "browser"/"react-native" export conditions point at its own raw
// .ts source (so bundlers can inline it) rather than the compiled dist — jsdom's default
// customExportConditions includes "browser", so plain resolution hands Jest that raw source, which
// ts-jest then refuses to transform (transformIgnorePatterns excludes node_modules by default).
// Mocked instead of fighting that config, same approach @tastic/hud's own identical mock takes.
//
// FakeLandscapeView (the one component here that used to need REAL results from the pure rotation
// functions below, not a stub) moved to @tastic/core itself as of core 0.5.0 — full behavioral
// coverage for it now lives in core's own suite, exercising the real implementation directly, not
// this mock. The pure functions are kept here (reimplemented verbatim, still real results) because
// compatExports.test.ts's own re-export check needs this mock's shape to match — and useOrientationState
// is still stubbed rather than reimplemented, since nothing left in this package's own tests needs its
// full committed-reading behavior (that's core's own test suite's job now too).
export type ViewRotation = 0 | 90 | 180 | -90

export function getViewRotation(orientationMode: 'faceToFace' | 'sideBySide', p1OnRight: boolean, upsideDown: boolean): ViewRotation {
  if (orientationMode === 'sideBySide') return p1OnRight ? -90 : 90
  return upsideDown ? 180 : 0
}

export function getFixedZoneRotation(orientationMode: 'faceToFace' | 'sideBySide', p1OnRight: boolean, upsideDown: boolean): ViewRotation {
  return orientationMode === 'sideBySide' ? getViewRotation(orientationMode, p1OnRight, upsideDown) : 0
}

export function getOpposingZoneRotation(rotation: ViewRotation): ViewRotation {
  if (Math.abs(rotation) === 90) return rotation
  return rotation === 0 ? 180 : 0
}

export interface EdgeInsets {
  top: number
  right: number
  bottom: number
  left: number
}

const COMPASS: (keyof EdgeInsets)[] = ['top', 'right', 'bottom', 'left']

export function rotateInsets(insets: EdgeInsets, rotation: ViewRotation): EdgeInsets {
  const steps = (((rotation / 90) % 4) + 4) % 4
  const edgeFor = (visualEdge: keyof EdgeInsets) => insets[COMPASS[(COMPASS.indexOf(visualEdge) + steps) % 4]]
  return { top: edgeFor('top'), right: edgeFor('right'), bottom: edgeFor('bottom'), left: edgeFor('left') }
}

export function rotateDimensions(width: number, height: number, rotation: ViewRotation): { width: number; height: number } {
  return Math.abs(rotation) === 90 ? { width: height, height: width } : { width, height }
}

export const useOrientationState = jest.fn(() => ({ orientationMode: 'faceToFace' as const, p1OnRight: true, upsideDown: false, resolved: true }))

export const useRotation = jest.fn(() => 0)

export const useRotatedWindowDimensions = jest.fn(() => ({ width: 402, height: 874 }))
