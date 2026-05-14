import { setup, assign, fromPromise } from "xstate";
import type { RocketConfig } from "@orbitq/graphql";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PendingRockets {
  a: RocketConfig | null;
  b: RocketConfig | null;
}

interface CanvasContext {
  pendingBands: string[];
  pendingRockets: PendingRockets | null;
  // Flag rather than a parallel state — carries separation mode through animating-rockets
  // so onDone can route back to separation-active. If a second such flag is needed,
  // or any transition must branch on a combination of flags, switch to parallel states.
  // See docs/adr/0004-xstate-canvas-machine.md § "Separation persistence across rocket changes".
  separationActive: boolean;
}

export type CanvasEvent =
  | {
      type: "ROCKET_SELECTION_CHANGED";
      rocketA: RocketConfig | null;
      rocketB: RocketConfig | null;
    }
  | { type: "BAND_TOGGLED"; id: string; enable: boolean }
  | { type: "SEPARATION_TOGGLED"; enable: boolean };

// ---------------------------------------------------------------------------
// Deps injected by the canvas component — all reads happen at dispatch/transition
// time, never captured at machine-creation time, so they always reflect live state.
// ---------------------------------------------------------------------------
export interface CanvasMachineDeps {
  animate: (
    fromScale: number,
    toScale: number,
    fromBaseline: number,
    toBaseline: number,
    callback: () => void,
  ) => void;
  animatedWorldScale: () => number;
  animatedBaselineY: () => number;
  // Layout targets — read enabledBands reactively and respect separation flag
  getTargetScale: (
    rockets: (RocketConfig | null)[],
    separated: boolean,
  ) => number;
  getTargetBaseline: (
    rockets: (RocketConfig | null)[],
    separated: boolean,
  ) => number;
  // Current display rockets (lag behind live props during animation)
  displayRocketA: () => RocketConfig | null;
  displayRocketB: () => RocketConfig | null;
  // Effects driven by the machine
  setDisplayRockets: (a: RocketConfig | null, b: RocketConfig | null) => void;
  syncVisibleBands: () => void;
  showBands: (ids: string[]) => void;
  hideBand: (id: string) => void;
  disableAllBands: () => void;
  setSeparationVisible: (v: boolean) => void;
}

// ---------------------------------------------------------------------------
// Machine factory
// ---------------------------------------------------------------------------

