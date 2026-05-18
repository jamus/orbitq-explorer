import { computed } from "vue";
import { useMachine } from "@xstate/vue";
import { createCanvasMachine } from "@orbitq/canvas-machine";
import type { CanvasMachineDeps, CanvasEvent } from "@orbitq/canvas-machine";

export type { CanvasMachineDeps, CanvasEvent };

export function useCanvasMachine(deps: CanvasMachineDeps) {
  const { snapshot, send, actorRef } = useMachine(createCanvasMachine(deps));

  const isAnimating = computed(() =>
    (
      [
        "animating-rockets",
        "animating-diagram-on",
        "animating-diagram-off",
      ] as const
    ).includes(snapshot.value.value as never),
  );

  return { snapshot, send, actorRef, isAnimating };
}
