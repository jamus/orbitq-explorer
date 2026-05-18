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
      isTurningOffActiveDiagram: ({ event, context }) =>
        event.type === "DIAGRAM_TOGGLED" &&
        !event.enable &&
        event.id === context.activeDiagramId,
      isSwitchingDiagram: ({ event, context }) =>
        event.type === "DIAGRAM_TOGGLED" &&
        event.enable &&
        event.id !== context.activeDiagramId,
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
    /** @xstate-layout N4IgpgJg5mDOIC5QGMCGA7Abq2A6AlhADZgDEASgPIDCA0gKIAqA+gMr0Ay91jAkpQDlm1ABIBBAQHF6AEQDaABgC6iUAAcA9rHwAXfBvSqQAD0QAmACwBGXAGYAnAoBsZgKwAaEAE9Er267sADjNAqzcAX3DPNCwcAmIyGV4xSXIxAFlmRkpJSS55ZSNNbT0DI1MESxsHZzdPHwRQ3FdI6IxsPAx8AFtUPXQoAFoAJw1kAGswHVhSCAMwAiwNSdwYjtwu3v6h0Ymp2AR8JbRS9EUlc6KtXX1DJBNEKwB2VwtcCydAl-rEF-t3pyvBTPQKuJ5WCxmVogNZxTZ9I47MaTaazeaLTDLBawzroHoIgYjZH7Q7HBEGc5yKwqe7FG5le4VexPWy4My2Cy2b7eR5WQHvexmKxfFpRGHtOF4raIol7VFzdALI6YlY4jZSglIuUHZVjclnZRyMw09TXU7lR4KVxmNkKWxhDw8hC2T7vPwO6Fq+HbWUomZUOhMNicbh8QTCcRSWSXWlm24WhAQswKXBWZ7C7kNJ4suwWYJJ0HgyGeiW4-E+3Z+0hJFJpTLZXL5GOmkrxxmPLmBZofEU-BBObN2eyuBSBQWFpMl2Jl6WEyv7avJVIZLI5PLR6lXVsM0AVCFW3BPMyAlyOhquJoWaz2JyQifFsVejU+iD4VBQYaobqDAxoxUYrFVlLdVyxlV930-b8DFJTETluSlCljbc7l3R5HCcVM6idKwL1ZMFQgiR9gO9MC3w-L8f3QCgaAYFh2C4Hh+CEUQJGkAoTRAOlzXbRNAn8ZocNPPtHACWxLGzAd7yhIjpxA2chnA8ioKomtl3rNcm0Qlt6RQh5E2zFMhKdMxLFwZkT0ItpZMUyDBlQZA9EwMgA1o4MGLDZjIzY5tOLjHc9KqIdajPS0TNwYFXFPKd1hsij7McxIlzrVdG2jLTfOQhNApqIyGi+PCcss8VrLI2z4vwJzF1rFcG3XeRNyQnSsusILcseawbQhQJOReaLJVAwlYqggAzYa-yVJZVWI59SIgiiNFGmC9VOBCOK4ttUIQZlWXZHqQsTEI3jHbquVFKz1hIwbSvm0bxoAqbZMuhTrpG4alrgilDQa7TuM2tx-ndLCs0CFML1cexTr6mdNUGIaf1ulyg3o0MmIjVi0rWvzdKZHNdtOvsvi7Px0KKp8BueubXqqtSUrqnz1v8ipwaeOwHT7bMjo9GSLpmq7KfhsbVOS2qm2+jKmp4lw3gsQUM32yTcFBCHeuhdANAgOAjBxLcJc2wYnD7fWofiEgdd+vSwhtQr9qeewbGPUnpvJ319jNjaLYsVwbCeSE5YJn27GBWwHBCMFJ25-r5Nhl7KLdxnzBwnab17J0xxtK0rGD8cw4fc64jh8qnLj7HEEhPscIhwOexVvPoZfGOFuG4uE0Bf4njHYL-YCJ4LNFSIgA */
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
              guard: "isTurningOffActiveDiagram",
              target: "animating-diagram-off",
              actions: "hideActiveDiagram",
            },
            {
              // Switch to a different diagram — AppCanvas resolves any column
              // conflicts before sending; machine handles the animation switch.
              guard: "isSwitchingDiagram",
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
