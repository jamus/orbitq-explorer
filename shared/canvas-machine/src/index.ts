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
  // activeDiagramId: the diagram effect currently shown (or being animated to).
  // pendingDiagramId: a diagram effect queued while a rocket animation is running.
  activeDiagramId: string | null;
  pendingDiagramId: string | null;
}

export type CanvasEvent =
  | {
      type: "ROCKET_SELECTION_CHANGED";
      rocketA: RocketConfig | null;
      rocketB: RocketConfig | null;
    }
  | { type: "DIAGRAM_TOGGLED"; id: string; enable: boolean };

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
  // Generic diagram show/hide — AppCanvas routes to the right call per node id.
  showDiagram: (id: string) => void;
  hideDiagram: (id: string) => void;
  // Disables all non-separation diagram nodes — called when entering separation.
  disableEffectNodes: () => void;
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
      isDiagramToggleOn: ({ event }) =>
        event.type === "DIAGRAM_TOGGLED" && event.enable,
      isDiagramToggleOff: ({ event }) =>
        event.type === "DIAGRAM_TOGGLED" && !event.enable,
      hasPendingDiagram: ({ context }) => context.pendingDiagramId !== null,
      hasActiveDiagram: ({ context }) => context.activeDiagramId !== null,
    },

    // ------------------------------------------------------------------
    // Actions
    // ------------------------------------------------------------------
    actions: {
      setPendingRockets: assign(({ event }) => {
        if (event.type !== "ROCKET_SELECTION_CHANGED") return {};
        return { pendingRockets: { a: event.rocketA, b: event.rocketB } };
      }),

      commitRockets: ({ context }) => {
        const r = context.pendingRockets;
        deps.setDisplayRockets(r?.a ?? null, r?.b ?? null);
      },

      setActiveDiagramId: assign(({ event }) => {
        if (event.type !== "DIAGRAM_TOGGLED") return {};
        return { activeDiagramId: event.id };
      }),
      clearActiveDiagramId: assign({ activeDiagramId: null }),

      setPendingDiagramId: assign(({ event }) => {
        if (event.type !== "DIAGRAM_TOGGLED") return {};
        return { pendingDiagramId: event.id };
      }),
      clearPendingDiagramId: assign({ pendingDiagramId: null }),

      // Promote pendingDiagramId → activeDiagramId once a rocket animation settles.
      adoptPendingDiagram: assign(({ context }) => ({
        activeDiagramId: context.pendingDiagramId,
        pendingDiagramId: null,
      })),

      showActiveDiagram: ({ context }) => {
        if (context.activeDiagramId) deps.showDiagram(context.activeDiagramId);
      },
      hideActiveDiagram: ({ context }) => {
        if (context.activeDiagramId) deps.hideDiagram(context.activeDiagramId);
      },

      // Safety net for machine-internal transitions into animating-diagram-on
      // when the incoming diagram is separation (e.g. diagram-active switching).
      // AppCanvas handles the common case before sending the event.
      disableEffectNodesIfSeparation: ({ context }) => {
        if (context.activeDiagramId === "separation") deps.disableEffectNodes();
      },

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

      // Diagram on — branches on id so each node can define its own animation
      // without new machine states (e.g. thrust plume grow, separation spread).
      animateDiagramOn: fromPromise(({ input }: { input: string }) =>
        animateAsync(displayRockets(), input === "separation"),
      ),

      // Diagram off — id passed for future node-specific off-animations
      // (e.g. thrust plume fade before worldscale snaps back).
      animateDiagramOff: fromPromise(({ input: _id }: { input: string }) =>
        // future: if (_id === "thrust") return animateThrustOff();
        animateAsync(displayRockets(), false),
      ),
    },
  }).createMachine({
    id: "canvas",
    context: {
      pendingRockets: null,
      activeDiagramId: null,
      pendingDiagramId: null,
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
          DIAGRAM_TOGGLED: {
            guard: "isDiagramToggleOn",
            target: "animating-diagram-on",
            actions: "setActiveDiagramId",
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
              // A diagram was toggled during the rocket animation — adopt it now.
              guard: "hasPendingDiagram",
              target: "animating-diagram-on",
              actions: ["commitRockets", "fadeIn", "adoptPendingDiagram"],
            },
            {
              // A diagram was already active before rockets changed — resume it.
              guard: "hasActiveDiagram",
              target: "diagram-active",
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
          DIAGRAM_TOGGLED: [
            { guard: "isDiagramToggleOn", actions: "setPendingDiagramId" },
            { actions: "clearPendingDiagramId" },
          ],
        },
      },

      // -----------------------------------------------------------------
      "animating-diagram-on": {
        // Safety net: if the incoming diagram is separation and this is a
        // machine-internal switch, ensure effect nodes are cleared.
        entry: "disableEffectNodesIfSeparation",
        invoke: {
          src: "animateDiagramOn",
          input: ({ context }) => context.activeDiagramId ?? "",
          onDone: {
            target: "diagram-active",
            actions: "showActiveDiagram",
          },
        },
        on: {
          ROCKET_SELECTION_CHANGED: {
            target: "animating-rockets",
            actions: "setPendingRockets",
          },
          DIAGRAM_TOGGLED: {
            guard: "isDiagramToggleOff",
            target: "animating-diagram-off",
            actions: "hideActiveDiagram",
          },
        },
      },

      // -----------------------------------------------------------------
      "diagram-active": {
        on: {
          ROCKET_SELECTION_CHANGED: {
            target: "animating-rockets",
            actions: "setPendingRockets",
          },
          DIAGRAM_TOGGLED: [
            {
              // Turn off the currently active diagram.
              guard: ({ event, context }) =>
                event.type === "DIAGRAM_TOGGLED" &&
                !event.enable &&
                event.id === context.activeDiagramId,
              target: "animating-diagram-off",
              actions: "hideActiveDiagram",
            },
            {
              // Switch to a different diagram — AppCanvas resolves any column
              // conflicts before sending; machine handles the animation switch.
              guard: ({ event, context }) =>
                event.type === "DIAGRAM_TOGGLED" &&
                event.enable &&
                event.id !== context.activeDiagramId,
              target: "animating-diagram-on",
              actions: ["hideActiveDiagram", "setActiveDiagramId"],
            },
          ],
        },
      },

      // -----------------------------------------------------------------
      "animating-diagram-off": {
        invoke: {
          src: "animateDiagramOff",
          input: ({ context }) => context.activeDiagramId ?? "",
          onDone: [
            {
              guard: "hasPendingDiagram",
              target: "animating-diagram-on",
              actions: "adoptPendingDiagram",
            },
            {
              target: "idle",
              actions: "clearActiveDiagramId",
            },
          ],
        },
        on: {
          ROCKET_SELECTION_CHANGED: {
            target: "animating-rockets",
            actions: "setPendingRockets",
          },
          DIAGRAM_TOGGLED: [
            { guard: "isDiagramToggleOn", actions: "setPendingDiagramId" },
            { actions: "clearPendingDiagramId" },
          ],
        },
      },
    },
  });
}
