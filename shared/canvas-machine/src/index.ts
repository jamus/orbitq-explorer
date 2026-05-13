import { createMachine, assign, fromPromise } from "xstate";
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

  return createMachine(
    {
      /** @xstate-layout N4IgpgJg5mDOIC5QGMCGA7Abq2A6AlhADZgDEASgPIDCA0gKIAqAygPrUASAggHIDi9ACIBtAAwBdRKAAOAe1j4ALvlnopIAB6IAjAE5tuUUaMBmbQHYAbKJPmArACYANCACeiABwGALLr+7zb287E0tdGwBfCJc0LBwCYjIAIV5BVkZKPj4AGSExSSQQOQVlVXUtBD0DY1MLa1tHF3dKh20HXFtdS2t7YO9tbyiYjGw8QhJSFJ40jKzckW0CmXklFTVCiqrDGrMrG3tnN0R9E1w7Nu8rDyDry6GQWNGEieZ6AAUuci5GAElKHnSmRyeQk6mKqzKGx0+m2xl29QOTR0JlEHlwwXM5i8HhCIQ8Hnuj3iGHwAFtUMp0FAALQAJ1kyAA1mBFLBSBBVGACFhZMzcES8CTyZSafSmSzYAh8Dy0KV0Pl8mCVnLyogTCZfLgPLpRN4HNqBg5dUiELo9bhzBrQqJAg4TI4CdEHiNiegyRTpaKGczWezOdzMLyuQLcEKPVS6d6JVKZR7VArFkqSmtVQh1UaLb4sSYDfaPOYTdpzqd8114vY7HZvLq7ISXYK3cLPZHxb6qHQmGxOLwBCJQYVwSqoWmcaJcK0cXZLCY-OZdPmTZXLLhug5LEbUUWHGu63EG+6RS2fWypjMgfNFQPlSnhznt1rum47FYZ2a7CbvNYzrd5-OHI4AN3J4w0PMVj0mVJATmPJEyvZNIVACoc1Rccy0tf9-3MQ5mlCbwzlEadMXxe0HDnIDXQPZswIlUhXg+L5fn+KDgT7JYimvBDNDVbwPDHURdDzStcP0Rc2lwbQLAsHUBJxctyP3JsIwAIwwCBqVUP10C5aVAz5EMQObFT0DU1QY0DWU1gVftlng9ZEM8WwV2rOx9DsDx-zCd8jkqGtx3XS5gg8XDBidfTG3DGkjJM9AKBoBgWHYbh+BBNjBxvezKgC8cvCk39URCE1QjRZ8cpxII8wceTQ3Cw8ovUmLT2Yi9rPY2zUwkgSzhnURwn4vFRC85oujsDoLksXxtFfG0qoM5TVPqiDpiamDUo4uyuMqCw0S6DxLHzNyZ2fAtvN23RxytbwcwGPx1RmmrDPmjS6M+b4-gBWYWMvGyIXWzYsv1CS5zynETELAi8PCItq1scwBr2u7KLm4z1IAMxRzTtJ5PT62qxHIsetGzIZON5QkL7Wp+9qYRqGo7GMSkQpOcI4lOaJMJw99I2w3IFq3UrNVKyc-0i0JLHLCj8ywvJ6mCbQ9DqvEWLmSdJ0YzGFmFB4kZo6pnJxnNlUBOyJI0N3lqLBq3v2x7ngSNqeo6yJGGe4bRvG8IAGlJMm00gA */
      id: "canvas",
      types: {} as { context: CanvasContext; events: CanvasEvent },
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
              actions: assign(({ event }) => ({
                pendingRockets: { a: event.rocketA, b: event.rocketB },
              })),
            },
            BAND_TOGGLED: [
              {
                guard: ({ event }) =>
                  event.type === "BAND_TOGGLED" && event.enable,
                target: "animating-band-on",
                actions: assign(({ context, event }) => ({
                  pendingBands: addPending(
                    context.pendingBands,
                    event.type === "BAND_TOGGLED" ? event.id : null,
                  ),
                })),
              },
              {
                actions: ({ event }) => {
                  if (event.type === "BAND_TOGGLED") deps.hideBand(event.id);
                },
                target: "animating-band-off",
              },
            ],
            SEPARATION_TOGGLED: {
              guard: ({ event }) =>
                event.type === "SEPARATION_TOGGLED" && event.enable,
              target: "animating-separation-on",
            },
          },
        },

        // -----------------------------------------------------------------
        "animating-rockets": {
          invoke: {
            src: fromPromise(({ input }: { input: PendingRockets }) =>
              animateAsync([input.a, input.b], false),
            ),
            input: ({ context }): PendingRockets =>
              context.pendingRockets ?? { a: null, b: null },
            onDone: [
              {
                guard: ({ context }) => context.separationActive,
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
              actions: assign(({ event }) => ({
                pendingRockets: { a: event.rocketA, b: event.rocketB },
              })),
            },
            BAND_TOGGLED: [
              {
                guard: ({ event }) =>
                  event.type === "BAND_TOGGLED" && event.enable,
                actions: assign(({ context, event }) => ({
                  pendingBands: addPending(
                    context.pendingBands,
                    event.type === "BAND_TOGGLED" ? event.id : null,
                  ),
                })),
              },
              {
                actions: ({ event }) => {
                  if (event.type === "BAND_TOGGLED") deps.hideBand(event.id);
                },
              },
            ],
            SEPARATION_TOGGLED: {
              guard: ({ event }) =>
                event.type === "SEPARATION_TOGGLED" && event.enable,
              target: "animating-separation-on",
              actions: assign({ pendingRockets: null }),
            },
          },
        },

        // -----------------------------------------------------------------
        "animating-band-on": {
          invoke: {
            src: fromPromise(() =>
              animateAsync(
                [deps.displayRocketA(), deps.displayRocketB()],
                false,
              ),
            ),
            onDone: {
              target: "idle",
              actions: ["showPendingBands", assign({ pendingBands: [] })],
            },
          },
          on: {
            ROCKET_SELECTION_CHANGED: {
              target: "animating-rockets",
              actions: [
                assign(({ event }) => ({
                  pendingRockets: { a: event.rocketA, b: event.rocketB },
                  pendingBands: [] as string[],
                })),
              ],
            },
            BAND_TOGGLED: [
              {
                guard: ({ event }) =>
                  event.type === "BAND_TOGGLED" && event.enable,
                // Add to pending and restart animation to new combined target
                reenter: true,
                actions: assign(({ context, event }) => ({
                  pendingBands: addPending(
                    context.pendingBands,
                    event.type === "BAND_TOGGLED" ? event.id : null,
                  ),
                })),
              },
              {
                actions: ({ event }) => {
                  if (event.type === "BAND_TOGGLED") deps.hideBand(event.id);
                },
              },
            ],
            SEPARATION_TOGGLED: {
              guard: ({ event }) =>
                event.type === "SEPARATION_TOGGLED" && event.enable,
              target: "animating-separation-on",
              actions: assign({ pendingBands: [] as string[] }),
            },
          },
        },

        // -----------------------------------------------------------------
        "animating-band-off": {
          invoke: {
            src: fromPromise(() =>
              animateAsync(
                [deps.displayRocketA(), deps.displayRocketB()],
                false,
              ),
            ),
            onDone: "idle",
          },
          on: {
            ROCKET_SELECTION_CHANGED: {
              target: "animating-rockets",
              actions: assign(({ event }) => ({
                pendingRockets: { a: event.rocketA, b: event.rocketB },
              })),
            },
            BAND_TOGGLED: [
              {
                guard: ({ event }) =>
                  event.type === "BAND_TOGGLED" && event.enable,
                target: "animating-band-on",
                actions: assign(({ context, event }) => ({
                  pendingBands: addPending(
                    context.pendingBands,
                    event.type === "BAND_TOGGLED" ? event.id : null,
                  ),
                })),
              },
              {
                actions: ({ event }) => {
                  if (event.type === "BAND_TOGGLED") deps.hideBand(event.id);
                },
              },
            ],
            SEPARATION_TOGGLED: {
              guard: ({ event }) =>
                event.type === "SEPARATION_TOGGLED" && event.enable,
              target: "animating-separation-on",
            },
          },
        },

        // -----------------------------------------------------------------
        "animating-separation-on": {
          entry: () => deps.disableAllBands(),
          invoke: {
            src: fromPromise(() =>
              animateAsync(
                [deps.displayRocketA(), deps.displayRocketB()],
                true,
              ),
            ),
            onDone: {
              target: "separation-active",
              actions: [
                () => deps.setSeparationVisible(true),
                assign({ separationActive: true }),
              ],
            },
          },
          on: {
            ROCKET_SELECTION_CHANGED: {
              target: "animating-rockets",
              actions: assign(({ event }) => ({
                pendingRockets: { a: event.rocketA, b: event.rocketB },
                separationActive: false,
              })),
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
              actions: assign(({ event }) => ({
                pendingRockets: { a: event.rocketA, b: event.rocketB },
              })),
            },
            BAND_TOGGLED: {
              guard: ({ event }) =>
                event.type === "BAND_TOGGLED" && event.enable,
              // Store for after separation ends — no animation while separated
              actions: assign(({ context, event }) => ({
                pendingBands: addPending(
                  context.pendingBands,
                  event.type === "BAND_TOGGLED" ? event.id : null,
                ),
              })),
            },
            SEPARATION_TOGGLED: {
              guard: ({ event }) =>
                event.type === "SEPARATION_TOGGLED" && !event.enable,
              target: "animating-separation-off",
              actions: [
                () => deps.setSeparationVisible(false),
                assign({ separationActive: false }),
              ],
            },
          },
        },

        // -----------------------------------------------------------------
        "animating-separation-off": {
          invoke: {
            src: fromPromise(() =>
              animateAsync(
                [deps.displayRocketA(), deps.displayRocketB()],
                false,
              ),
            ),
            onDone: [
              {
                // If bands were queued while separation was active, play them now
                guard: ({ context }) => context.pendingBands.length > 0,
                target: "animating-band-on",
              },
              { target: "idle" },
            ],
          },
          on: {
            ROCKET_SELECTION_CHANGED: {
              target: "animating-rockets",
              actions: assign(({ event }) => ({
                pendingRockets: { a: event.rocketA, b: event.rocketB },
                pendingBands: [] as string[],
              })),
            },
          },
        },
      },
    },
    {
      actions: {
        commitRockets: ({ context }) => {
          const r = context.pendingRockets;
          deps.setDisplayRockets(r?.a ?? null, r?.b ?? null);
        },
        syncVisibleBands: () => deps.syncVisibleBands(),
        showPendingBands: ({ context }) => deps.showBands(context.pendingBands),
      },
    },
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function addPending(existing: string[], id: string | null): string[] {
  if (id === null || existing.includes(id)) return existing;
  return [...existing, id];
}
