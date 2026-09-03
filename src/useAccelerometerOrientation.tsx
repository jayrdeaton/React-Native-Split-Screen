import { DeviceMotion } from 'expo-sensors'
import { createContext, ReactNode, useContext, useEffect, useState } from 'react'
import { Platform, useWindowDimensions } from 'react-native'

import { OrientationMode } from './types'

export interface AccelerometerOrientationState {
  orientationMode: OrientationMode
  // Only meaningful when orientationMode === 'sideBySide'.
  p1OnRight: boolean
  // Only meaningful when orientationMode === 'faceToFace' — sideBySide's own upside-down case is
  // already fully described by p1OnRight (there's no separate "upside-down landscape" state; a
  // dominant x-axis reading only ever resolves to one of the two landscape directions). See
  // getViewRotation for how this and p1OnRight combine into an actual rotation angle.
  upsideDown: boolean
  // False only until the first confident reading lands — see candidateFromGravity.
  resolved: boolean
}

const DEFAULT_STATE: AccelerometerOrientationState = { orientationMode: 'faceToFace', p1OnRight: true, upsideDown: false, resolved: false }

// Mutable, module-level — deliberately NOT React state/context. Kept in sync (see
// useAccelerometerOrientationSource's own setState calls) purely so getAccelerometerOrientationSnapshot
// can hand back "whatever the shared reading currently is" to a caller that must NOT subscribe to
// live updates — see that function's own doc for why plain useAccelerometerOrientation can't do
// this job: calling useContext, even just to seed a useState initializer that itself never changes
// again, still subscribes the calling component to every future update, and React re-renders that
// whole component (and everything under it) on each one regardless of whether its own derived state
// ends up different. There is exactly one app instance at a time in a React Native app, which is
// what makes a plain module-level variable safe here (no multi-instance/SSR concern to worry about).
let latestSnapshot = DEFAULT_STATE

// A one-time, non-subscribing read of the shared accelerometer reading — for a caller that only
// needs "whatever this currently is" once (e.g. to seed a lazy useState initializer that freezes a
// value for a match's whole duration) and must never re-render just because the phone moved. Plain
// useAccelerometerOrientation() cannot serve this: it calls useContext internally, and useContext
// subscribes its caller to every future Provider update for the component's entire lifetime, with
// no way to "read once and unsubscribe" — the calling component re-renders on every commit
// regardless of whether it goes on to actually use the new value. Reads whatever
// AccelerometerOrientationProvider has most recently committed, same as the live hook would at this
// exact instant — just without establishing an ongoing subscription to do it.
export function getAccelerometerOrientationSnapshot(): AccelerometerOrientationState {
  return latestSnapshot
}

const UPDATE_INTERVAL_MS = 100
// A candidate has to hold steady for this long before it actually commits — long enough that a
// jolt from a brisk swipe (which crosses a quadrant boundary for at most a couple of sensor
// samples) never survives to commit, but short enough that a genuine, deliberate re-grip of the
// device still reads as prompt. Only really tunable by feel on a real device — the Simulator
// reports no motion data at all (see this package's own CLAUDE.md and Swirlio's identical note).
const COMMIT_MS = 275
// Whichever screen-plane gravity axis is dominant has to beat the other by this multiple before a
// reading counts as confident — otherwise a near-diagonal hold produces no candidate at all, and
// the last committed state just holds instead of coin-flipping between two close axes.
const DOMINANCE_RATIO = 1.25
// Below this combined magnitude there's essentially no usable tilt signal at all — most notably
// the phone lying flat on a table, where gravity points straight through the screen and gives zero
// information about which way it's rotated in that plane. Held (not guessed) below this threshold.
// Expressed as a fraction of standard gravity (accelerationIncludingGravity is in m/s², not g's —
// resting gravity reads ~9.8, not ~1) so this reads as "at least a 15%-of-g tilt" regardless of
// that unit choice, roughly an 8-9° tilt off flat.
const MIN_GRAVITY_MAGNITUDE = DeviceMotion.Gravity * 0.15

interface Candidate {
  orientationMode: OrientationMode
  p1OnRight: boolean
  upsideDown: boolean
}

