export enum Orientation {
  UNKNOWN = 0,
  PORTRAIT_UP = 1,
  PORTRAIT_DOWN = 2,
  LANDSCAPE_LEFT = 3,
  LANDSCAPE_RIGHT = 4
}

export enum OrientationLock {
  DEFAULT = 0,
  ALL = 1,
  PORTRAIT = 2,
  PORTRAIT_UP = 3,
  LANDSCAPE = 5
}

export const getOrientationAsync = jest.fn(() => Promise.resolve(Orientation.PORTRAIT_UP))
export const addOrientationChangeListener = jest.fn(() => ({ remove: jest.fn() }))
export const removeOrientationChangeListener = jest.fn()
export const lockAsync = jest.fn(() => Promise.resolve())
export const unlockAsync = jest.fn(() => Promise.resolve())

export interface Subscription {
  remove: () => void
}
