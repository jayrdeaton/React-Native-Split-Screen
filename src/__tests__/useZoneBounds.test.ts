import { renderHook } from '@testing-library/react'
import { createElement } from 'react'

import { useZoneBounds, ZoneBoundsProvider } from '../useZoneBounds'

describe('useZoneBounds', () => {
  it('returns null outside a DualZoneLayout zone', () => {
    const { result } = renderHook(() => useZoneBounds())
    expect(result.current).toBeNull()
  })

  it('returns whatever bounds the nearest zone provides', () => {
    const { result } = renderHook(() => useZoneBounds(), {
      wrapper: ({ children }) => createElement(ZoneBoundsProvider, { value: { rotated: false, sharedEdgeY: 240, zoneSide: 'belowShared' } }, children)
    })
    expect(result.current).toEqual({ rotated: false, sharedEdgeY: 240, zoneSide: 'belowShared' })
  })
})
