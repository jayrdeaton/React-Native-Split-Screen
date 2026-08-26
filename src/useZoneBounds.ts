import { createContext, useContext } from 'react'

export interface ZoneBounds {
  // Absolute window Y-coordinate (same coordinate space as View.measureInWindow — post-transform,
  // so this is correct even from inside p2's 180°-rotated zone) of the edge between this zone and
  // the shared row. A popover/dropdown/dialog anchored inside this zone must not cross this line —
  // past it is the shared row, or the opposite player's own zone.
  sharedEdgeY: number
  // Which real-world direction this zone's own content lives on relative to sharedEdgeY —
  // 'belowShared' for p1 in face-to-face (shared sits above p1) or either zone in side-by-side
  // (shared sits above the row); 'aboveShared' for p2 in face-to-face (shared sits below p2, since
  // p2 renders above it in the stack). Deliberately not just a precomputed "available height": a
  // popover can open toward *either* real-world direction from its own trigger (whichever a hook
  // like @tastic/hud's useAutoAlign picks based on the trigger's own position), and only one of
  // those two directions is actually bounded by sharedEdgeY — the other runs to the screen's own
  // outer edge instead, which a caller already knows how to bound on its own (e.g. useAutoAlign's
  // own maxHeight, measured against the full window, happens to already be correct for that
  // direction). `zoneSide` is what lets a caller tell which of the two directions it's looking at
  // for a given trigger before deciding whether sharedEdgeY applies at all.
  zoneSide: 'aboveShared' | 'belowShared'
  // Whether this zone is rotated 180° in absolute, real-world terms — not just DualZoneLayout's own
  // fixed internal flip (p2 in face-to-face mode, never p1, never either zone in side-by-side), but
  // XOR'd against a caller's own enclosing FakeLandscapeView too, if it's rotating everything here a
  // further 180° for an upside-down hold (see DualZoneLayout's own doc, and useDualZoneLayout's
  // upsideDown) — that outer flip cancels p2's own 180° back to 0° absolute and adds one to p1's
  // that it didn't have before, so both zones' true rotation swap once the device goes upside down.
  // This matters for anything that positions itself with plain relative CSS against a trigger inside
  // the zone (e.g.
  // @tastic/hud's PopoverBody, via `top:'100%'`/`bottom:'100%'`) rather than by an absolute
  // measured coordinate: that positioning is resolved in *local*, pre-rotation space and then
  // rotated along with everything else in the zone, which inverts it — local 'below' a trigger
  // paints as real-world *above* it once the whole zone is flipped 180°, and vice versa. A
  // consumer that independently computes which real-world direction it wants (as opposed to just
  // forwarding whatever @tastic/hud's own useAutoAlign already decided, which already accounts for
  // this on its own) needs to flip its own label when handing it to a component with that same
  // local-then-rotate positioning scheme, or it ends up choosing the direction it meant to avoid.
  rotated: boolean
}

const ZoneBoundsContext = createContext<ZoneBounds | null>(null)

// null outside a DualZoneLayout zone (e.g. from `shared`, a solo screen not using this package at
// all, or simply before the shared row's own first measurement has landed) — callers own the
// "no bounds yet" fallback, which is typically just deferring any extra clamp until this resolves.
export function useZoneBounds(): ZoneBounds | null {
  return useContext(ZoneBoundsContext)
}

export const ZoneBoundsProvider = ZoneBoundsContext.Provider
