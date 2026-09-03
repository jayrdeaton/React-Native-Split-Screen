import { act, render } from '@testing-library/react'

import { View } from '../__mocks__/react-native'
import Animated from '../__mocks__/react-native-reanimated'
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

// Style props render as an array (`[styles.x, panelFadeStyle, cond && styles.elevated]`), not a
// flattened object — this mock's own StyleSheet.create/flatten are both identity (see
// __mocks__/react-native.ts), matching real RN's own array-of-styles prop shape closely enough to
// assert against directly rather than needing a real flatten step.
function hasElevatedStyle(style: unknown): boolean {
  const styles = Array.isArray(style) ? style : [style]
  return styles.some((entry) => !!entry && typeof entry === 'object' && (entry as { zIndex?: number }).zIndex === 100)
}

describe('DualZoneLayout', () => {
  beforeEach(() => {
    View.mockClear()
    Animated.View.mockClear()
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

  // Regression coverage for a real bug: a shared-row popover (e.g. an arena/settings dropdown)
  // rendering underneath a player zone's own controls instead of on top of them, because neither
  // zone wrapper had any way to know the other zone's popover was open — see p1Elevated/p2Elevated/
  // sharedElevated's own doc on DualZoneLayout's Props for the stacking-context mechanism behind it.
  describe('zone elevation (p1Elevated/p2Elevated/sharedElevated)', () => {
    it('leaves the shared zone unelevated by default, and elevated once sharedElevated is set', () => {
      const unelevated = render(<DualZoneLayout panelLayout={panelLayout({ orientationMode: 'sideBySide' })} panelFadeStyle={{}} p1='p1' p2='p2' shared='shared' />)
      const sharedCall = View.mock.calls.find(([props]) => typeof props?.onLayout === 'function')
      expect(hasElevatedStyle(sharedCall?.[0]?.style)).toBe(false)
      unelevated.unmount()
      View.mockClear()

      render(<DualZoneLayout panelLayout={panelLayout({ orientationMode: 'sideBySide' })} panelFadeStyle={{}} p1='p1' p2='p2' shared='shared' sharedElevated />)
      const elevatedSharedCall = View.mock.calls.find(([props]) => typeof props?.onLayout === 'function')
      expect(hasElevatedStyle(elevatedSharedCall?.[0]?.style)).toBe(true)
    })

    it('elevates the one shared players row in side-by-side mode when either seat is elevated', () => {
      render(<DualZoneLayout panelLayout={panelLayout({ orientationMode: 'sideBySide' })} panelFadeStyle={{}} p1='p1' p2='p2' shared='shared' p1Elevated />)
      // Side-by-side has exactly one Animated.View — the shared players row — so its one and only
      // call is what p1Elevated (or p2Elevated) needs to reach, regardless of which seat it's for.
      expect(Animated.View.mock.calls).toHaveLength(1)
      expect(hasElevatedStyle(Animated.View.mock.calls[0]?.[0]?.style)).toBe(true)
    })

    it('leaves the players row unelevated in side-by-side mode when neither seat is elevated', () => {
      render(<DualZoneLayout panelLayout={panelLayout({ orientationMode: 'sideBySide' })} panelFadeStyle={{}} p1='p1' p2='p2' shared='shared' />)
      expect(hasElevatedStyle(Animated.View.mock.calls[0]?.[0]?.style)).toBe(false)
    })

    it("elevates only p2's own zone in face-to-face mode when p2Elevated is set, leaving p1's alone", () => {
      render(<DualZoneLayout panelLayout={panelLayout()} panelFadeStyle={{}} p1='p1' p2='p2' shared='shared' p2Elevated />)
      // Face-to-face renders p2's zone first (top, rotated), then p1's (bottom) — see the component's
      // own JSX order, which a single synchronous render preserves in Animated.View.mock.calls.
      const [p2Call, p1Call] = Animated.View.mock.calls
      expect(hasElevatedStyle(p2Call?.[0]?.style)).toBe(true)
      expect(hasElevatedStyle(p1Call?.[0]?.style)).toBe(false)
    })

    it("elevates only p1's own zone in face-to-face mode when p1Elevated is set, leaving p2's alone", () => {
      render(<DualZoneLayout panelLayout={panelLayout()} panelFadeStyle={{}} p1='p1' p2='p2' shared='shared' p1Elevated />)
      const [p2Call, p1Call] = Animated.View.mock.calls
      expect(hasElevatedStyle(p2Call?.[0]?.style)).toBe(false)
      expect(hasElevatedStyle(p1Call?.[0]?.style)).toBe(true)
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
