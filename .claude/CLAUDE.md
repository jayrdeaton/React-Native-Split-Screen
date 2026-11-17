# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# @tastic/split-screen

Standalone npm package. Two-player split-screen layout engine for React Native games:
device-orientation-aware zone splitting (face-to-face rotate-and-stack vs side-by-side row), which
physical side each player lands on, and the fade transition between them.

Published under the `tastic` npm org - game-specific layout, as opposed to `@rific`'s generic
React Native tooling. Sibling package: `@tastic/hud` (`../React-Native-Hud`), the popover/dropdown/
gauge/dialog kit whose components render correctly inside this package's 180°-rotated zone. This
package never imports hud; hud imports this one only for `useZoneBounds` (behind its
`useZoneClampedAlign`, an optional peer there). They compose at the consuming app's own screen.

## Commands

```bash
npm run lint       # ESLint + Prettier check (@infinitetoken/eslint-config/react-native preset)
npm run fix        # Auto-fix lint/format issues
npm run typecheck  # TypeScript type check (tsc --noEmit)
npm test           # Run all Jest tests
npm run test:watch # Jest --watchAll
npm run build      # tsup, config via tsup.config.cjs -> @infinitetoken/tsconfig/tsup/lib preset
npm run build:watch
npm run verify     # lint && test && typecheck && build - also runs via `preversion` (see Release)
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
Both the caller and the reusable workflow grant only `contents: read` and `id-token: write` - no
`--provenance` flag is ever passed to `npm publish` explicitly, but the live registry confirms
provenance is attached anyway (`npm view @tastic/split-screen@0.2.1 dist` shows a
`dist.attestations.provenance` entry with `predicateType: https://slsa.dev/provenance/v1`) - npm CLI
auto-attaches provenance when it detects `id-token: write` in a supported CI environment (GitHub
Actions), no flag needed. Published at https://www.npmjs.com/package/@tastic/split-screen (currently
4 versions live: 0.1.0, 0.1.1, 0.2.0, 0.2.1, matching `package.json`'s current `0.2.1`). Only 3 git
tags exist (`v0.1.1`, `v0.2.0`, `v0.2.1`) - `0.1.0` was published without a corresponding tag, before
this release flow was in place.

## Local development (yalc)

Not installed from the registry by consuming apps during development - linked via yalc, same as
`@rific/updater` is in this author's other projects:

```bash
npm run build && yalc publish   # from this package
cd ../your-game && yalc add @tastic/split-screen && npm install
```

Re-run `npm run build && yalc push` after any change to propagate it to every linked consumer.

## Code Style

Enforced by ESLint + Prettier - run the linter before finishing any task.

**Prettier config:**
- Single quotes, JSX single quotes
- No semicolons
- No trailing commas
- Print width: 1000 (effectively disabled)

**ESLint rules (warnings):**
- `simple-import-sort` - imports and exports must be sorted
- `react-native/no-inline-styles` - no inline style objects
- `react-native/no-unused-styles` - no unused StyleSheet entries
- `no-console` - no console statements

## Architecture

### Source files (`src/`)

| File | Purpose |
|---|---|
| `actionZone.ts` | `needsSharedNeutralZone(orientationMode, humanPlayerCount)`: whether shared actions need a vertically centered spot (two humans face to face) or can sit in corners. |
| `useDualZoneLayout.ts` | The committed (not live) layout state plus a Reanimated opacity style - fades out, swaps content, fades in across a rotation, rather than snapping instantly. Returns `panelLayout` so a caller can also size other things (e.g. a press-away zone rect) against the same painted state. |
| `DualZoneLayout.tsx` | Renders `p1`/`p2`/`shared` in whichever arrangement `panelLayout` calls for - face-to-face (p2 rotated 180° and stacked) or side-by-side (plain left/right row) - driven by `useDualZoneLayout`'s state and fade style. Only covers the two-player, reflowing case; a solo screen, or a board whose zones must stay fixed, doesn't need this component. |
| `useZoneBounds.ts` | Context carrying the currently-rendered `DualZoneLayout` zone's own bounds/rotation state (`sharedEdgeY`, `zoneSide`, `rotated`) down to consumers inside it - e.g. `@tastic/hud` popovers that need to clamp against the shared row or account for a 180°-rotated zone's locally-inverted positioning. `null` outside a zone. |
| `index.ts` | Public exports. |