export function createCanvasMachine(deps: CanvasMachineDeps) {
  function animateAsync(
    rockets: (RocketConfig | null)[],
    separated: boolean,
  ): Promise<void> {
    return new Promise((resolve) => {
      deps.animate(
        deps.animatedWorldScale(),
        deps.getTargetScale(rockets, separated),
        deps.animatedBaselineY(),
        deps.getTargetBaseline(rockets, separated),
        resolve,
      );
    });
  }

  return setup({
    types: {} as { context: CanvasContext; events: CanvasEvent },

    // ------------------------------------------------------------------
    // Guards — named so the machine body reads as a transition table
    // ------------------------------------------------------------------
    guards: {
      isBandOn: ({ event }) => event.type === "BAND_TOGGLED" && event.enable,
      isSepOn: ({ event }) =>
        event.type === "SEPARATION_TOGGLED" && event.enable,
      isSepOff: ({ event }) =>
        event.type === "SEPARATION_TOGGLED" && !event.enable,
      isSeparationActive: ({ context }) => context.separationActive,
      hasPendingBands: ({ context }) => context.pendingBands.length > 0,
    },

    // ------------------------------------------------------------------
    // Actions — all side effects and context updates live here
    // ------------------------------------------------------------------
    actions: {
      setPendingRockets: assign(({ event }) => {
        if (event.type !== "ROCKET_SELECTION_CHANGED") return {};
        return { pendingRockets: { a: event.rocketA, b: event.rocketB } };
      }),
      clearPendingRockets: assign({ pendingRockets: null }),
      addBandToPending: assign(({ context, event }) => {
        if (event.type !== "BAND_TOGGLED") return {};
        return { pendingBands: addPending(context.pendingBands, event.id) };
      }),
      clearPendingBands: assign({ pendingBands: (): string[] => [] }),
      hideBand: ({ event }) => {
        if (event.type === "BAND_TOGGLED") deps.hideBand(event.id);
      },
      commitRockets: ({ context }) => {
        const r = context.pendingRockets;
        deps.setDisplayRockets(r?.a ?? null, r?.b ?? null);
      },
      syncVisibleBands: () => deps.syncVisibleBands(),
      showPendingBands: ({ context }) => deps.showBands(context.pendingBands),
      disableAllBands: () => deps.disableAllBands(),
      activateSeparation: assign({ separationActive: true }),
      deactivateSeparation: assign({ separationActive: false }),
      showSeparation: () => deps.setSeparationVisible(true),
      hideSeparation: () => deps.setSeparationVisible(false),
    },

    // ------------------------------------------------------------------
    // Actors — animation promises, named by the layout they compute
    // ------------------------------------------------------------------
    actors: {
      // Uses pendingRockets passed as input — pending, not display
      animateRockets: fromPromise(({ input }: { input: PendingRockets }) =>
        animateAsync([input.a, input.b], false),
      ),
      // Animates to current display rocket layout without separation.
      // Shared by animating-band-on, animating-band-off, animating-separation-off.
      animateBands: fromPromise(() =>
        animateAsync([deps.displayRocketA(), deps.displayRocketB()], false),
      ),
      // Animates to current display rocket layout with separation
      animateSeparationOn: fromPromise(() =>
        animateAsync([deps.displayRocketA(), deps.displayRocketB()], true),
      ),
    },
  }).createMachine({
    id: "canvas",
    context: {
      pendingBands: [],
      pendingRockets: null,
      separationActive: false,
    },
    initial: "idle",
    states: {
      // -----------------------------------------------------------------
      idle: {
        on: {
          ROCKET_SELECTION_CHANGED: {
            target: "animating-rockets",
            actions: "setPendingRockets",
          },
          BAND_TOGGLED: [
            {
              guard: "isBandOn",
              target: "animating-band-on",
              actions: "addBandToPending",
            },
            {
              actions: "hideBand",
              target: "animating-band-off",
            },
          ],
          SEPARATION_TOGGLED: {
            guard: "isSepOn",
            target: "animating-separation-on",
          },
        },
      },

      // -----------------------------------------------------------------
      "animating-rockets": {
        invoke: {
          src: "animateRockets",
          input: ({ context }): PendingRockets =>
            context.pendingRockets ?? { a: null, b: null },
          onDone: [
            {
              guard: "isSeparationActive",
              target: "separation-active",
              actions: ["commitRockets", "syncVisibleBands"],
            },
            {
              target: "idle",
              actions: ["commitRockets", "syncVisibleBands"],
            },
          ],
        },
        on: {
          ROCKET_SELECTION_CHANGED: {
            // Restart animation with newest data
            reenter: true,
            actions: "setPendingRockets",
          },
          BAND_TOGGLED: [
            {
              guard: "isBandOn",
              actions: "addBandToPending",
            },
            {
              actions: "hideBand",
            },
          ],
          SEPARATION_TOGGLED: {
            guard: "isSepOn",
            target: "animating-separation-on",
            actions: "clearPendingRockets",
          },
        },
      },

      // -----------------------------------------------------------------
      "animating-band-on": {
        invoke: {
          src: "animateBands",
          onDone: {
            target: "idle",
            actions: ["showPendingBands", "clearPendingBands"],
          },
        },
        on: {
          ROCKET_SELECTION_CHANGED: {
            target: "animating-rockets",
            actions: ["setPendingRockets", "clearPendingBands"],
          },
          BAND_TOGGLED: [
            {
              guard: "isBandOn",
              // Add to pending and restart animation to new combined target
              reenter: true,
              actions: "addBandToPending",
            },
            {
              actions: "hideBand",
            },
          ],
          SEPARATION_TOGGLED: {
            guard: "isSepOn",
            target: "animating-separation-on",
            actions: "clearPendingBands",
          },
        },
      },

      // -----------------------------------------------------------------
      "animating-band-off": {
        invoke: {
          src: "animateBands",
          onDone: "idle",
        },
        on: {
          ROCKET_SELECTION_CHANGED: {
            target: "animating-rockets",
            actions: "setPendingRockets",
          },
          BAND_TOGGLED: [
            {
              guard: "isBandOn",
              target: "animating-band-on",
              actions: "addBandToPending",
            },
            {
              actions: "hideBand",
            },
          ],
          SEPARATION_TOGGLED: {
            guard: "isSepOn",
            target: "animating-separation-on",
          },
        },
      },

      // -----------------------------------------------------------------
      "animating-separation-on": {
        entry: "disableAllBands",
        invoke: {
          src: "animateSeparationOn",
          onDone: {
            target: "separation-active",
            actions: ["showSeparation", "activateSeparation"],
          },
        },
        on: {
          ROCKET_SELECTION_CHANGED: {
            target: "animating-rockets",
            actions: ["setPendingRockets", "deactivateSeparation"],
          },
        },
      },

      // -----------------------------------------------------------------
      "separation-active": {
        on: {
          ROCKET_SELECTION_CHANGED: {
            // Rockets changed while separation is active — animate to new layout
            // but stay in separation mode (separationActive stays true)
            target: "animating-rockets",
            actions: "setPendingRockets",
          },
          BAND_TOGGLED: {
            guard: "isBandOn",
            // Store for after separation ends — no animation while separated
            actions: "addBandToPending",
          },
          SEPARATION_TOGGLED: {
            guard: "isSepOff",
            target: "animating-separation-off",
            actions: ["hideSeparation", "deactivateSeparation"],
          },
        },
      },

      // -----------------------------------------------------------------
      "animating-separation-off": {
        invoke: {
          src: "animateBands",
          onDone: [
            {
              // If bands were queued while separation was active, play them now
              guard: "hasPendingBands",
              target: "animating-band-on",
            },
            { target: "idle" },
          ],
        },
        on: {
          ROCKET_SELECTION_CHANGED: {
            target: "animating-rockets",
            actions: ["setPendingRockets", "clearPendingBands"],
          },
        },
      },
    },
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function addPending(existing: string[], id: string | null): string[] {
  if (id === null || existing.includes(id)) return existing;
  return [...existing, id];
}
