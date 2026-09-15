# @tastic/split-screen

Two-player split-screen layout engine for React Native games: device-orientation-aware zone
splitting, which physical side each player lands on, and the fade transition between them.

Sibling to [`@tastic/hud`](https://github.com/jayrdeaton/react-native-hud), the popover/dropdown/
gauge/dialog kit whose components render correctly inside this package's 180°-rotated zone. Neither
package depends on the other; they compose at your own screen.

## What it does

A local two-player game on one shared device has two seating arrangements, depending on how the
device is held:

- **Face-to-face** (portrait) — the two players sit across from each other, so player 2's zone (or
  content) is rotated 180° relative to player 1's.
- **Side-by-side** (landscape) — the two players sit shoulder-to-shoulder, so both read the screen
  the same way up.

Reading the device's own physical tilt rather than the OS's own rotation is what makes any of this
work at all in an app permanently locked to portrait at the OS level — there's no live window-shape
signal left to read otherwise. That tilt-tracking foundation (the sensor subscription, the
`OrientationProvider`/`useOrientationState` hooks, `FakeLandscapeView`/`useRotatedWindowDimensions`,
and the pure `getViewRotation`/`getFixedZoneRotation`/`getOpposingZoneRotation`/`rotateInsets`/
`rotateDimensions` geometry) lives in
[`@tastic/core`](https://github.com/jayrdeaton/react-native-game-core) — this package builds its
own two-player zone layout on top of it, and re-exports all of it under this package's original
names (`AccelerometerOrientationProvider`, `useAccelerometerOrientation`, ...) for backward
compatibility. New code should import directly from `@tastic/core` instead — see its own README for
the current names and the `deviceMotion` injection pattern (this package no longer imports
`expo-sensors` itself at all).

Two different jobs fall out of that same tilt reading, covered by two different halves of this
package:

- **Zones that are free to reflow** (a lobby's player panels) — `DualZoneLayout` renders face-to-face
  (rotate-and-stack) or side-by-side (plain left/right row) to match, fading across a mid-session
  rotation instead of snapping instantly (which reads as content teleporting/flickering, since native
  content can reflow a frame or two before a fade would otherwise cover it).
- **Zones that must stay exactly where they are** (a game board's own fixed touch zones) —
  `getFixedZoneRotation`/`getOpposingZoneRotation` rotate just the decoration on top (dialogs,
  countdowns, HUD chips) in place, leaving the zone geometry untouched. See the second usage section
  below.

## Setup

Mount `AccelerometerOrientationProvider` (a compat alias for `@tastic/core`'s own
`OrientationProvider`) once, near your app's root — above every screen that reads orientation, so
the committed reading survives navigation instead of each screen restarting its own sensor
subscription from scratch. It needs your own real `expo-sensors` import handed in as a prop — this
package (like `@tastic/core` underneath it) never imports `expo-sensors` directly itself:

```tsx
import { AccelerometerOrientationProvider } from '@tastic/split-screen'
import { DeviceMotion } from 'expo-sensors'

// App root
<AccelerometerOrientationProvider deviceMotion={DeviceMotion}>
  <AppNavigator />
</AccelerometerOrientationProvider>
```

Without a Provider mounted, `useAccelerometerOrientation` still works but silently falls back to a
static default and never updates — the same "nothing crashes, it just never resolves" failure mode
a missing `SafeAreaProvider` has. Mounted with no `deviceMotion` prop, it degrades the same way
(with a one-time `console.warn` in dev, easy to notice if it's accidental).

## Usage: two-player zones that actually reflow (`DualZoneLayout`)

```tsx
import { useOrientationState } from '@tastic/core'
import { DualZoneLayout, useDualZoneLayout } from '@tastic/split-screen'

function LobbyScreen() {
  // orientationMode/p1OnRight/upsideDown are derived from the device's own physical tilt, not the
  // OS's own rotation — this works even in an app permanently locked to portrait at the OS level,
  // since there's no live window-shape signal left to read otherwise. `lockOrientationSetting`
  // freezes all three at whatever they last committed, the same job an app-level "Lock Orientation"
  // preference toggle already wants.
  const { orientationMode, p1OnRight, upsideDown, resolved } = useOrientationState(lockOrientationSetting)

  // panelLayout is the *committed* layout — lags one fade behind the live values above. Use it
  // (not the live orientationMode/p1OnRight) for anything else that needs to match what's actually
  // painted right now, mid-fade included — e.g. sizing a press-away zone (see @tastic/hud's README).
  const { panelLayout, panelFadeStyle } = useDualZoneLayout(orientationMode, p1OnRight, resolved, upsideDown)

  return (
    <DualZoneLayout
      panelLayout={panelLayout}
      panelFadeStyle={panelFadeStyle}
      p1={<Player1Panel />}
      p2={<Player2Panel />}
      shared={<SharedSettingsRow />}
    />
  )
}
```

`DualZoneLayout` only covers the two-player case where the zones themselves are free to reflow
(face-to-face rotate-and-stack vs. side-by-side row). A solo screen (nothing to rotate for) doesn't
need it at all — just render your own content.

## Usage: content that must NOT reflow (`getViewRotation` / fixed zones)

Not everything can reflow. A game board (and its touch zones) usually needs to keep the exact same
geometry regardless of which way the device is held — only the *decoration* on top of it (dialogs,
countdowns, HUD chips) should rotate in place to stay legible. Three flavors, depending on what the
content is:

- **Single-perspective, whole-screen content** (a title screen, a settings dialog) — wrap it in
  `FakeLandscapeView`. This moved to [`@tastic/core`](https://github.com/jayrdeaton/react-native-game-core)
  as of core 0.5.0 — it never had any real dependency on this package's own two-player pieces
  (`DualZoneLayout` and friends), only on the rotation primitives that already lived in core. Still
  re-exported here under its original name for backward compatibility (see the compat note in Setup
  above); new code should import it directly from `@tastic/core` — see that package's own README for
  the full usage example and its "safe for tap-driven content, not for continuous gesture tracking"
  warning.

- **Two fixed zones that never reflow** (e.g. a game board permanently split top/bottom, one player
  per half, regardless of tilt) — use `getFixedZoneRotation` for the first seat's rotation, and
  `getOpposingZoneRotation` for the second seat's. The zones themselves stay exactly where they are;
  only each seat's own dialog/HUD content rotates:

  ```tsx
  import { getFixedZoneRotation, getOpposingZoneRotation, useOrientationState } from '@tastic/core'

  const { orientationMode, p1OnRight, upsideDown } = useOrientationState()
  const rotation = getFixedZoneRotation(orientationMode, p1OnRight, upsideDown)
  const p2Rotation = getOpposingZoneRotation(rotation)

  <Text style={{ transform: [{ rotate: `${rotation}deg` }] }}>{p1Text}</Text>
  <Text style={{ transform: [{ rotate: `${p2Rotation}deg` }] }}>{p2Text}</Text>
  ```

  Landscape rotates both seats identically — held side by side, they read the screen the same way
  up. Portrait ignores the device's own "upside down" flip (the zones can't swap which physical seat
  they're nearest just because the device spun while lying flat) and instead applies the two seats'
  own fixed face-to-face 180° difference — `getFixedZoneRotation` deliberately never adds that flip
  itself; `getOpposingZoneRotation` is what does, and only for the second seat.

- **Safe-area insets**, once anything above has visually rotated — `rotateInsets(insets, rotation)`
  remaps `useSafeAreaInsets()`'s always-physical-frame values onto whichever edge they actually
  correspond to post-rotation.

## Install

Published to the public npm registry as `@tastic/split-screen`. `FakeLandscapeView`'s move to
`@tastic/core` (see above) is newer than the latest published version, though — for now the local
source here still has it removed with a compat re-export pointing at an unpublished `@tastic/core`
build, so this only really works end-to-end via `yalc`-linked builds of both packages (see below)
until they're published for real. Everything else described above, including the `deviceMotion`
injection pattern, is already live on npm.

```bash
npm install @tastic/split-screen
```

### Local dev via yalc (for unpublished changes)

```bash
cd react-native-split-screen
npm run build
yalc publish

cd ../your-game
yalc add @tastic/split-screen
npm install
```

Re-run `npm run build && yalc push` from this package after any change to propagate it to every
linked consumer at once.

## Peer dependencies

`react`, `react-native`, `react-native-reanimated` (^4 — the fade transition), and
[`@tastic/core`](https://github.com/jayrdeaton/react-native-game-core) (>=0.3.0 — the orientation-
tracking foundation this package re-exports and builds its own zone layout on top of; bump this
again once a core version with `FakeLandscapeView` is actually published, since the compat re-export
above needs it). None of these are bundled, so use whatever versions your app already has.

**Not a dependency: `expo-sensors`.** This package used to import it directly; that moved into
`@tastic/core`, which never imports it either (see its own README for why) — your app hands in its
own `expo-sensors` import via the `deviceMotion` prop on `AccelerometerOrientationProvider` (see
Setup above) if it wants live tilt tracking.
