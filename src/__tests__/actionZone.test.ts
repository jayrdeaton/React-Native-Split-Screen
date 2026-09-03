import { needsSharedNeutralZone } from '../actionZone'

describe('needsSharedNeutralZone', () => {
  it('is true only for two-plus players held faceToFace', () => {
    expect(needsSharedNeutralZone('faceToFace', 2)).toBe(true)
  })

  it('is false for a single player, regardless of orientationMode', () => {
    expect(needsSharedNeutralZone('faceToFace', 1)).toBe(false)
    expect(needsSharedNeutralZone('sideBySide', 1)).toBe(false)
  })

  it('is false for sideBySide, regardless of player count', () => {
    expect(needsSharedNeutralZone('sideBySide', 2)).toBe(false)
  })
})
