import React from 'react'

const StyleSheet = {
  create: <T extends object>(styles: T): T => styles,
  flatten: (style: unknown) => style
}

export { StyleSheet }

// Fake measured node handed back through a `ref` prop below — just enough of the real View's
// imperative handle for DualZoneLayout's measureShared to call.
interface FakeViewNode {
  measureInWindow: (callback: (x: number, y: number, width: number, height: number) => void) => void
}

const FAKE_MEASURED_RECT = { height: 48, width: 300, x: 0, y: 120 }

// Loosely typed to match whatever a real ViewProps caller actually passes (style/onLayout
// included) — this mock only acts on children/ref, but DualZoneLayout.test.tsx reads onLayout back
// off View.mock.calls itself to drive the measure cycle by hand.
interface FakeViewProps {
  children?: React.ReactNode
  onLayout?: () => void
  ref?: React.Ref<FakeViewNode>
  style?: unknown
}

// React 19: a plain (non-forwardRef) function component receives `ref` as an ordinary prop, so this
// stub is responsible for honoring it itself — a real View would attach its native handle instead.
// Guarded so every other test in the suite, which never passes ref, is unaffected.
const viewStub = ({ children, ref }: FakeViewProps) => {
  if (ref) {
    const node: FakeViewNode = {
      measureInWindow: (callback) => callback(FAKE_MEASURED_RECT.x, FAKE_MEASURED_RECT.y, FAKE_MEASURED_RECT.width, FAKE_MEASURED_RECT.height)
    }
    if (typeof ref === 'function') ref(node)
    else (ref as React.RefObject<FakeViewNode | null>).current = node
  }
  return children ?? null
}

export const View = jest.fn(viewStub)
export const useWindowDimensions = jest.fn(() => ({ width: 402, height: 874, scale: 3, fontScale: 1 }))
export const Platform = { OS: 'ios' as const }
