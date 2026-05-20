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
  activeDiagramId: string | null;
}

export type CanvasEvent =
  | {
      type: "ROCKET_SELECTION_CHANGED";
      rocketA: RocketConfig | null;
      rocketB: RocketConfig | null;
    }
  | { type: "DIAGRAM_OPTION_CHANGED"; id: string; enable: boolean };

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
  getTargetScale: (rockets: (RocketConfig | null)[]) => number;
  getTargetBaseline: (rockets: (RocketConfig | null)[]) => number;
  displayRocketA: () => RocketConfig | null;
  displayRocketB: () => RocketConfig | null;
  setDisplayRockets: (a: RocketConfig | null, b: RocketConfig | null) => void;
  showDiagram: (id: string) => void;
  hideDiagram: (id: string) => void;
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
  function animateAsync(rockets: (RocketConfig | null)[]): Promise<void> {
    return new Promise((resolve) => {
      deps.animate(
        deps.animatedWorldScale(),
        deps.getTargetScale(rockets),
        deps.animatedBaselineY(),
        deps.getTargetBaseline(rockets),
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
      isDiagramOptionOn: ({ event }) =>
        event.type === "DIAGRAM_OPTION_CHANGED" && event.enable,
      hasActiveDiagram: ({ context }) => context.activeDiagramId !== null,
      isTurningOffActiveDiagram: ({ event, context }) =>
        event.type === "DIAGRAM_OPTION_CHANGED" &&
        !event.enable &&
        event.id === context.activeDiagramId,
      isSwitchingDiagram: ({ event, context }) =>
        event.type === "DIAGRAM_OPTION_CHANGED" &&
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
        if (event.type !== "DIAGRAM_OPTION_CHANGED") return {};
        return { activeDiagramId: event.id };
      }),
      clearActiveDiagramId: assign({ activeDiagramId: null }),

      showActiveDiagram: ({ context }) => {
        if (context.activeDiagramId) deps.showDiagram(context.activeDiagramId);
      },
      hideActiveDiagram: ({ context }) => {
        if (context.activeDiagramId) deps.hideDiagram(context.activeDiagramId);
      },

      // Safety net for machine-internal transitions into animating-diagram-on
      // when the incoming diagram is separation (e.g. diagram-active switching).
      // AppCanvas handles the common case before sending the event.
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
        animateAsync([input.a, input.b]),
      ),

      animateDiagramOn: fromPromise(({ input: _id }: { input: string }) =>
        animateAsync(displayRockets()),
      ),

      animateDiagramOff: fromPromise(({ input: _id }: { input: string }) =>
        animateAsync(displayRockets()),
      ),
    },
  }).createMachine({
    /** @xstate-layout N4IgpgJg5mDOIC5QGMCGA7Abq2A6AlhADZgDEASgPIDCA0gKIAqA+gMr0Ay91jAkpQDlm1ABIBBAQHF6AEQDaABgC6iUAAcA9rHwAXfBvSqQAD0QBGAKxncC27YsBmAOwBOAEwA2RwBoQAT0Q3ABYADlwgtxcPELcQpyc3CyCzAF8U3zQsHAJiMhleMUlyMQBZZkoABT5BYXEpWUUVJBBNbT0DI1MES2s7e2d3LwdfAIQQkIdcMxi3VwcHcbMPNIyMbDwMfABbVD10KABaACcNZABrMB1YUggDMAIsDQvcTPXcTZ29w5Pzy9gEfCPNDtdCNRpGVq6fSGZpdNxmMxBGxBaJJaYLEIeEaIFwKSbONwLCwKCwJFxxFYgV7ZD67QHfU4XK43O4PTBPe7UjbobZ0-bHRl-AFAukGMFmJrqLRQjqwwJLBS4EIWFwOIIOBSzNwKMzYsbWIIuI1GiyEoIWFUOSlc948z70gW-ZlUOhMNicbjVISiCTSeTKCHSkGdQKGpy4bUao2xc0uJx64luKaDKJmBRxEKha1rGl2vmHCD4VBQI6oLYHAws9D3QHs5422lfA6F4ul8sGYXs4HQsEB5qQ4NyhAuMzhoIKDzBQ1BZIuCx6keTEIKBJOcfBTGubNZbm8pstktlivoCg0BgsdhcHj8b11P3g-tB6Eh4ej8ITqcuGdmOd6hwj3BcUnGdVQUXEFm3N4DzbA5UGQPRMDIF1z3dK8vVqX0Gj7KU2mfIdESiGxLA8EkQjjBxgmGfxECcFUlTnGINTxDxDUg7JoKPOCELyAoilKcoqhvDD6n9SUWifWVQC6AiPCIiwSIsMinAo9U9UnFwlQcS1R0SdNlTYvAOPLLj8EQ0h8kKYoykqdCfREuQJUDXDJJMHE33HYDp1nedqIQVwDR1TVyQmMiJwM209wdIyKwAMxiqsa0eesc13e1+WijQ4s7U5RVBZQHxwmUYSk8wPDVKYPLAtUImiEIEwcWTxliCctLMBxpjccLGyiotD3bOLT1dC8PWvGo7PvbDxOc4rXIQeFEWRVFkhCzE1KWcIf08MDDWNTrKXQDQIDgIwuScoqXwOLFfIOCxAONe6HtJcLCBIM7BxKhAIj1Mik2VcYFh-TynC6vMmx+Jl4EfaaX0SWIlWao0wNNEc3DUvEKsU7V4RIzMrXSKkUoitKC16mCXIHPCPsUxUnGmWjHA8KJEio0ZMQ03FxmJWiFhR8LopMxC3sp2a2vW4C4y-SdGfjXz3HZ4kUQmUcVSsEHIvS0mj0ymKhZc6TMUmFcQjTUczFiZSgjW2TEUUtMPCcEKzbSNIgA */
    id: "canvas",
    context: {
      pendingRockets: null,
      activeDiagramId: null,
    },
    initial: "idle",
    states: {
      // -----------------------------------------------------------------
      // Diagram options are accepted here and in diagram-active only.
      // Animating states do not handle DIAGRAM_OPTION_CHANGED — the panel
      // is locked during animation so events cannot arrive from the UI.
      // -----------------------------------------------------------------
      idle: {
        on: {
          ROCKET_SELECTION_CHANGED: {
            target: "animating-rockets",
            actions: "setPendingRockets",
          },
          DIAGRAM_OPTION_CHANGED: {
            guard: "isDiagramOptionOn",
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
        },
      },

      // -----------------------------------------------------------------
      "animating-diagram-on": {
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
        },
      },

      // -----------------------------------------------------------------
      "diagram-active": {
        on: {
          ROCKET_SELECTION_CHANGED: {
            target: "animating-rockets",
            actions: "setPendingRockets",
          },
          DIAGRAM_OPTION_CHANGED: [
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
          onDone: {
            target: "idle",
            actions: "clearActiveDiagramId",
          },
        },
        on: {
          ROCKET_SELECTION_CHANGED: {
            target: "animating-rockets",
            actions: "setPendingRockets",
          },
        },
      },
    },
  });
}
