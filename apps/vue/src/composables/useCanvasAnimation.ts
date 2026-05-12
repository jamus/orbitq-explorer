import { ref, shallowRef, onMounted, onUnmounted } from "vue";
import type { Ref } from "vue";
import type { RocketConfig } from "@orbitq/graphql";
import Konva from "konva";

const DURATION = 400; // ms

export function useCanvasAnimation(
  initialScale: number,
  initialBaseline: number,
  layerRef: Ref<any>,
) {
  // Display refs hold the current rendered state, lagging behind live data
  // during transitions. Set in the animate() completion callback once the
  // canvas has settled into its new layout.
  const displayRocketA = shallowRef<RocketConfig | null>(null);
  const displayRocketB = shallowRef<RocketConfig | null>(null);

  // --- Animated values driven by Konva.Animation ---
  const animatedWorldScale = ref(initialScale);
  // Initialise from the no-content default, not baselineY.value — at startup there
  // are no rockets so active layer costs shouldn't apply yet.
  const animatedBaselineY = ref(initialBaseline);

  let scaleAnimation: Konva.Animation | null = null;
  let animStartTime: number | null = null;
  let startScale = initialScale;
  let targetScale = initialScale;
  let startBaseline = initialBaseline;
  let targetBaseline = initialBaseline;
  let onComplete: (() => void) | null = null;

  onMounted(() => {
    scaleAnimation = new Konva.Animation(
      (animationFrame) => {
        if (!animationFrame) return;
        if (animStartTime === null) animStartTime = animationFrame.time;
        const progress = Math.min(
          (animationFrame.time - animStartTime) / DURATION,
          1,
        );
        const easedProgress = 1 - (1 - progress) ** 3;
        animatedWorldScale.value =
          startScale + (targetScale - startScale) * easedProgress;
        animatedBaselineY.value =
          startBaseline + (targetBaseline - startBaseline) * easedProgress;
        if (progress >= 1) {
          scaleAnimation!.stop();
          animStartTime = null;
          const cb = onComplete;
          onComplete = null;
          cb?.();
        }
      },
      (layerRef.value as any)?.getNode(),
    );
  });

  onUnmounted(() => {
    scaleAnimation?.stop();
  });

  function animate(
    fromScale: number,
    toScale: number,
    fromBaseline: number,
    toBaseline: number,
    callback: () => void,
  ) {
    scaleAnimation?.stop();
    animStartTime = null;
    startScale = fromScale;
    targetScale = toScale;
    startBaseline = fromBaseline;
    targetBaseline = toBaseline;
    onComplete = callback;
    scaleAnimation?.start();
  }

  return {
    animatedWorldScale,
    animatedBaselineY,
    displayRocketA,
    displayRocketB,
    animate,
  };
}
