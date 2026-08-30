import { act, render } from '@testing-library/react'

import { View } from '../__mocks__/react-native'
import { DualZoneLayout } from '../DualZoneLayout'
import { DualZoneLayoutState } from '../useDualZoneLayout'
import { useZoneBounds, ZoneBounds } from '../useZoneBounds'

// Same shape the mocked View hands back through `ref.measureInWindow` — see
// src/__mocks__/react-native.ts's FAKE_MEASURED_RECT. y=120, height=48, so bottom = 168.
const MEASURED_TOP = 120
const MEASURED_BOTTOM = 168

// Fires the sharedZone wrapper's onLayout — the one View.mock call that received an onLayout prop
// — which is what actually triggers measureShared in real usage (the shared row's own layout
// landing after mount). Wrapped in act() since it drives a setState (sharedBounds).
function measureSharedZone() {
  const sharedZoneCall = View.mock.calls.find(([props]) => typeof props?.onLayout === 'function')
  act(() => {
    sharedZoneCall?.[0]?.onLayout?.()
  })
}

// Mirrors the 'Consumer' pattern in useAccelerometerOrientation.test.tsx — there's no DOM way to
// read a React context from outside, so this renders as one of p1/p2/shared and reports whatever
// bounds it sees via a callback instead.
function BoundsProbe({ label, onValue }: { label: string; onValue: (value: ZoneBounds | null) => void }) {
  onValue(useZoneBounds())
  return label
}

function panelLayout(overrides: Partial<DualZoneLayoutState> = {}): DualZoneLayoutState {
  return { orientationMode: 'faceToFace', p1OnRight: true, upsideDown: false, ...overrides }
}

