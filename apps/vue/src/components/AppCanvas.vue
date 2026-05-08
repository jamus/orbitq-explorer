<script setup lang="ts">
import { computed, ref, shallowRef, watch, onMounted, onUnmounted } from "vue";
import { useQuery } from "@vue/apollo-composable";
import { ROCKET_CONFIGS_BY_IDS } from "@orbitq/graphql";
import type {
  RocketConfigsQuery,
  RocketConfigsByIdsQuery,
  RocketConfigsByIdsVariables,
  RocketConfig,
} from "@orbitq/graphql";
import Konva from "konva";
import RocketImage from "./RocketImage.vue";
import HumanFigure from "./HumanFigure.vue";
import { diagrams } from "../const/diagrams";

type SlimRocket = RocketConfigsQuery["rocketConfigs"][number];

const props = defineProps<{
  rocketA: SlimRocket | null;
  rocketB: SlimRocket | null;
}>();

const ids = computed(() =>
  [props.rocketA?.id, props.rocketB?.id]
    .filter((id): id is number => id != null)
    .sort((a, b) => a - b),
);

const { result } = useQuery<
  RocketConfigsByIdsQuery,
  RocketConfigsByIdsVariables
>(
  ROCKET_CONFIGS_BY_IDS,
  () => ({ ids: ids.value }),
  () => ({ enabled: ids.value.length > 0 }),
);

const rockets = computed<RocketConfig[]>(
  () => result.value?.rocketConfigsByIds ?? [],
);

const rocketAData = computed(() => {
  if (!props.rocketA) return null;
  return rockets.value.find((r) => r.id === props.rocketA!.id) ?? null;
});

const rocketBData = computed(() => {
  if (!props.rocketB) return null;
  return rockets.value.find((r) => r.id === props.rocketB!.id) ?? null;
});

// Canvas fills the full viewport minus the 56px top nav bar.
const canvasWidth = window.innerWidth;
const canvasHeight = window.innerHeight - 56;

// Rockets sit with their base at 82% down the canvas, leaving headroom above
// and a ground strip below for labels / future ground-line artwork.
const baselineY = canvasHeight * 0.82;

// When no rockets are loaded, fall back to a scale where the human fills ~40% of
// the canvas — keeping it visible as a standing reference figure.
const humanOnlyScale = (canvasHeight * 0.4) / 1.75;

// --- Display refs: hold current rendered state, lag behind live data during animation ---
const displayRocketA = shallowRef<RocketConfig | null>(null);
const displayRocketB = shallowRef<RocketConfig | null>(null);

// --- Animated scale driven by Konva.Animation ---
const animatedWorldScale = ref<number>(humanOnlyScale);
const layerRef = ref(null);

const DURATION = 400; // ms
let scaleAnimation: Konva.Animation | null = null;
let animStartTime: number | null = null;
let startScale = humanOnlyScale;
let targetScale = humanOnlyScale;
let onComplete: (() => void) | null = null;

onMounted(() => {
  scaleAnimation = new Konva.Animation(
    (animationFrame) => {
      if (!animationFrame) return; // Konva may call with no frame on the first tick
      if (animStartTime === null) animStartTime = animationFrame.time; // anchor elapsed time to this sequence, not the animation's lifetime
      const progress = Math.min(
        (animationFrame.time - animStartTime) / DURATION,
        1,
      ); // 0→1 progress, clamped
      const easedProgress = 1 - (1 - progress) ** 3; // ease-out-cubic: fast start, smooth landing
      animatedWorldScale.value =
        startScale + (targetScale - startScale) * easedProgress; // interpolate; writing the ref repaints all three canvas images
      if (progress >= 1) {
        scaleAnimation!.stop();
        animStartTime = null; // reset so the next .start() gets a fresh baseline
        const cb = onComplete;
        onComplete = null;
        cb?.(); // swap in the incoming rocket data now that scale has settled
      }
    },
    (layerRef.value as any)?.getNode(), // tell Konva which layer to redraw each frame
  );
});

onUnmounted(() => {
  scaleAnimation?.stop();
});

