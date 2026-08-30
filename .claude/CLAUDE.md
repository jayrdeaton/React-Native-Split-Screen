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
npm run lint       # ESLint + Prettier check (@infinitetoken/eslint-config/react-native preset)
npm run fix        # Auto-fix lint/format issues
npm run typecheck  # TypeScript type check (tsc --noEmit)
npm test           # Run all Jest tests
npm run test:watch # Jest --watchAll
npm run build      # tsup, config via tsup.config.cjs -> @infinitetoken/tsconfig/tsup/lib preset
npm run build:watch
npm run verify     # lint && test && typecheck && build — also runs via `preversion` (see Release)
```

Always run `npm run lint` before finishing any task.

## Release

```bash
npm run release:patch   # or release:minor / release:major
```

Each `release:*` script runs `npm version <bump>` (bumps `package.json`, commits, creates a `vX.Y.Z`
git tag) then `npm run release` (`git push --follow-tags`). `preversion` runs the full `verify` chain
first, so a broken lint/test/typecheck/build blocks the version bump.

Pushing the tag triggers the `publish` GitHub Action (`.github/workflows/publish.yml`, calling the
shared `infinitetoken/Workflows/.github/workflows/npm-publish.yml@v1`), which runs `npm publish`.
Both the caller and the reusable workflow grant only `contents: read` and `id-token: write` — no
`--provenance` flag is ever passed to `npm publish` explicitly, but the live registry confirms
provenance is attached anyway (`npm view @tastic/split-screen@0.2.1 dist` shows a
`dist.attestations.provenance` entry with `predicateType: https://slsa.dev/provenance/v1`) — npm CLI
auto-attaches provenance when it detects `id-token: write` in a supported CI environment (GitHub
Actions), no flag needed. Published at https://www.npmjs.com/package/@tastic/split-screen (currently
4 versions live: 0.1.0, 0.1.1, 0.2.0, 0.2.1, matching `package.json`'s current `0.2.1`). Only 3 git
tags exist (`v0.1.1`, `v0.2.0`, `v0.2.1`) — `0.1.0` was published without a corresponding tag, before
this release flow was in place.

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

## Public API

The complete `src/index.ts` export list:

```ts
export { DualZoneLayout } from './DualZoneLayout'
export { FakeLandscapeView, type FakeLandscapeViewProps } from './FakeLandscapeView'
export { type EdgeInsets, rotateInsets } from './insets'
export { getFixedZoneRotation, getOpposingZoneRotation, getViewRotation, type ViewRotation } from './rotation'
export { type OrientationMode } from './types'
export { AccelerometerOrientationProvider, type AccelerometerOrientationState, getAccelerometerOrientationSnapshot, useAccelerometerOrientation } from './useAccelerometerOrientation'
export { type DualZoneLayoutState, useDualZoneLayout } from './useDualZoneLayout'
export { useZoneBounds, type ZoneBounds } from './useZoneBounds'
```

`ZoneBoundsProvider` (also exported from `useZoneBounds.ts`) is deliberately NOT re-exported here —
it's an internal wiring detail `DualZoneLayout.tsx` imports directly; consumers only ever read bounds
via `useZoneBounds`, never provide them.

## Peer Dependencies

- `react` >=19.0.0, `react-native` >=0.76.0
- `react-native-reanimated` >=4.0.0 — the fade transition (`useAnimatedReaction`, `withTiming`, shared values)
- `expo-sensors` >=57.0.0 — `DeviceMotion` tilt reading

No `react-native-gesture-handler`, no `react-native-paper`.

## Testing

- **Framework:** Jest, configured through the shared `@infinitetoken/jest-config/react-native` preset
  (jsdom environment; ts-jest transform under the hood, resolved transitively through the preset —
  not a direct devDependency here) + `@testing-library/react`
- **Location:** `src/__tests__/*.test.ts` and `*.test.tsx`
- **Mocks:** `src/__mocks__/` — `react-native`, `react-native-reanimated`, `expo-sensors`
- **Current:** 7 suites / 38 tests, all passing. Coverage: 92.9% stmts / 87.17% branches / 89.28% funcs
  / 94.3% lines — clears the shared preset's 70%/70%/70%/70% default on every metric, so
  `jest.config.cjs` carries no local `coverageThreshold` override
- Tests cover the state hooks (`useAccelerometerOrientation`, `useDualZoneLayout`, `useZoneBounds`), the pure rotation/insets math (`rotation.ts`, `insets.ts`), and component rendering (`DualZoneLayout.tsx`, `FakeLandscapeView.tsx` — both now at 100%). Neither the mocked `View` nor the mocked `Animated.View` produces real host DOM elements, so these tests assert against props recorded on the `View` mock (`View.mock.calls`) and rendered text order/content rather than DOM structure. `src/__mocks__/react-native.ts`'s `View` stub also honors an incoming `ref` prop — React 19's ref-as-prop for a plain, non-`forwardRef` function component — handing back a fake `measureInWindow`, which is what lets `DualZoneLayout.test.tsx` exercise the post-measurement `ZoneBounds` branches instead of leaving them permanently unreachable
- When adding new hook or rotation-math behavior, add a corresponding test case
