# @tastic/split-screen

Two-player split-screen layout engine for React Native games: device-orientation-aware zone
splitting, which physical side each player lands on, and the fade transition between them.

Sibling to [`@tastic/hud`](https://github.com/jayrdeaton/react-native-hud), the popover/dropdown/
gauge/dialog kit whose components render correctly inside this package's 180°-rotated zone. This
package never imports hud; hud imports this one only for its `useZoneClampedAlign` (an optional peer
there, which reads `useZoneBounds` below). They compose at your own screen.

## What it does

A local two-player game on one shared device has two seating arrangements, depending on how the
device is held:

- **Face-to-face** (portrait): the two players sit across from each other, so player 2's zone (or
  content) is rotated 180° relative to player 1's.
- **Side-by-side** (landscape): the two players sit shoulder-to-shoulder, so both read the screen
  the same way up.

Which arrangement a device is in right now (the seat mode) is
[`@tastic/core`](https://github.com/jayrdeaton/react-native-game-core)'s `useOrientationState`: side by
side when the window is wider than tall, face to face otherwise, following the window live, with no
provider to mount (see core's "Seat mode and orientation"). This package is the two-player layout on top
of that reading:

- **Zones that are free to reflow** (a lobby's player panels): `DualZoneLayout` renders face-to-face
  (rotate-and-stack) or side-by-side (plain left/right row) to match, fading across a change instead of
  snapping instantly (which reads as content teleporting/flickering, since native content can reflow a
  frame or two before a fade would otherwise cover it).
- **Inside a zone**, `useZoneBounds` tells a popover where its zone ends, and `needsSharedNeutralZone`
  says whether shared actions can sit in a corner.

Everything else about orientation (`useOrientationState`, `FakeLandscapeView`, `rotateInsets` and the
rest) is `@tastic/core`'s, imported from there. This package re-exported it under older names up to 0.5.5
and no longer does: `useAccelerometerOrientation`, `getAccelerometerOrientationSnapshot` and
`AccelerometerOrientationState` are core's `useOrientationState`, `getOrientationSnapshot` and
`OrientationState`, and `FakeLandscapeView`, `rotateInsets`, `rotateDimensions` and the `ViewRotation`,
`EdgeInsets`, `OrientationMode` and `FakeLandscapeViewProps` types keep their names in core. The rest of
what it re-exported (`AccelerometerOrientationProvider`, which was core's `OrientationProvider`,
`useRotation`, `useRotatedWindowDimensions`, `getViewRotation`, `getFixedZoneRotation` and
`getOpposingZoneRotation`) is gone from core too, since 0.18: the OS turns the screen, so there's no
drawn turn left to read.

## Usage: two-player zones that actually reflow (`DualZoneLayout`)

```tsx
import { useOrientationState } from '@tastic/core'
import { DualZoneLayout, useDualZoneLayout } from '@tastic/split-screen'

function LobbyScreen() {
  // The seat mode from the window's shape. Passing true freezes this call site at its current value
  // (a round in progress, say).
  const { orientationMode, p1OnRight, upsideDown, resolved } = useOrientationState()

  // panelLayout is the *committed* layout - lags one fade behind the live values above. Use it
  // (not the live orientationMode/p1OnRight) for anything else that needs to match what's actually
  // painted right now, mid-fade included - e.g. sizing a press-away zone (see @tastic/hud's README).
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
need it at all - just render your own content.

`useDualZoneLayout(orientationMode, p1OnRight, p1OnRightResolved, upsideDown = false, fadeDurationMs = 200)`
returns `{ panelLayout, panelFadeStyle }`. `panelLayout` (`DualZoneLayoutState`: `{ orientationMode,
p1OnRight, upsideDown }`) is the committed layout: a change fades the old layout out over
`fadeDurationMs`, swaps it, then fades the new one in. While `p1OnRightResolved` is false nothing fades,
so a fresh mount's first correction snaps straight to the right layout.

`DualZoneLayout`'s props:

- `panelLayout`, `panelFadeStyle`: from `useDualZoneLayout`.
- `p1`, `p2`: each player's zone. Face to face, p2's zone is turned 180° and stacked above p1's; side
  by side, the two sit in a plain row ordered by `p1OnRight`.
- `shared` (optional): the row both players read right-side up, between the two zones face to face and
  above the row side by side.
- `p1Elevated`, `p2Elevated`, `sharedElevated` (optional): raise that zone above the others while a
  popover inside it is open, so it can paint over a neighboring zone. Each zone is its own stacking
  context on the web, so a popover's own `zIndex` can't reach across a zone boundary. They're
  independent because both players can have something open at once.

### Zone bounds (`useZoneBounds`)

Inside a `DualZoneLayout` zone, `useZoneBounds()` returns that zone's `ZoneBounds`, so a popover,
dropdown or dialog anchored there can stay out of the shared row and the other player's half. It
returns `null` outside a zone (in `shared`, on a solo screen, or before the shared row's first
measurement lands), so a caller just skips its extra clamp until it resolves. `@tastic/hud`'s
`useZoneClampedAlign` is built on it.

- `sharedEdgeY`: the window Y of the edge between this zone and the shared row (the same space as
  `measureInWindow`, post-transform, so it's right from inside p2's turned zone too). Content anchored
  in the zone must not cross it.
- `zoneSide`: `'belowShared'` (p1 face to face, or either zone side by side) or `'aboveShared'` (p2 face
  to face): which way from `sharedEdgeY` the zone lies. Only that direction is bounded by
  `sharedEdgeY`; the other runs to the screen's own edge.
- `rotated`: whether the zone is turned 180° in real-world terms, counting an enclosing
  `FakeLandscapeView`'s upside-down turn as well as p2's own. Content placed with plain relative styles
  (`top: '100%'`) inside a turned zone appears flipped, so a caller choosing a real-world direction
  itself flips it for such a component.

### Corners or a shared neutral zone (`needsSharedNeutralZone`)

`needsSharedNeutralZone(orientationMode, humanPlayerCount)` is true when more than one human shares the
device face to face: the one layout where a fixed corner can't be reached right-side up by both
players, so shared actions belong in a vertically centered spot. Side by side, or with one human (vs
CPU), plain corners work. It takes the already-resolved `orientationMode` and has no platform check of
its own, so a narrow mobile-web window reads face to face like a phone.

## Content that must not reflow

A game board (and its touch zones) that keeps the same geometry however the device is held doesn't need
`DualZoneLayout`. Player 2's face-to-face decoration (a dialog, a countdown, a HUD chip) is turned 180°
in place (`@tastic/core`'s `FakeLandscapeView` or `toRotationStyle` with `180`), and
`needsSharedNeutralZone` above says where shared actions go.

## Install

Published to the public npm registry as `@tastic/split-screen`.

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

`react` (>=19.0.0), `react-native` (>=0.76.0), `react-native-reanimated` (>=4.0.0 - the fade
transition), `react-native-worklets` (>=0.5.0 - `scheduleOnRN`, which the fade's reaction calls back to
JS with), [`@tastic/core`](https://github.com/jayrdeaton/react-native-game-core) (>=0.5.0 - only the
`OrientationMode` type that `useDualZoneLayout` and `needsSharedNeutralZone` take; an app reads the seat
mode itself with core's `useOrientationState`), and
[`@rific/core`](https://github.com/jayrdeaton/React-Native-Core) (>=0.5.0 - `useWorkletCallback` and
`callWorkletCallback`, which carry the fade's layout swap back to JS). None of them is optional, and
none is bundled, so use whatever versions your app already has.
