# 0004 — XState State Machine for Canvas Animation Sequencing

## Context

The canvas has three independent sources of visual change: rocket data arriving via props, band toggles from the control panel, and the stage separation toggle. Each change requires a Konva animation that repositions and rescales the canvas. Before the state machine was introduced, the sequencing was handled by watchers and animation callbacks wired together ad-hoc in `AppCanvas.vue`. This had two problems:

1. **Race conditions**: rapid rocket changes would queue animations on top of each other; a band toggle arriving during a rocket animation had no principled home.
2. **Ordering rules were implicit**: "expand canvas before showing a band" and "hide a band before contracting" were enforced only by the sequence of imperative calls in callbacks, with no structural guarantee.

Stage separation added a third constraint: bands must be suppressed while separation is active and replayed after it ends. Managing this with plain watchers would have required several cross-cutting boolean guards distributed across the component.

## Decision

Canvas animation sequencing is modelled as an explicit finite state machine using **XState v5** (`createMachine`, `fromPromise`, `assign`) with the Vue adapter (`@xstate/vue`'s `useMachine`).

### States

```
idle
  ├─ ROCKET_SELECTION_CHANGED      → animating-rockets
  ├─ BAND_TOGGLED(on)     → animating-band-on
  ├─ BAND_TOGGLED(off)    → animating-band-off
  └─ SEPARATION_TOGGLED   → animating-separation-on

animating-rockets         (invokes animation as promise)
  ├─ ROCKET_SELECTION_CHANGED      → reenter (restart with latest data)
  ├─ SEPARATION_TOGGLED   → animating-separation-on
  └─ onDone [sep active]  → separation-active
  └─ onDone               → idle

animating-band-on         (invokes animation as promise)
  ├─ ROCKET_SELECTION_CHANGED      → animating-rockets
  ├─ BAND_TOGGLED(on)     → reenter (accumulate + restart)
  ├─ SEPARATION_TOGGLED   → animating-separation-on
  └─ onDone               → idle  (then showPendingBands)

animating-band-off        (invokes animation as promise)
  ├─ ROCKET_SELECTION_CHANGED      → animating-rockets
  ├─ BAND_TOGGLED(on)     → animating-band-on
  ├─ SEPARATION_TOGGLED   → animating-separation-on
  └─ onDone               → idle

animating-separation-on   (entry: disableAllBands; invokes animation)
  ├─ ROCKET_SELECTION_CHANGED      → animating-rockets (clears separationActive)
  └─ onDone               → separation-active (setSeparationVisible + flag)

separation-active
  ├─ ROCKET_SELECTION_CHANGED      → animating-rockets (keeps separationActive flag)
  ├─ BAND_TOGGLED(on)     → accumulate in pendingBands (no animation)
  └─ SEPARATION_TOGGLED(off) → animating-separation-off

animating-separation-off  (invokes animation)
  ├─ ROCKET_SELECTION_CHANGED      → animating-rockets
  └─ onDone [pendingBands] → animating-band-on
  └─ onDone               → idle
```

### Context

```ts
interface CanvasContext {
  pendingBands: BandId[]; // bands queued to show after animation settles
  pendingRockets: PendingRockets | null; // rockets to commit after animation
  separationActive: boolean; // whether to return to separation-active after rocket anim
}
```

### Sequencing rules

**Band-on ordering**: the canvas expands to its new layout _before_ band content is revealed. `showPendingBands` fires in `animating-band-on`'s `onDone` action — band components only mount when the space they need already exists.

**Band-off ordering**: band content is hidden synchronously in the `BAND_TOGGLED(off)` transition action (`deps.hideBand`), before the animation runs. The canvas never contracts under live content.

**Rocket coalescing**: `animating-rockets` accepts `ROCKET_SELECTION_CHANGED` with `reenter: true`. Rapid rocket changes restart the animation with the latest data rather than queuing independent animations. Only one animation runs at a time, always targeting the most recent selection.

**Separation preempts bands**: entering `animating-separation-on` calls `deps.disableAllBands()` via the `entry` action, clearing both `enabledBands` and `visibleBands`. While in `separation-active`, further `BAND_TOGGLED(on)` events are accepted but only stored in `pendingBands` — no animation runs. When separation is dismissed, `animating-separation-off` routes to `animating-band-on` if `pendingBands` is non-empty, replaying the queued toggles.

**Separation persistence across rocket changes**: `context.separationActive` is a boolean flag rather than a structural state. When `ROCKET_SELECTION_CHANGED` fires from `separation-active`, the machine transitions to `animating-rockets`. The `onDone` guard checks `context.separationActive` to route back to `separation-active` rather than `idle`, so the separation view is maintained for new rockets.

The alternative would be a parallel state region — one region for "which animation is running", a second for "is separation on" — which would let the separation concern persist through animation transitions without a flag. That's not worth it for a single bit of information read in one guard. The cost of parallel states is paid upfront in structural complexity: every event handler in every animation state has to account for the separation region. A context flag achieves the same result with almost no overhead.

The signal to reconsider: if a second such flag were needed, especially if any transition needed to branch on a combination of both, parallel states would start paying for themselves. Two flags reasoning about combinations is the point where the distributed update cost of flags exceeds the upfront cost of a parallel region.

### Deps injection

The machine factory `createCanvasMachine(deps)` accepts a `CanvasMachineDeps` object containing live Vue refs and effect callbacks. Deps are read **inside action and invoke callbacks at transition time**, never captured as closure values at machine-creation time. This ensures actions always operate on current reactive state, not stale snapshots from when the machine was initialised.

```ts
export interface CanvasMachineDeps {
  animate: (...) => void;
  animatedWorldScale: Ref<number>;
  animatedBaselineY: Ref<number>;
  getTargetScale: (rockets, separated) => number;
  getTargetBaseline: (rockets, separated) => number;
  displayRocketA: Ref<RocketConfig | null>;
  displayRocketB: Ref<RocketConfig | null>;
  setDisplayRockets: (a, b) => void;
  syncVisibleBands: () => void;
  showBands: (ids: BandId[]) => void;
  hideBand: (id: BandId) => void;
  disableAllBands: () => void;
  setSeparationVisible: (v: boolean) => void;
}
```

`AppCanvas.vue` constructs this object inline, passing closures that capture the composable return values. The machine has no import dependency on any composable.

### Why XState over watchers

The alternative — expanding the watcher-based approach — would require:

- Shared boolean guards (`isAnimating`, `isSeparating`) readable across watchers
- Manual cancellation of in-flight animations when new events arrive
- An explicit queue or debounce for band toggles arriving mid-animation

XState makes the legal states and transitions the _only_ executable paths. Impossible combinations (e.g. a band-on animation running while separation is active) are excluded structurally rather than guarded at runtime.

## Consequences

- All canvas animation ordering is visible in a single file (`useCanvasMachine.ts`) as an explicit state graph
- New canvas interactions must be modelled as events and states in the machine — ad-hoc watchers in `AppCanvas.vue` should not be added for concerns that involve animation
- `fromPromise` wraps the Konva animation, so XState manages the async lifecycle; the promise resolves in the animation completion callback
- The machine is a pure factory function and is fully testable in isolation by injecting mock deps
- Adding a new band type requires no changes to the machine — only a new `BAND_REGISTRY` entry (see ADR 0003)
