import { useMachine } from "@xstate/vue";
import { createCanvasMachine } from "@orbitq/canvas-machine";
import type { CanvasMachineDeps, CanvasEvent } from "@orbitq/canvas-machine";

export type { CanvasMachineDeps, CanvasEvent };

export function useCanvasMachine(deps: CanvasMachineDeps) {
  return useMachine(createCanvasMachine(deps));
}
