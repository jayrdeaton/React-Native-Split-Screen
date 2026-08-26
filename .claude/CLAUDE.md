# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# @tastic/split-screen

Standalone npm package. Two-player split-screen layout engine for React Native games:
device-orientation-aware zone splitting (face-to-face rotate-and-stack vs side-by-side row), which
physical side each player lands on, and the fade transition between them.

Published under the `tastic` npm org — game-specific layout, as opposed to `@rific`'s generic
React Native tooling. Sibling package: `@tastic/hud` (`../React-Native-Hud`), the popover/dropdown/
gauge/dialog kit whose components render correctly inside this package's 180°-rotated zone. Neither
package depends on the other — they compose at the consuming app's own screen.

## Commands

```bash
npm run lint      # ESLint + Prettier check
npm run fix       # Auto-fix lint/format issues
npm run typecheck # TypeScript type check (tsc --noEmit)
npm test          # Run all Jest tests
npm run build     # Compile to dist/
```

Always run `npm run lint` before finishing any task.

## Publishing

```bash
npm version patch   # or minor / major — bumps version and creates git tag
git push --follow-tags  # triggers the publish GitHub Action
```

The publish workflow fires on `v*` tags and runs `npm publish` with provenance.

## Local development (yalc)

Not installed from the registry by consuming apps during development — linked via yalc, same as
`@rific/updater` is in this author's other projects:

```bash
npm run build && yalc publish   # from this package
cd ../your-game && yalc add @tastic/split-screen && npm install
```

Re-run `npm run build && yalc push` after any change to propagate it to every linked consumer.

## Code Style

Enforced by ESLint + Prettier — run the linter before finishing any task.

**Prettier config:**
- Single quotes, JSX single quotes
- No semicolons
- No trailing commas
- Print width: 1000 (effectively disabled)

**ESLint rules (warnings):**
- `simple-import-sort` — imports and exports must be sorted
- `react-native/no-inline-styles` — no inline style objects
- `react-native/no-unused-styles` — no unused StyleSheet entries
- `no-console` — no console statements

## Architecture

### Source files (`src/`)

| File | Purpose |
|---|---|
| `types.ts` | `OrientationMode` (`'faceToFace' \| 'sideBySide'`) — split into its own file since it's shared by `useAccelerometerOrientation.tsx` and `useDualZoneLayout.ts` and neither should import from the other. |
| `useAccelerometerOrientation.tsx` | `orientationMode`/`p1OnRight`/`upsideDown`, derived from the device's own physical tilt via `expo-sensors`' `DeviceMotion` rather than `useWindowDimensions`/`expo-screen-orientation` — works even when the consuming app is permanently locked to portrait at the OS level, since there's no live window-shape signal left to read otherwise. Debounces against brief jolts (e.g. a swipe) and simply holds its last committed value once the phone goes flat/ambiguous (gravity gives no signal about in-plane rotation there at all). `locked` freezes all three fields at whatever they last committed — the same job the old `useOrientationLock`'s `enabled` flag did, just local to this hook now instead of a native call. `AccelerometerOrientationProvider` hoists the actual sensor subscription to one app-lifetime instance (mount once, near the root) so the committed reading survives screen navigation; `useAccelerometerOrientation` reads it via Context. `getAccelerometerOrientationSnapshot()` is a non-subscribing one-time read (e.g. to seed a lazy `useState` initializer) for a caller that must never re-render just because the phone moved — plain `useContext` can't do this, since subscribing at all re-renders the caller on every future update regardless of whether it goes on to use the new value. |
| `rotation.ts` | `getViewRotation(orientationMode, p1OnRight, upsideDown)` — the raw rotation angle (0/90/180/-90) for single-perspective content (`FakeLandscapeView` reads this internally). `getFixedZoneRotation` is the same idea for a permanently fixed two-zone layout (e.g. a game board that never reflows): only a genuine landscape hold rotates anything; portrait's "upside down" flip is deliberately ignored, since the zones can't swap which physical seat they're nearest just by spinning while flat. `getOpposingZoneRotation` gives the *second* seat's own rotation from the first seat's — identical in landscape (both seats face the same way), +180°/-180° apart in portrait (the seats are face-to-face). |
| `insets.ts` | `rotateInsets(insets, rotation)` — remaps `useSafeAreaInsets()`'s always-physical-frame values onto whichever edge they actually correspond to once content has visually rotated. |
| `FakeLandscapeView.tsx` | Wraps whole-screen, single-perspective content in whatever rotation (via `getViewRotation`) keeps it gravity-upright — width/height swap for a genuine 90°/-90° hold, plain rotate for 180°. NOT safe for continuous gesture tracking (raw native coordinates don't rotate with it) — never wrap a game board/touch layer in this. |
| `useDualZoneLayout.ts` | The committed (not live) layout state plus a Reanimated opacity style — fades out, swaps content, fades in across a rotation, rather than snapping instantly. Returns `panelLayout` so a caller can also size other things (e.g. a press-away zone rect) against the same painted state. |
| `DualZoneLayout.tsx` | Renders `p1`/`p2`/`shared` in whichever arrangement `panelLayout` calls for — face-to-face (p2 rotated 180° and stacked) or side-by-side (plain left/right row) — driven by `useDualZoneLayout`'s state and fade style. Only covers the two-player, reflowing case; a solo screen, or a board whose zones must stay fixed (see `rotation.ts`), doesn't need this component. |
| `useZoneBounds.ts` | Context carrying the currently-rendered `DualZoneLayout` zone's own bounds/rotation state (`sharedEdgeY`, `zoneSide`, `rotated`) down to consumers inside it — e.g. `@tastic/hud` popovers that need to clamp against the shared row or account for a 180°-rotated zone's locally-inverted positioning. `null` outside a zone. |
| `index.ts` | Public exports. |

### Why `useDualZoneLayout` and `DualZoneLayout` are split

A consuming lobby screen typically needs the *same* committed layout state for more than just
rendering — e.g. sizing a press-away zone (see `@tastic/hud`'s README) to match whichever side is
currently on screen has to agree with the painted layout, mid-fade included, not the live device
orientation. Keeping the state hook separate from the render component is what lets both consume
the same `panelLayout` without the app re-deriving it twice.

### Peer dependencies

- `react`, `react-native`
- `react-native-reanimated` ^4 — the fade transition (`useAnimatedReaction`, `withTiming`, shared values)
- `expo-sensors` ^57 — `DeviceMotion` tilt reading

No `react-native-gesture-handler`, no `react-native-paper`.

## Testing

- **Framework:** Jest + ts-jest + `@testing-library/react` (jsdom environment)
- **Location:** `src/__tests__/*.test.ts`
- **Mocks:** `src/__mocks__/` — `react-native`, `react-native-reanimated`, `expo-sensors`
- Tests cover the state hooks (`useAccelerometerOrientation`, `useDualZoneLayout`) and the pure rotation/insets math (`rotation.ts`, `insets.ts`) — component rendering is not tested
- When adding new hook or rotation-math behavior, add a corresponding test case
