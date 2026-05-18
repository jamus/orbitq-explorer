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
  pendingRockets: PendingRockets | null;
  separationActive: boolean;
  // activeNodeId: diagram-affecting node currently displayed (or being animated to).
  // pendingNodeId: diagram-affecting node queued while a rocket animation runs.
  activeNodeId: string | null;
  pendingNodeId: string | null;
}

export type CanvasEvent =
  | {
      type: "ROCKET_SELECTION_CHANGED";
      rocketA: RocketConfig | null;
      rocketB: RocketConfig | null;
    }
  | { type: "NODE_TOGGLED"; id: string; enable: boolean }
  | { type: "SEPARATION_TOGGLED"; enable: boolean };

// ---------------------------------------------------------------------------
// Deps injected by the canvas component.
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
  getTargetScale: (
    rockets: (RocketConfig | null)[],
    separated: boolean,
  ) => number;
  getTargetBaseline: (
    rockets: (RocketConfig | null)[],
    separated: boolean,
  ) => number;
  displayRocketA: () => RocketConfig | null;
  displayRocketB: () => RocketConfig | null;
  setDisplayRockets: (a: RocketConfig | null, b: RocketConfig | null) => void;
  setSeparationVisible: (v: boolean) => void;
  // Node rendering control — called by machine to sync visible state with animation.
  showNode: (id: string) => void;
  hideNode: (id: string) => void;
  disableAllDiagramNodes: () => void;
  fadeOut: (
    pendingA: RocketConfig | null,
    pendingB: RocketConfig | null,
  ) => void;
  fadeIn: () => void;
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

  const displayRockets = () => [deps.displayRocketA(), deps.displayRocketB()];

  return setup({
    types: {} as { context: CanvasContext; events: CanvasEvent },

    // ------------------------------------------------------------------
    // Guards
    // ------------------------------------------------------------------
    guards: {
      isNodeToggleOn: ({ event }) =>
        event.type === "NODE_TOGGLED" && event.enable,
      isNodeToggleOff: ({ event }) =>
        event.type === "NODE_TOGGLED" && !event.enable,
      isSeparationToggleOn: ({ event }) =>
        event.type === "SEPARATION_TOGGLED" && event.enable,
      isSeparationToggleOff: ({ event }) =>
        event.type === "SEPARATION_TOGGLED" && !event.enable,
      isSeparationActive: ({ context }) => context.separationActive,
      hasPendingNode: ({ context }) => context.pendingNodeId !== null,
    },

    // ------------------------------------------------------------------
    // Actions
    // ------------------------------------------------------------------
    actions: {
      setPendingRockets: assign(({ event }) => {
        if (event.type !== "ROCKET_SELECTION_CHANGED") return {};
        return { pendingRockets: { a: event.rocketA, b: event.rocketB } };
      }),
      clearPendingRockets: assign({ pendingRockets: null }),

      commitRockets: ({ context }) => {
        const r = context.pendingRockets;
        deps.setDisplayRockets(r?.a ?? null, r?.b ?? null);
      },

      setActiveNodeId: assign(({ event }) => {
        if (event.type !== "NODE_TOGGLED") return {};
        return { activeNodeId: event.id };
      }),
      clearActiveNodeId: assign({ activeNodeId: null }),

      setPendingNodeId: assign(({ event }) => {
        if (event.type !== "NODE_TOGGLED") return {};
        return { pendingNodeId: event.id };
      }),
      clearPendingNodeId: assign({ pendingNodeId: null }),

      // Move pendingNodeId → activeNodeId (after a rocket animation with a queued node).
      adoptPendingNode: assign(({ context }) => ({
        activeNodeId: context.pendingNodeId,
        pendingNodeId: null,
      })),

      showActiveNode: ({ context }) => {
        if (context.activeNodeId) deps.showNode(context.activeNodeId);
      },
      hideActiveNode: ({ context }) => {
        if (context.activeNodeId) deps.hideNode(context.activeNodeId);
      },

      // Used when entering separation: disable all diagram nodes via the composable
      // (updates both enabled and visible states in useNodeGrid).
      disableAllDiagramNodes: () => deps.disableAllDiagramNodes(),

      activateSeparation: assign({ separationActive: true }),
      deactivateSeparation: assign({ separationActive: false }),
      showSeparation: () => deps.setSeparationVisible(true),
      hideSeparation: () => deps.setSeparationVisible(false),

      fadeOut: ({ context }) =>
        deps.fadeOut(
          context.pendingRockets?.a ?? null,
          context.pendingRockets?.b ?? null,
        ),
      fadeIn: () => deps.fadeIn(),
    },

    // ------------------------------------------------------------------
    // Actors
    // ------------------------------------------------------------------
    actors: {
      animateRockets: fromPromise(({ input }: { input: PendingRockets }) =>
        animateAsync([input.a, input.b], false),
      ),
      // Animates to current display rockets at their natural (non-separated) scale.
      // getTargetScale reads thrustEnabled reactively, so the result is correct whether
      // a diagram node is being turned on or off.
      animateDefault: fromPromise(() => animateAsync(displayRockets(), false)),
      animateSeparationOn: fromPromise(() =>
        animateAsync(displayRockets(), true),
      ),
    },
  }).createMachine({
    id: "canvas",
    context: {
      pendingRockets: null,
      separationActive: false,
      activeNodeId: null,
      pendingNodeId: null,
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
          NODE_TOGGLED: {
            guard: "isNodeToggleOn",
            target: "animating-node-on",
            actions: "setActiveNodeId",
          },
          SEPARATION_TOGGLED: {
            guard: "isSeparationToggleOn",
            target: "animating-separation-on",
          },
        },
      },

      // -----------------------------------------------------------------
      "animating-rockets": {
        entry: "fadeOut",
        invoke: {
          src: "animateRockets",
          input: ({ context }): PendingRockets =>
            context.pendingRockets ?? { a: null, b: null },
          onDone: [
            {
              guard: "hasPendingNode",
              target: "animating-node-on",
              actions: ["commitRockets", "fadeIn", "adoptPendingNode"],
            },
            {
              guard: "isSeparationActive",
              target: "separation-active",
              actions: ["commitRockets", "fadeIn"],
            },
            {
              target: "idle",
              actions: ["commitRockets", "fadeIn"],
            },
          ],
        },
        on: {
          ROCKET_SELECTION_CHANGED: {
            reenter: true,
            actions: "setPendingRockets",
          },
          NODE_TOGGLED: [
            { guard: "isNodeToggleOn", actions: "setPendingNodeId" },
            { actions: "clearPendingNodeId" },
          ],
          SEPARATION_TOGGLED: {
            guard: "isSeparationToggleOn",
            target: "animating-separation-on",
            actions: "clearPendingRockets",
          },
        },
      },

      // -----------------------------------------------------------------
      "animating-node-on": {
        invoke: {
          src: "animateDefault",
          onDone: {
            target: "node-active",
            actions: "showActiveNode",
          },
        },
        on: {
          ROCKET_SELECTION_CHANGED: {
            target: "animating-rockets",
            actions: "setPendingRockets",
          },
          NODE_TOGGLED: {
            guard: "isNodeToggleOff",
            target: "animating-node-off",
            actions: "hideActiveNode",
          },
          SEPARATION_TOGGLED: {
            guard: "isSeparationToggleOn",
            target: "animating-separation-on",
            actions: ["hideActiveNode", "clearActiveNodeId"],
          },
        },
      },

      // -----------------------------------------------------------------
      "node-active": {
        on: {
          ROCKET_SELECTION_CHANGED: {
            target: "animating-rockets",
            actions: "setPendingRockets",
          },
          NODE_TOGGLED: {
            guard: "isNodeToggleOff",
            target: "animating-node-off",
            actions: "hideActiveNode",
          },
          SEPARATION_TOGGLED: {
            guard: "isSeparationToggleOn",
            target: "animating-separation-on",
            actions: ["hideActiveNode", "clearActiveNodeId"],
          },
        },
      },

      // -----------------------------------------------------------------
      "animating-node-off": {
        invoke: {
          src: "animateDefault",
          onDone: {
            target: "idle",
            actions: "clearActiveNodeId",
          },
        },
        on: {
          ROCKET_SELECTION_CHANGED: {
            target: "animating-rockets",
            actions: "setPendingRockets",
          },
          NODE_TOGGLED: {
            guard: "isNodeToggleOn",
            target: "animating-node-on",
            actions: "setActiveNodeId",
          },
          SEPARATION_TOGGLED: {
            guard: "isSeparationToggleOn",
            target: "animating-separation-on",
          },
        },
      },

      // -----------------------------------------------------------------
      "animating-separation-on": {
        // AppCanvas disables all diagram nodes (CSS + visible) before sending this
        // event, so no entry action needed — disableAllDiagramNodes is a safety net
        // for machine-internal transitions (e.g. node-active → here).
        entry: "disableAllDiagramNodes",
        invoke: {
          src: "animateSeparationOn",
          onDone: {
            target: "separation-active",
            actions: ["showSeparation", "activateSeparation", "fadeIn"],
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
            target: "animating-rockets",
            actions: "setPendingRockets",
          },
          NODE_TOGGLED: {
            guard: "isNodeToggleOn",
            target: "animating-node-on",
            actions: [
              "hideSeparation",
              "deactivateSeparation",
              "setActiveNodeId",
            ],
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
          src: "animateDefault",
          onDone: [
            {
              guard: "hasPendingNode",
              target: "animating-node-on",
              actions: "adoptPendingNode",
            },
            { target: "idle" },
          ],
        },
        on: {
          ROCKET_SELECTION_CHANGED: {
            target: "animating-rockets",
            actions: "setPendingRockets",
          },
          NODE_TOGGLED: {
            guard: "isNodeToggleOn",
            actions: "setPendingNodeId",
          },
        },
      },
    },
  });
}
