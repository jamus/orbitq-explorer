import { createMachine, assign, fromPromise } from "xstate";
import { useMachine } from "@xstate/vue";
import type { Ref } from "vue";
import type { RocketConfig } from "@orbitq/graphql";
import type { BandId } from "./useCanvasBands";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PendingRockets {
  a: RocketConfig | null;
  b: RocketConfig | null;
}

interface CanvasContext {
  pendingBands: BandId[];
  pendingRockets: PendingRockets | null;
  // Flag rather than a parallel state — carries separation mode through animating-rockets
  // so onDone can route back to separation-active. If a second such flag is needed,
  // or any transition must branch on a combination of flags, switch to parallel states.
  // See docs/adr/0004-xstate-canvas-machine.md § "Separation persistence across rocket changes".
  separationActive: boolean;
}

export type CanvasEvent =
  | {
      type: "ROCKETS_CHANGED";
      rocketA: RocketConfig | null;
      rocketB: RocketConfig | null;
    }
  | { type: "BAND_TOGGLED"; id: BandId; enable: boolean }
  | { type: "SEPARATION_TOGGLED"; enable: boolean };

// ---------------------------------------------------------------------------
// Deps injected by AppCanvas — all reads happen at dispatch/transition time,
// never captured at machine-creation time, so they always reflect live state.
// ---------------------------------------------------------------------------
export interface CanvasMachineDeps {
  animate: (
    fromScale: number,
    toScale: number,
    fromBaseline: number,
    toBaseline: number,
    callback: () => void,
  ) => void;
  animatedWorldScale: Ref<number>;
  animatedBaselineY: Ref<number>;
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
  displayRocketA: Ref<RocketConfig | null>;
  displayRocketB: Ref<RocketConfig | null>;
  // Effects driven by the machine
  setDisplayRockets: (a: RocketConfig | null, b: RocketConfig | null) => void;
  syncVisibleBands: () => void;
  showBands: (ids: BandId[]) => void;
  hideBand: (id: BandId) => void;
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
        deps.animatedWorldScale.value,
        deps.getTargetScale(rockets, separated),
        deps.animatedBaselineY.value,
        deps.getTargetBaseline(rockets, separated),
        resolve,
      );
    });
  }

  return createMachine(
    {
      /** @xstate-layout N4IgpgJg5mDOIC5QGMCGA7Abq2A6AlhADZgDEASgPIDCA0gKIAqAygPrUASAggHIDi9ACIBtAAwBdRKAAOAe1j4ALvlnopIAB6IAjAE5tuUUaMBmbQHYAbKJPmArACYANCACeiABwGALLr+7zb287E0ttGwBfCJc0LBwCYjIAIV5BVkZKPj4AGSExSSQQOQVlVXUtBD0DY1MLa1tHF3dKh20HXFtdS2t7YO9tbyiYjGw8QhJSFJ40jKzckW0CmXklFTVCiqrDGrMrG3tnN0R9E1w7Nu8rDyDry6GQWNGEieZ6AAUuci5GAElKHnSmRyeQk6mKqzKGx0+m2xl29QOTR0JlEHlwwXM5i8HhCIQ8Hnuj3iGHwAFtUMp0FAALQAJ1kyAA1mBFLBSBBVGACFhZMzcES8CTyZSafSmSzYAh8Dy0KV0Pl8mCVnLyogTCZfLgPLpRN4HNqBg5dUiELo9bhzBrQqJAg4TI4CdEHiNiegyRTpaKGczWezOdzMLyuQLcEKPVS6d6JVKZR7VArFkqSmtVQh1UaLb4sSYDfaPOYTdpzqd811LPY7HZvLq7ISXYK3cLPZHxb6qHQmGxOLwBCJQYVwSqoWmcaJcK0cXZLCY-OZdPmTZXLLhug5LEbUUWHGu63EG+6RS2fWypjMgfNFQPlSnhznt1run47FYZ2a7CbvNYzrd5-OHI4AN3J4w0PMVj0mVJATmPJEyvZNIVACoc1Rccy0tf9-3MQ5mlCbwzlEadMXxe0HDnIDXQPZswIlUhXg+L5fn+KDgT7JYimvBDNDVbwPDHURdDzStcP0Rc2lwbQLAsHUBJxctyP3JsIwAIwwCBqVUP10C5aVAz5EMQObFT0DU1QY0DWU1gVftlng9ZEM8WwV2rOx9DsDx-zCd8jkqGtx3XS5gg8XDBidfTG3DGkjJM9AKBoBgWHYbh+BBNjBxvezKgC8cvCk39URCE1QjRZ8cpxII8wceTQ3Cw8ovUmLT2Yi9rPY2zUwkgSzhnURwn4vFRC85oujsDoLksXxtFfG0qoM5TVPqiDpiamDUo4uyuMqCw0S6DxLHzNyZ2fAtvN23RxytbwcwGPx1RmmrDPmjS6M+b4-gBWYWMvGyIXWzYsv1CS5zynETELAi8PCItq1scwBr2u7KLm4z1IAMxRzTtJ5PT62qxHIsetGzIZON5QkL7Wp+9qYRqGw6n2RoTu6QwxorIL820BHFPx5HZDR2KOwS7tktYpNKeHILzCcgbXPcqcixNbcRpsHVnz8HiXMsTmIupOrefRxqPua1a2vFxzxulotZc8k1dFadFYa8NdCKw8wtdqgn9cgw2VtFocMpCdoTH1fj9ExS6cxNOc0V48sHACS7bdIt2Hp5vnnoYt7lpFuCxYyiWpZcy2PPl7zAjRHjLv6axK3sXRk4jWAwGkVBaRJhaOS0gMg35HHZppRvm9buV6qJiz4zJlq0s4iojX-DodUufNxu0a5Qe88IvHRWweKxEJdGfWtQt7+6G6blu2409t4q7JLe3JqffsQWeRu6xerH6VeTUsSsVynO0unDpWEKww9y4AHufYeqBkDKEwGQK+nZEo9hSr7dKG01z3m1LqdUehfCDUQEDcS+8UQ9VtmVDmR9QHgKHmsakUCYHJC9ueZBOc-ZoNCMucwK9nyXG-m5bQYN7x7TLrtPUrQzBVSoW3Oh+BYG0XeC9Ri70mHZ2+qwme652iYPDjg-eYN5yGH8tccI-47Conrv3M+1DVCo3Rh3TGulgzHzxtSSRw89ajxJlZY2uc0Hf3aLTG07kLBzjcoWIOY596YjnP0AIpFNYUOAifCxg8L58zsV3bGoC+4uMsaklGHi5QJm8Wop+GitQL2wWaXR69LpjlhkRbQ659A3HMTklJbi+bwMFrfZhqjUFIXCZmAIbMThuWOs0NoZpxJCLtMWDEh8nToFkBAOA6gBQoOnogaklgTTbNhDTGmnCqrjDABsx+CA9SFhCHhNc6o9RVnVLqR0IDEnOOoqyM5qYczTnHL4XiqIbStBtF-Z8mYbT9BXgNSqCSKJcx1o9daD92p2jHBOSwJwvAzm8GDJm3U3LWEmfiVpus0afOHG5QOgQAjZnLF4PBCBtRnXxOrVEepbY9Vaa4mhnEkXDmCZLCua5MQDUadOMGpjykDV4vaSalZnnOkobkyB0CZGnJYf0p+r4nKy0dnHO0hY2inCsFOfigQ2jhEPi82F2suXWL1mSjKKIcRb3QiYsI056WTNOJEoK6pq6yyiFEIAA */
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
            ROCKETS_CHANGED: {
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
            ROCKETS_CHANGED: {
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
                [deps.displayRocketA.value, deps.displayRocketB.value],
                false,
              ),
            ),
            onDone: {
              target: "idle",
              actions: ["showPendingBands", assign({ pendingBands: [] })],
            },
          },
          on: {
            ROCKETS_CHANGED: {
              target: "animating-rockets",
              actions: [
                assign(({ event }) => ({
                  pendingRockets: { a: event.rocketA, b: event.rocketB },
                  pendingBands: [] as BandId[],
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
              actions: assign({ pendingBands: [] as BandId[] }),
            },
          },
        },

        // -----------------------------------------------------------------
        "animating-band-off": {
          invoke: {
            src: fromPromise(() =>
              animateAsync(
                [deps.displayRocketA.value, deps.displayRocketB.value],
                false,
              ),
            ),
            onDone: "idle",
          },
          on: {
            ROCKETS_CHANGED: {
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
                [deps.displayRocketA.value, deps.displayRocketB.value],
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
            ROCKETS_CHANGED: {
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
            ROCKETS_CHANGED: {
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
                [deps.displayRocketA.value, deps.displayRocketB.value],
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
            ROCKETS_CHANGED: {
              target: "animating-rockets",
              actions: assign(({ event }) => ({
                pendingRockets: { a: event.rocketA, b: event.rocketB },
                pendingBands: [] as BandId[],
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

export function useCanvasMachine(deps: CanvasMachineDeps) {
  return useMachine(createCanvasMachine(deps));
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function addPending(existing: BandId[], id: BandId | null): BandId[] {
  if (id === null || existing.includes(id)) return existing;
  return [...existing, id];
}