function sameCandidate(a: Candidate | null, b: Candidate): boolean {
  return a !== null && a.orientationMode === b.orientationMode && a.p1OnRight === b.p1OnRight && a.upsideDown === b.upsideDown
}

// x/y are accelerationIncludingGravity's own screen-plane components, in the device's local frame
// (not the OS's interface-orientation-adjusted one — see this file's own top comment for why that
// distinction matters now). Landscape reads as x dominant, portrait as y dominant; below
// MIN_GRAVITY_MAGNITUDE or too close to the diagonal between them, there's no confident call to
// make at all.
//
// Every sign below (p1OnRight, upsideDown) is a best-guess starting point, not yet verified against
// real hardware — the Simulator can't produce real accelerometer data to check it against (see this
// file's own COMMIT_MS comment), unlike the old useP1OnRight, whose LANDSCAPE_LEFT/RIGHT mapping the
// package's git history shows really was checked against a physical rotation. Flip whichever sign
// reads backwards once this ships to a real device.
function candidateFromGravity(x: number, y: number): Candidate | null {
  const magnitude = Math.hypot(x, y)
  if (magnitude < MIN_GRAVITY_MAGNITUDE) return null
  if (Math.abs(x) > Math.abs(y) * DOMINANCE_RATIO) return { orientationMode: 'sideBySide', p1OnRight: x > 0, upsideDown: false }
  if (Math.abs(y) > Math.abs(x) * DOMINANCE_RATIO) return { orientationMode: 'faceToFace', p1OnRight: true, upsideDown: y > 0 }
  return null
}

// The actual sensor subscription — exactly one instance of this ever runs, inside
// AccelerometerOrientationProvider, rather than one per call site. Screens navigating away and back
// (title -> lobby -> game -> lobby, ...) each used to mount their OWN independent hook instance,
// which meant each one restarted from DEFAULT_STATE on mount — so putting the phone down flat right
// after rotating it, then navigating to a new screen, lost the just-committed orientation entirely
// (a fresh instance has no signal to read from a flat phone, and DEFAULT_STATE's guess is all it had
// left). Hoisting the subscription up to one shared Provider makes the committed value a property of
// the app's lifetime, not any one screen's mount lifecycle — matching how a real OS-level orientation
// reading would have persisted across navigation too.
function useAccelerometerOrientationSource(): AccelerometerOrientationState {
  const [state, setState] = useState<AccelerometerOrientationState>(DEFAULT_STATE)

  // Web has no accelerometer at all — falls back to exactly today's useWindowDimensions-based
  // reading, unchanged, rather than trying to make DeviceMotion mean something there. Computed
  // directly during render (below, after the native effect) rather than mirrored into `state` via
  // its own effect: it's already fully derived from webDimensions, so there's nothing to
  // synchronize — and computing it inline also means web's first render is correct immediately,
  // instead of one render of DEFAULT_STATE followed by an effect-driven correction.
  const webDimensions = useWindowDimensions()

  useEffect(() => {
    if (Platform.OS === 'web') return

    // Tracks the in-progress candidate and when it first appeared — plain closure variables, not
    // state/shared values, since only this effect's own listener ever reads or writes them and
    // there's nothing here that needs to trigger a re-render on its own.
    let pendingCandidate: Candidate | null = null
    let pendingSince = 0

    DeviceMotion.setUpdateInterval(UPDATE_INTERVAL_MS)
    const subscription = DeviceMotion.addListener(({ accelerationIncludingGravity }) => {
      if (!accelerationIncludingGravity) return
      const candidate = candidateFromGravity(accelerationIncludingGravity.x, accelerationIncludingGravity.y)
      if (!candidate) {
        pendingCandidate = null
        return
      }
      if (!sameCandidate(pendingCandidate, candidate)) {
        pendingCandidate = candidate
        pendingSince = Date.now()
        return
      }
      if (Date.now() - pendingSince < COMMIT_MS) return
      setState((prev) => {
        if (prev.resolved && sameCandidate(prev, candidate)) return prev
        const next: AccelerometerOrientationState = { ...candidate, resolved: true }
        latestSnapshot = next
        return next
      })
    })

    return () => subscription.remove()
    // Deliberately empty deps — this subscribes exactly once for the life of the Provider.
  }, [])

  if (Platform.OS === 'web') {
    // No way to detect upside-down from window dimensions alone — web never needed it either,
    // since the OS itself always handled real rotation there. p1OnRight is a fixed choice for the
    // same reason: there's no physical tilt to read a side from on a browser window, so this picks
    // left — matching reading order and the natural "player 1 goes first/leftmost" convention —
    // rather than defaulting to whatever the native accelerometer path happens to resolve `true` to.
    const webState: AccelerometerOrientationState = { orientationMode: webDimensions.width > webDimensions.height ? 'sideBySide' : 'faceToFace', p1OnRight: false, upsideDown: false, resolved: true }
    latestSnapshot = webState
    return webState
  }

  return state
}

