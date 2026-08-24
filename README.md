# @tastic/split-screen

Two-player split-screen layout engine for React Native games: device-orientation-aware zone
splitting, which physical side each player lands on, and the fade transition between them.

Sibling to [`@tastic/hud`](https://github.com/jayrdeaton/react-native-hud), the popover/dropdown/
gauge/dialog kit whose components render correctly inside this package's 180°-rotated zone. Neither
package depends on the other; they compose at your own screen.

## What it does

A local two-player game on one shared device has two layouts, depending on how the device is held:

- **Face-to-face** (portrait) — the two players sit across from each other, so player 2's zone is
  rotated 180° and stacked above player 1's, facing them from the opposite side of the device.
- **Side-by-side** (landscape) — the two players sit shoulder-to-shoulder, so both zones render
  right-side-up in a plain left/right row, ordered by whichever physical side each player landed on
  after the rotation.

`DualZoneLayout` renders whichever of these fits the device's current physical shape, and fades
across a mid-session rotation instead of snapping instantly (which reads as content
teleporting/flickering, since native content can reflow a frame or two before a fade would
otherwise cover it).

## Usage

```tsx
import { DualZoneLayout, useDeviceOrientation, useDualZoneLayout, useOrientationLock, useP1OnRight } from '@tastic/split-screen'

function LobbyScreen() {
  const orientationMode = useDeviceOrientation()
  useOrientationLock(lockOrientationSetting, orientationMode)
  const { p1OnRight, resolved } = useP1OnRight()

  // panelLayout is the *committed* layout — lags one fade behind the live values above. Use it
  // (not the live orientationMode/p1OnRight) for anything else that needs to match what's actually
  // painted right now, mid-fade included — e.g. sizing a press-away zone (see @tastic/hud's README).
  const { panelLayout, panelFadeStyle } = useDualZoneLayout(orientationMode, p1OnRight, resolved)

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

`DualZoneLayout` only covers the two-player case. A solo screen (nothing to rotate for) doesn't
need it at all — just render your own content.

## Install (local dev via yalc)

Not published to the public npm registry yet.

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

`react`, `react-native`, `react-native-reanimated` (^4 — the fade transition), `expo-screen-orientation`
(^57 — real landscape-left/right reading, native orientation lock). None of these are bundled, so
use whatever versions your app already has.
