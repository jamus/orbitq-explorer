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
      isBandToggleOn: ({ event }) =>
        event.type === "BAND_TOGGLED" && event.enable,
      isSeparationToggleOn: ({ event }) =>
        event.type === "SEPARATION_TOGGLED" && event.enable,
      isSeparationToggleOff: ({ event }) =>
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
    /** @xstate-layout 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-D-rLPjjlbFd0+HFkdOHHwbFb6Dy0eeXA24c5kkvOPGpIiMpxKZuTBlK5XDWELOBCsgxX4fA2lpA8+NbS2EFkKtF9NZ6rNXkFC+OLNx7h5XfHcTYUaaJCgE4sYE7iDBZR8YxHSzFkIsRCuRXzBnl1NPEMwZZ7CujMHWAYDwbyWmiIhD0sRaXtNMQ08VHqoVlges2ZiJY-UREdMUyw3d8TuHbGxFw0dUhAA */
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
              guard: "isBandToggleOn",
              target: "animating-band-on",
              actions: "addBandToPending",
            },
            {
              actions: "hideBand",
              target: "animating-band-off",
            },
          ],
          SEPARATION_TOGGLED: {
            guard: "isSeparationToggleOn",
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
              guard: "isBandToggleOn",
              actions: "addBandToPending",
            },
            {
              actions: "hideBand",
            },
          ],
          SEPARATION_TOGGLED: {
            guard: "isSeparationToggleOn",
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
              guard: "isBandToggleOn",
              // Add to pending and restart animation to new combined target
              reenter: true,
              actions: "addBandToPending",
            },
            {
              actions: "hideBand",
            },
          ],
          SEPARATION_TOGGLED: {
            guard: "isSeparationToggleOn",
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
              guard: "isBandToggleOn",
              target: "animating-band-on",
              actions: "addBandToPending",
            },
            {
              actions: "hideBand",
            },
          ],
          SEPARATION_TOGGLED: {
            guard: "isSeparationToggleOn",
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
            guard: "isBandToggleOn",
            // Store for after separation ends — no animation while separated
            actions: "addBandToPending",
          },
          SEPARATION_TOGGLED: {
            guard: "isSeparationToggleOff",
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