describe('DualZoneLayout', () => {
  beforeEach(() => {
    View.mockClear()
  })

  describe('faceToFace', () => {
    it('stacks p2 (rotated, top) above the shared row, with p1 (unrotated) below it', () => {
      const { container } = render(<DualZoneLayout panelLayout={panelLayout()} panelFadeStyle={{}} p1='p1-content' p2='p2-content' shared='shared-content' />)
      const text = container.textContent ?? ''

      expect(text.indexOf('p2-content')).toBeLessThan(text.indexOf('shared-content'))
      expect(text.indexOf('shared-content')).toBeLessThan(text.indexOf('p1-content'))
    })

    it('leaves both zones without bounds until the shared row has actually measured itself', () => {
      let p1Bounds: ZoneBounds | null | undefined
      let p2Bounds: ZoneBounds | null | undefined

      render(<DualZoneLayout panelLayout={panelLayout()} panelFadeStyle={{}} p1={<BoundsProbe label='p1' onValue={(value) => (p1Bounds = value)} />} p2={<BoundsProbe label='p2' onValue={(value) => (p2Bounds = value)} />} />)

      expect(p1Bounds).toBeNull()
      expect(p2Bounds).toBeNull()
    })

    it("gives p2 the shared row's top edge and p1 its bottom edge once measured, right-side-up", () => {
      let p1Bounds: ZoneBounds | null | undefined
      let p2Bounds: ZoneBounds | null | undefined

      render(<DualZoneLayout panelLayout={panelLayout({ upsideDown: false })} panelFadeStyle={{}} p1={<BoundsProbe label='p1' onValue={(value) => (p1Bounds = value)} />} p2={<BoundsProbe label='p2' onValue={(value) => (p2Bounds = value)} />} />)
      measureSharedZone()

      // p2's own 180° cancels the (absent, upsideDown=false) outer flip back to true here — see
      // DualZoneLayout's own doc for why this is XOR'd rather than hardcoded per zone.
      expect(p2Bounds).toEqual({ rotated: true, sharedEdgeY: MEASURED_TOP, zoneSide: 'aboveShared' })
      expect(p1Bounds).toEqual({ rotated: false, sharedEdgeY: MEASURED_BOTTOM, zoneSide: 'belowShared' })
    })

    it('flips which zone reads as rotated once the caller reports the device held upside down', () => {
      let p1Bounds: ZoneBounds | null | undefined
      let p2Bounds: ZoneBounds | null | undefined

      render(<DualZoneLayout panelLayout={panelLayout({ upsideDown: true })} panelFadeStyle={{}} p1={<BoundsProbe label='p1' onValue={(value) => (p1Bounds = value)} />} p2={<BoundsProbe label='p2' onValue={(value) => (p2Bounds = value)} />} />)
      measureSharedZone()

      // Same measured edges as the right-side-up case — only `rotated` swaps, for both zones.
      expect(p2Bounds).toEqual({ rotated: false, sharedEdgeY: MEASURED_TOP, zoneSide: 'aboveShared' })
      expect(p1Bounds).toEqual({ rotated: true, sharedEdgeY: MEASURED_BOTTOM, zoneSide: 'belowShared' })
    })
  })

  describe('sideBySide', () => {
    it('puts p2 on the left when p1OnRight says p1 belongs on the right', () => {
      const { container } = render(<DualZoneLayout panelLayout={panelLayout({ orientationMode: 'sideBySide', p1OnRight: true })} panelFadeStyle={{}} p1='p1-content' p2='p2-content' shared='shared-content' />)
      const text = container.textContent ?? ''

      expect(text.indexOf('shared-content')).toBeLessThan(text.indexOf('p2-content'))
      expect(text.indexOf('p2-content')).toBeLessThan(text.indexOf('p1-content'))
    })

    it('puts p1 on the left when p1OnRight says p1 belongs on the left instead', () => {
      const { container } = render(<DualZoneLayout panelLayout={panelLayout({ orientationMode: 'sideBySide', p1OnRight: false })} panelFadeStyle={{}} p1='p1-content' p2='p2-content' shared='shared-content' />)
      const text = container.textContent ?? ''

      expect(text.indexOf('shared-content')).toBeLessThan(text.indexOf('p1-content'))
      expect(text.indexOf('p1-content')).toBeLessThan(text.indexOf('p2-content'))
    })

    it("gives both zones the same unrotated bounds along the shared row's bottom edge once measured", () => {
      let p1Bounds: ZoneBounds | null | undefined
      let p2Bounds: ZoneBounds | null | undefined

      render(<DualZoneLayout panelLayout={panelLayout({ orientationMode: 'sideBySide', p1OnRight: false })} panelFadeStyle={{}} p1={<BoundsProbe label='p1' onValue={(value) => (p1Bounds = value)} />} p2={<BoundsProbe label='p2' onValue={(value) => (p2Bounds = value)} />} />)
      expect(p1Bounds).toBeNull()
      expect(p2Bounds).toBeNull()

      measureSharedZone()

      // Unlike faceToFace, side-by-side never rotates either zone, so both share one identical
      // ZoneBounds rather than splitting the shared row's top/bottom edges between them.
      const rowBounds = { rotated: false, sharedEdgeY: MEASURED_BOTTOM, zoneSide: 'belowShared' }
      expect(p1Bounds).toEqual(rowBounds)
      expect(p2Bounds).toEqual(rowBounds)
    })
  })

  it('always renders the shared content, regardless of which orientation branch is active', () => {
    const faceToFace = render(<DualZoneLayout panelLayout={panelLayout()} panelFadeStyle={{}} p1='p1' p2='p2' shared='shared-marker' />)
    expect(faceToFace.container.textContent).toContain('shared-marker')
    faceToFace.unmount()

    const sideBySide = render(<DualZoneLayout panelLayout={panelLayout({ orientationMode: 'sideBySide' })} panelFadeStyle={{}} p1='p1' p2='p2' shared='shared-marker' />)
    expect(sideBySide.container.textContent).toContain('shared-marker')
  })

  it('renders with no shared content at all, since the prop is optional', () => {
    const { container } = render(<DualZoneLayout panelLayout={panelLayout()} panelFadeStyle={{}} p1='p1-content' p2='p2-content' />)
    expect(container.textContent).toBe('p2-contentp1-content')
  })
})
