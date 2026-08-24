import { renderHook } from '@testing-library/react'

import { useDualZoneLayout } from '../useDualZoneLayout'
import { OrientationMode } from '../useDeviceOrientation'

describe('useDualZoneLayout', () => {
  it('starts committed to whatever orientation/side it was first rendered with', () => {
    const { result } = renderHook(() => useDualZoneLayout('faceToFace', true, true))
    expect(result.current.panelLayout).toEqual({ orientationMode: 'faceToFace', p1OnRight: true })
  })

  it('snaps straight to the corrected value on first resolve, without treating it as a rotation', () => {
    // p1OnRight starts as a guess (true) before useP1OnRight's own check resolves — this mirrors
    // that guess landing wrong (resolving to false) on the very first render.
    const { result, rerender } = renderHook(({ p1OnRight, resolved }) => useDualZoneLayout('faceToFace', p1OnRight, resolved), {
      initialProps: { p1OnRight: true, resolved: false }
    })
    expect(result.current.panelLayout.p1OnRight).toBe(true)

    rerender({ p1OnRight: false, resolved: true })
    expect(result.current.panelLayout).toEqual({ orientationMode: 'faceToFace', p1OnRight: false })
  })

  it('commits an actual rotation (already resolved) to the new orientation', () => {
    const { result, rerender } = renderHook(({ orientationMode }: { orientationMode: OrientationMode }) => useDualZoneLayout(orientationMode, true, true), {
      initialProps: { orientationMode: 'faceToFace' }
    })
    expect(result.current.panelLayout.orientationMode).toBe('faceToFace')

    rerender({ orientationMode: 'sideBySide' })
    expect(result.current.panelLayout.orientationMode).toBe('sideBySide')
  })

  it('leaves panelLayout untouched when nothing has actually changed', () => {
    const { result, rerender } = renderHook(() => useDualZoneLayout('faceToFace', true, true))
    const first = result.current.panelLayout

    rerender()
    expect(result.current.panelLayout).toBe(first)
  })
})
