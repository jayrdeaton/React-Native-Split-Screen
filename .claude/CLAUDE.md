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
| `useDeviceOrientation.ts` | `'faceToFace' \| 'sideBySide'` from `useWindowDimensions` — follows the device's live physical shape, not a stored preference. |
| `useP1OnRight.ts` | Which physical side (left/right) P1 lands on once in side-by-side mode — needs the real `LANDSCAPE_LEFT`/`LANDSCAPE_RIGHT` reading from `expo-screen-orientation`, since `useDeviceOrientation` alone can only tell you *some* landscape, not which rotation direction got you there. |
| `useOrientationLock.ts` | Opt-in native orientation lock, pinned to whichever `OrientationMode` is passed in. |
| `useDualZoneLayout.ts` | The committed (not live) layout state plus a Reanimated opacity style — fades out, swaps content, fades in across a rotation, rather than snapping instantly. Returns `panelLayout` so a caller can also size other things (e.g. a press-away zone rect) against the same painted state. |
| `DualZoneLayout.tsx` | Renders `p1`/`p2`/`shared` in whichever arrangement `panelLayout` calls for — face-to-face (p2 rotated 180° and stacked) or side-by-side (plain left/right row) — driven by `useDualZoneLayout`'s state and fade style. Only covers the two-player case; a solo screen doesn't need this component. |
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
- `expo-screen-orientation` ^57 — real landscape-left/right reading, native orientation lock

No `react-native-gesture-handler`, no `react-native-paper`.

## Testing

- **Framework:** Jest + ts-jest + `@testing-library/react` (jsdom environment)
- **Location:** `src/__tests__/*.test.ts`
- **Mocks:** `src/__mocks__/` — `react-native`, `react-native-reanimated`, `expo-screen-orientation`
- Tests cover the state hook (`useDualZoneLayout`) — component rendering is not tested
- When adding new hook behavior, add a corresponding test case