### Why `useDualZoneLayout` and `DualZoneLayout` are split

A consuming lobby screen typically needs the *same* committed layout state for more than just
rendering - e.g. sizing a press-away zone (see `@tastic/hud`'s README) to match whichever side is
currently on screen has to agree with the painted layout, mid-fade included, not the live device
orientation. Keeping the state hook separate from the render component is what lets both consume
the same `panelLayout` without the app re-deriving it twice.

## Public API

The complete `src/index.ts` export list:

```ts
export { needsSharedNeutralZone } from './actionZone'
export { DualZoneLayout } from './DualZoneLayout'
export { type DualZoneLayoutState, useDualZoneLayout } from './useDualZoneLayout'
export { useZoneBounds, type ZoneBounds } from './useZoneBounds'
```

The orientation reading and rotation math (`useOrientationState`, `OrientationProvider`,
`FakeLandscapeView`, `getViewRotation`, `rotateInsets` and the rest) moved to `@tastic/core` in 0.4.0
and 0.5.0, and this package re-exported them under their old names (`AccelerometerOrientationProvider`,
`useAccelerometerOrientation`, ...) through 0.5.5. The re-exports were dropped on 2026-11-17 (Jay: no
backward-compatibility paths); no app in `~/Developer` imported any of them from here. The only thing
left from core is the `OrientationMode` type, imported with `import type`.

`ZoneBoundsProvider` (also exported from `useZoneBounds.ts`) is deliberately NOT re-exported here -
it's an internal wiring detail `DualZoneLayout.tsx` imports directly; consumers only ever read bounds
via `useZoneBounds`, never provide them.

## Peer Dependencies

- `react` >=19.0.0, `react-native` >=0.76.0
- `react-native-reanimated` >=4.0.0 - the fade transition (`useAnimatedReaction`, `withTiming`, shared values)
- `react-native-worklets` >=0.5.0 - `scheduleOnRN`, the fade's reaction calling back to JS
- `@rific/core` >=0.5.0 - `useWorkletCallback`/`callWorkletCallback`, carrying the fade's layout swap back to JS
- `@tastic/core` >=0.5.0 - the `OrientationMode` type only

No `react-native-gesture-handler`, no `react-native-paper`.

## Testing

- **Framework:** Jest, configured through the shared `@infinitetoken/jest-config/react-native` preset
  (jsdom environment; ts-jest transform under the hood, resolved transitively through the preset -
  not a direct devDependency here) + `@testing-library/react`
- **Location:** `src/__tests__/*.test.ts` and `*.test.tsx`
- **Mocks:** `src/__mocks__/` - `react-native`, `react-native-reanimated`, `react-native-worklets`. `@tastic/core` needs no mock: only its type is imported
- **Current:** 4 suites / 24 tests, all passing
- Tests cover the state hooks (`useDualZoneLayout`, `useZoneBounds`), `needsSharedNeutralZone`, and `DualZoneLayout.tsx`'s rendering. Neither the mocked `View` nor the mocked `Animated.View` produces real host DOM elements, so these tests assert against props recorded on the `View` mock (`View.mock.calls`) and rendered text order/content rather than DOM structure. `src/__mocks__/react-native.ts`'s `View` stub also honors an incoming `ref` prop - React 19's ref-as-prop for a plain, non-`forwardRef` function component - handing back a fake `measureInWindow`, which is what lets `DualZoneLayout.test.tsx` exercise the post-measurement `ZoneBounds` branches instead of leaving them permanently unreachable
- When adding new hook or layout behavior, add a corresponding test case