const AccelerometerOrientationContext = createContext<AccelerometerOrientationState>(DEFAULT_STATE)

// Mount exactly once, near the app's own root (above any screen that uses
// useAccelerometerOrientation) — see useAccelerometerOrientationSource's own comment for why a
// single, app-lifetime subscription is what actually makes the committed orientation survive
// screen navigation. Without this Provider mounted, useAccelerometerOrientation still works but
// silently falls back to the Context's static default and never updates — the same "nothing
// crashes, it just never resolves" failure mode a missing SafeAreaProvider has.
export function AccelerometerOrientationProvider({ children }: { children: ReactNode }) {
  const state = useAccelerometerOrientationSource()
  return <AccelerometerOrientationContext.Provider value={state}>{children}</AccelerometerOrientationContext.Provider>
}

// Replaces the old useDeviceOrientation + useP1OnRight + useOrientationLock trio now that the
// consuming app locks itself to portrait permanently at the OS level: useWindowDimensions can
// never report anything but portrait again, and there's no native orientation lock left to toggle.
// This reads the device's own physical tilt instead (via AccelerometerOrientationProvider's shared
// subscription — see that component's own doc), so orientationMode/p1OnRight keep following however
// the phone is actually being held, independent of what the OS thinks the window shape is.
//
// Deliberately not a live-every-sample signal at the source: a candidate only commits once it's
// held steady for COMMIT_MS, and produces no candidate at all when the tilt is too shallow or too
// diagonal to read confidently — including the phone lying flat on a table, where gravity gives no
// signal about which way it's rotated in that plane at all. In practice this means the reading
// settles once while a player tilts the phone to decide how to hold it (in a lobby, or before a
// match starts), then simply holds that committed value for as long as the phone stays flat during
// play — there's nothing left to re-evaluate against once the signal itself goes quiet, which is
// exactly the "nothing should happen mid-swipe" behavior gameplay needs, with no gameplay-specific
// special casing anywhere in this hook.
//
// `locked` freezes orientationMode/p1OnRight/upsideDown at whatever they last were the moment it
// became true — the same job useOrientationLock's own `enabled` flag used to do, just local to
// this call site now instead of a native call. Deliberately per-call-site (not pushed into the
// shared Provider above): different screens want different locking (e.g. the lobby's own "Lock
// Orientation" setting shouldn't also freeze a completely different screen's reading), and the
// underlying sensor subscription itself has no reason to ever stop listening just because one
// consumer locked its own view of it.
export function useAccelerometerOrientation(locked = false): AccelerometerOrientationState {
  const shared = useContext(AccelerometerOrientationContext)
  // Kept in sync with `shared` on every render where this call site isn't locked, so whenever
  // `locked` flips to true, it freezes at whatever was current then rather than some stale earlier
  // snapshot. A ref would be simpler but isn't safe here — `frozen` is read as part of this same
  // render's return value, and a ref mutated during render can end up holding a value from a
  // render that never actually commits. Updating state directly in the render body (rather than in
  // an effect) is the React-sanctioned way to keep a value in sync with something derived from
  // render — see https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes.
  const [frozen, setFrozen] = useState(shared)
  if (!locked && frozen !== shared) setFrozen(shared)
  return locked ? frozen : shared
}
