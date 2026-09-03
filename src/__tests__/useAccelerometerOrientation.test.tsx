import { act, render, renderHook } from '@testing-library/react'
import { DeviceMotion } from 'expo-sensors'
import { Platform, useWindowDimensions } from 'react-native'

import { AccelerometerOrientationProvider, AccelerometerOrientationState, useAccelerometerOrientation } from '../useAccelerometerOrientation'

// Drives the single DeviceMotion listener AccelerometerOrientationProvider subscribes with,
// mirroring a real sensor sample arriving — gravity === null models a flat-on-a-table reading (no
// usable screen-plane signal at all), same shape emitted for an ambiguous/near-diagonal reading
// below.
function emit(gravity: { x: number; y: number } | null) {
  const listener = (DeviceMotion.addListener as jest.Mock).mock.calls[0][0]
  act(() => {
    listener({ accelerationIncludingGravity: gravity })
  })
}

// Every test needs the Provider mounted — useAccelerometerOrientation reads from its Context and
// silently never updates without one (see that hook's own doc).
const wrapper = AccelerometerOrientationProvider

function Consumer({ onValue }: { onValue: (value: AccelerometerOrientationState) => void }) {
  onValue(useAccelerometerOrientation())
  return null
}

describe('useAccelerometerOrientation', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    ;(DeviceMotion.addListener as jest.Mock).mockClear()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('starts unresolved with the same pre-resolution guess as the old useP1OnRight', () => {
    const { result } = renderHook(() => useAccelerometerOrientation(), { wrapper })
    expect(result.current).toEqual({ orientationMode: 'faceToFace', p1OnRight: true, upsideDown: false, resolved: false })
  })

  it('only commits a candidate once it has held steady past the debounce window', () => {
    const { result } = renderHook(() => useAccelerometerOrientation(), { wrapper })

    emit({ x: 8, y: 0 }) // sideBySide candidate
    expect(result.current.resolved).toBe(false)

    act(() => {
      jest.advanceTimersByTime(100)
    })
    emit({ x: 8, y: 0 }) // same candidate, but window hasn't elapsed yet
    expect(result.current.resolved).toBe(false)

    act(() => {
      jest.advanceTimersByTime(200)
    })
    emit({ x: 8, y: 0 }) // window has now elapsed on a subsequent sample of the same candidate
    expect(result.current).toEqual({ orientationMode: 'sideBySide', p1OnRight: true, upsideDown: false, resolved: true })
  })

  it('never commits a brief spike that reverts before the window elapses (the swipe-safety case)', () => {
    const { result } = renderHook(() => useAccelerometerOrientation(), { wrapper })

    emit({ x: 8, y: 0 }) // a jolt toward sideBySide
    act(() => {
      jest.advanceTimersByTime(50)
    })
    emit({ x: 0, y: -8 }) // reverts to faceToFace well before the spike's own window elapsed
    act(() => {
      jest.advanceTimersByTime(300)
    })
    emit({ x: 0, y: -8 })

    expect(result.current).toEqual({ orientationMode: 'faceToFace', p1OnRight: true, upsideDown: false, resolved: true })
  })

  it('holds the last committed value on an ambiguous reading, e.g. the phone lying flat', () => {
    const { result } = renderHook(() => useAccelerometerOrientation(), { wrapper })

    emit({ x: 8, y: 0 })
    act(() => {
      jest.advanceTimersByTime(300)
    })
    emit({ x: 8, y: 0 })
    expect(result.current.orientationMode).toBe('sideBySide')

    emit({ x: 0.01, y: 0.01 }) // flat on a table — magnitude below MIN_GRAVITY_MAGNITUDE
    act(() => {
      jest.advanceTimersByTime(300)
    })
    emit({ x: 0.01, y: 0.01 })

    expect(result.current).toEqual({ orientationMode: 'sideBySide', p1OnRight: true, upsideDown: false, resolved: true })
  })

  it('detects upside-down portrait as a distinct case from right-side-up', () => {
    const { result } = renderHook(() => useAccelerometerOrientation(), { wrapper })

    emit({ x: 0, y: 8 }) // y dominant, positive — upside-down per candidateFromGravity
    act(() => {
      jest.advanceTimersByTime(300)
    })
    emit({ x: 0, y: 8 })

    expect(result.current).toEqual({ orientationMode: 'faceToFace', p1OnRight: true, upsideDown: true, resolved: true })
  })

  it('freezes orientationMode/p1OnRight/upsideDown for a locked call site while an unlocked sibling keeps following', () => {
    // Two sibling consumers under the SAME Provider — renderHook's own `wrapper` option mounts a
    // fresh Provider (and fresh DeviceMotion subscription) per call, so two separate renderHook
    // calls would each get their own isolated Provider instead of actually sharing state.
    let lockedValue: AccelerometerOrientationState | undefined
    let liveValue: AccelerometerOrientationState | undefined
    let isLocked = true

    function LockedConsumer() {
      lockedValue = useAccelerometerOrientation(isLocked)
      return null
    }
    function LiveConsumer() {
      liveValue = useAccelerometerOrientation()
      return null
    }

    const { rerender } = render(
      <AccelerometerOrientationProvider>
        <LockedConsumer />
        <LiveConsumer />
      </AccelerometerOrientationProvider>
    )

    emit({ x: 8, y: 0 })
    act(() => {
      jest.advanceTimersByTime(300)
    })
    emit({ x: 8, y: 0 })
    expect(lockedValue).toEqual({ orientationMode: 'faceToFace', p1OnRight: true, upsideDown: false, resolved: false })
    expect(liveValue?.orientationMode).toBe('sideBySide')

    isLocked = false
    rerender(
      <AccelerometerOrientationProvider>
        <LockedConsumer />
        <LiveConsumer />
      </AccelerometerOrientationProvider>
    )
    expect(lockedValue?.orientationMode).toBe('sideBySide')
  })

  it('survives the consuming screen unmounting and remounting, as long as the Provider itself (mounted once, at the app root) stays up', () => {
    let latest: AccelerometerOrientationState | undefined
    const { rerender } = render(
      <AccelerometerOrientationProvider>
        <Consumer onValue={(value) => (latest = value)} />
      </AccelerometerOrientationProvider>
    )

    emit({ x: 8, y: 0 })
    act(() => {
      jest.advanceTimersByTime(300)
    })
    emit({ x: 8, y: 0 })
    expect(latest?.orientationMode).toBe('sideBySide')

    // Simulates navigating away — the screen consuming the hook unmounts, but the Provider (a
    // sibling of the router, mounted once at the app root — see AppRoot.tsx) is untouched by this
    // rerender, since it's the same element in the same tree position.
    rerender(<AccelerometerOrientationProvider>{null}</AccelerometerOrientationProvider>)
    // Simulates navigating to a new screen, which mounts a fresh consumer.
    rerender(
      <AccelerometerOrientationProvider>
        <Consumer onValue={(value) => (latest = value)} />
      </AccelerometerOrientationProvider>
    )

    expect(latest?.orientationMode).toBe('sideBySide')
  })

  // Same Platform.OS mutation convention as rotation.test.ts's own 'on web' block — mutate the
  // mocked module's property directly (not a fresh jest.mock, since every other test in this file
  // needs the native 'ios' default) and restore it afterward so this doesn't leak into them.
  describe('on web', () => {
    const originalOS = Platform.OS

    afterEach(() => {
      Platform.OS = originalOS
    })

    it('resolves sideBySide with p1OnRight false — left, not whatever the native accelerometer path defaults true to', () => {
      Platform.OS = 'web'
      ;(useWindowDimensions as jest.Mock).mockReturnValueOnce({ width: 900, height: 400, scale: 1, fontScale: 1 })
      const { result } = renderHook(() => useAccelerometerOrientation(), { wrapper })
      expect(result.current).toEqual({ orientationMode: 'sideBySide', p1OnRight: false, upsideDown: false, resolved: true })
    })

    it('resolves faceToFace for a taller-than-wide window, same as the mock default', () => {
      Platform.OS = 'web'
      const { result } = renderHook(() => useAccelerometerOrientation(), { wrapper })
      expect(result.current).toEqual({ orientationMode: 'faceToFace', p1OnRight: false, upsideDown: false, resolved: true })
    })
  })
})
