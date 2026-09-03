import React, { useEffect, useRef, useState } from 'react'

const identity = (x: any) => x

// A jest.fn() (not a plain arrow function) so DualZoneLayout.test.tsx can inspect which style each
// call received — e.g. its own elevated-zone tests, which assert a caller's p1Elevated/p2Elevated
// actually reaches the right zone's Animated.View, the same way View below already lets
// DualZoneLayout.test.tsx inspect the plain shared-zone wrapper's style/onLayout.
const Animated = {
  View: jest.fn(({ children }: { children?: React.ReactNode; style?: unknown }) => children ?? null)
}

export default Animated

// Test-only instrumentation: every useAnimatedReaction registers a runner here, and every
// shared-value write notifies all of them — a coarse stand-in for the real UI-thread frame loop
// that's good enough for these hook tests.
const reactionRunners = new Set<() => void>()
const notifyReactions = () => reactionRunners.forEach((run) => run())

// Real reanimated shared values are stable across re-renders (ref-like): mirror that here so
// memoization deps that include a shared value behave correctly. The setter also notifies
// useAnimatedReaction subscribers synchronously, mirroring how a worklet mutating .value on the
// UI thread drives reactions in the real library.
export const useSharedValue = (init: any) => {
  const [shared] = useState(() => {
    let current = init
    return {
      get value() {
        return current
      },
      set value(next: any) {
        current = next
        notifyReactions()
      }
    }
  })
  return shared
}
export const useAnimatedStyle = (fn: () => any) => fn()
export const useAnimatedReaction = (prepare: () => any, react: (curr: any, prev: any) => void) => {
  const stateRef = useRef<{ hasRun: boolean; prev: any; running: boolean }>({ hasRun: false, prev: undefined, running: false })

  useEffect(() => {
    const run = () => {
      // `react` here can itself write to a shared value (e.g. withTiming inside the callback),
      // which synchronously re-notifies every runner — including this one, re-entrantly, while
      // the outer call is still executing. The real library schedules that on the UI-thread frame
      // loop instead of recursing; this guard is this mock's stand-in for that, and recording the
      // transition as handled *before* calling `react` (not after) is what keeps a re-entrant call
      // from seeing the same not-yet-applied transition and firing all over again once `running`
      // clears.
      if (stateRef.current.running) return
      stateRef.current.running = true
      try {
        const curr = prepare()
        if (!stateRef.current.hasRun || curr !== stateRef.current.prev) {
          const prev = stateRef.current.hasRun ? stateRef.current.prev : undefined
          stateRef.current.hasRun = true
          stateRef.current.prev = curr
          react(curr, prev)
        }
      } finally {
        stateRef.current.running = false
      }
    }
    reactionRunners.add(run)
    run()
    return () => {
      reactionRunners.delete(run)
    }
  })
}
export const withTiming = (toValue: any, _config?: any, callback?: any) => {
  callback?.(true)
  return toValue
}
export const withSpring = identity
export const runOnJS = (fn: any) => fn
