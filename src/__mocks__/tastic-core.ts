// Real @tastic/core's package.json "browser"/"react-native" export conditions point at its own raw
// .ts source (so bundlers can inline it) rather than the compiled dist — jsdom's default
// customExportConditions includes "browser", so plain resolution hands Jest that raw source, which
// ts-jest then refuses to transform (transformIgnorePatterns excludes node_modules by default).
// Mocked instead of fighting that config, same approach @tastic/hud's own identical mock takes.
//
// The pure rotation/inset functions are trivial enough to just reimplement verbatim (this package's
// own FakeLandscapeView needs REAL results from these, not a stub — see its test file's existing
// 0°/90°/-90°/180° cases). useOrientationState is stubbed instead: every existing FakeLandscapeView
// test passes its own explicit orientationMode/p1OnRight/upsideDown props, so the ambient value is
// never actually read in practice — a test asserting the new ambient-default path overrides this
// per-case via mockReturnValueOnce/mockReturnValue.
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

export const useOrientationState = jest.fn(() => ({ orientationMode: 'faceToFace' as const, p1OnRight: true, upsideDown: false, resolved: true }))

export const useRotation = jest.fn(() => 0)