function animate(from: number, to: number, callback: () => void): void {
  scaleAnimation?.stop();
  animStartTime = null;
  startScale = from;
  targetScale = to;
  onComplete = callback;
  scaleAnimation?.start();
}

watch([rocketAData, rocketBData], ([newA, newB]) => {
  // Skip while a selected rocket's query is still in-flight (prop set, data not yet back).
  // Without this guard the watcher fires twice: once for the intermediate null state
  // and again when data arrives, causing two consecutive scale animations.
  if ((props.rocketA && !newA) || (props.rocketB && !newB)) return;

  const newMaxLength = Math.max(newA?.length ?? 0, newB?.length ?? 0);
  const newTargetScale =
    newMaxLength > 0 ? (canvasHeight * 0.7) / newMaxLength : humanOnlyScale;
  animate(animatedWorldScale.value, newTargetScale, () => {
    displayRocketA.value = newA ?? null;
    displayRocketB.value = newB ?? null;
  });
});

const HUMAN_NATIVE_W = 30;
const HUMAN_NATIVE_H = 175;
const HUMAN_REAL_H_M = 1.75;
const EDGE_GAP = 80; // px between human edge and rocket edge, constant in screen space
const CANVAS_PAD = 20;

const xHuman = canvasWidth * 0.5;

const humanHalfW = computed(
  () =>
    (HUMAN_NATIVE_W *
      (HUMAN_REAL_H_M / HUMAN_NATIVE_H) *
      animatedWorldScale.value) /
    2,
);

function rocketHalfW(rocket: RocketConfig | null): number {
  if (!rocket) return 0;
  const entry = diagrams[rocket.id];
  if (!entry) return 0;
  if (!rocket.length) return 0;
  return (
    (entry.nativeWidth *
      (rocket.length / entry.nativeHeight) *
      animatedWorldScale.value) /
    2
  );
}

const rocketAnchorX = (rocketHalfWidth: number, direction: -1 | 1) =>
  xHuman + direction * (humanHalfW.value + EDGE_GAP + rocketHalfWidth);

const leftRocketX = computed(() => {
  const hw = rocketHalfW(displayRocketA.value);
  return Math.max(rocketAnchorX(hw, -1), hw + CANVAS_PAD);
});

const rightRocketX = computed(() => {
  const hw = rocketHalfW(displayRocketB.value);
  return Math.min(rocketAnchorX(hw, 1), canvasWidth - hw - CANVAS_PAD);
});

const stageConfig = { width: canvasWidth, height: canvasHeight };
</script>

<template>
  <div class="relative">
    <v-stage :config="stageConfig">
      <v-layer ref="layerRef">
        <RocketImage
          v-if="displayRocketA"
          :rocket="displayRocketA"
          :x="leftRocketX"
          :baselineY="baselineY"
          :worldScale="animatedWorldScale"
        />
        <RocketImage
          v-if="displayRocketB"
          :rocket="displayRocketB"
          :x="rightRocketX"
          :baselineY="baselineY"
          :worldScale="animatedWorldScale"
        />
        <HumanFigure
          :x="xHuman"
          :baselineY="baselineY"
          :worldScale="animatedWorldScale"
        />
      </v-layer>
    </v-stage>
    <!-- DEBUG: remove before ship -->
    <div
      class="absolute top-2 right-2 font-mono text-xs text-status-warning space-y-0.5 pointer-events-none text-right"
    >
      <div>animatedWorldScale: {{ animatedWorldScale.toFixed(4) }}</div>
      <div>
        baselineY: {{ baselineY.toFixed(0) }} xA: {{ leftRocketX }} xB:
        {{ rightRocketX }}
      </div>
      <div>
        A:
        {{
          displayRocketA
            ? `id=${displayRocketA.id} len=${displayRocketA.length}m`
            : "none"
        }}
      </div>
      <div>
        B:
        {{
          displayRocketB
            ? `id=${displayRocketB.id} len=${displayRocketB.length}m`
            : "none"
        }}
      </div>
    </div>
  </div>
</template>
