import { ref, shallowRef, onMounted, onUnmounted } from "vue";
import type { Ref } from "vue";
import type { RocketConfig } from "@orbitq/graphql";
import Konva from "konva";

const DURATION = 400; // ms
const FADE_DURATION = 200; // ms

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

  const rocketAOpacity = ref(1);
  const rocketBOpacity = ref(1);

  let scaleAnimation: Konva.Animation | null = null;
  let animStartTime: number | null = null;
  let startScale = initialScale;
  let targetScale = initialScale;
  let startBaseline = initialBaseline;
  let targetBaseline = initialBaseline;
  let onComplete: (() => void) | null = null;

  let fadeRocketAnimationA: Konva.Animation | null = null;
  let fadeRocketAnimationB: Konva.Animation | null = null;

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
    fadeRocketAnimationA?.stop();
    fadeRocketAnimationB?.stop();
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

  function fadeRocket(slot: "a" | "b", target: number) {
    const opacityRef = slot === "a" ? rocketAOpacity : rocketBOpacity;
    const layer = layerRef.value?.getNode();
    if (!layer) {
      opacityRef.value = target;
      return;
    }
    if (slot === "a") fadeRocketAnimationA?.stop();
    else fadeRocketAnimationB?.stop();
    const from = opacityRef.value;
    let startTime: number | null = null;
    const anim = new Konva.Animation((frame) => {
      if (!frame) return;
      if (startTime === null) startTime = frame.time;
      const t = Math.min((frame.time - startTime) / FADE_DURATION, 1);
      const eased = target === 0 ? t ** 3 : 1 - (1 - t) ** 3;
      opacityRef.value = from + (target - from) * eased;
      if (t >= 1) {
        anim.stop();
        if (slot === "a") fadeRocketAnimationA = null;
        else fadeRocketAnimationB = null;
      }
    }, layer);
    if (slot === "a") fadeRocketAnimationA = anim;
    else fadeRocketAnimationB = anim;
    anim.start();
  }

  function fadeOut(
    pendingA: RocketConfig | null,
    pendingB: RocketConfig | null,
  ) {
    if (pendingA?.id !== displayRocketA.value?.id) fadeRocket("a", 0);
    if (pendingB?.id !== displayRocketB.value?.id) fadeRocket("b", 0);
  }

  function fadeIn() {
    fadeRocket("a", 1);
    fadeRocket("b", 1);
  }

  return {
    animatedWorldScale,
    animatedBaselineY,
    rocketAOpacity,
    rocketBOpacity,
    displayRocketA,
    displayRocketB,
    animate,
    fadeOut,
    fadeIn,
  };
}
