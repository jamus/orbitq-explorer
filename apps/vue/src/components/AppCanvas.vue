<script setup lang="ts">
import {
  computed,
  reactive,
  ref,
  shallowRef,
  watch,
  onMounted,
  onUnmounted,
} from "vue";
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
import ThrustIndicator from "./ThrustIndicator.vue";
import { diagrams } from "@shared/const/diagrams";

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

// BASE_BELOW_FRACTION: minimum fraction of canvas height reserved below
// baselineY when no layers are active. Each active layer's groundCost adds to
// this, pushing baselineY upward to make room for its content.
const BASE_BELOW_FRACTION = 0.18;

// When no rockets are loaded, fall back to a scale where the human fills ~40% of
// the canvas — keeping it visible as a standing reference figure.
const humanOnlyScale = (canvasHeight * 0.4) / 1.75;

// ---------------------------------------------------------------------------
// Layer registry
//
// Each entry defines a toggleable canvas element:
//   rocketHeightCost – fraction of canvas height deducted from the rocket so
//                      it doesn't intrude into the layer's reserved space.
//   groundCost       – extra fraction of canvas height reserved *below*
//                      baselineY for this layer's content. Together with the
//                      static BASE_BELOW_FRACTION, this drives baselineY so
//                      the layer always has enough room to render.
// ---------------------------------------------------------------------------
const LAYER_REGISTRY = {
  thrust: { label: "Thrust", rocketHeightCost: 0.12, groundCost: 0.12 },
} as const;

type LayerId = keyof typeof LAYER_REGISTRY;

// activeLayers: logical toggle state — drives computed targets (scale, baselineY).
// displayLayers: what's actually rendered — lags behind activeLayers during transition.
// Separating the two lets us animate the canvas into its new layout before a layer
// appears (toggle ON) or immediately after it disappears (toggle OFF).
const activeLayers = reactive<Record<LayerId, boolean>>({ thrust: true });
const displayLayers = reactive<Record<LayerId, boolean>>({ thrust: true });

// Set by toggleLayer so the activeLayers watcher knows which layer to reveal
// once the canvas-recenter animation completes (only used for toggle-ON).
let pendingLayerShow: LayerId | null = null;

function toggleLayer(id: LayerId): void {
  if (activeLayers[id]) {
    displayLayers[id] = false; // hide immediately
    activeLayers[id] = false; // animate canvas back (watcher fires)
  } else {
    activeLayers[id] = true; // animate canvas forward (watcher fires)
    pendingLayerShow = id; // watcher will reveal layer in callback
  }
}

// BASE_ROCKET_FRACTION: the fraction of canvas height the tallest rocket fills
// when no layers are active. Each active layer deducts its cost, shrinking the
// rocket to make room for its ground-strip content.
const BASE_ROCKET_FRACTION = 0.72;

const rocketHeightFraction = computed(() => {
  let fraction = BASE_ROCKET_FRACTION;
  for (const id of Object.keys(LAYER_REGISTRY) as LayerId[]) {
    if (activeLayers[id]) fraction -= LAYER_REGISTRY[id].rocketHeightCost;
  }
  return Math.max(fraction, 0.3);
});

const belowFraction = computed(() => {
  let fraction = BASE_BELOW_FRACTION;
  for (const id of Object.keys(LAYER_REGISTRY) as LayerId[]) {
    if (activeLayers[id]) fraction += LAYER_REGISTRY[id].groundCost;
  }
  return fraction;
});

const baselineY = computed(() => canvasHeight * (1 - belowFraction.value));

function targetScaleForLength(maxLength: number): number {
  return maxLength > 0
    ? (canvasHeight * rocketHeightFraction.value) / maxLength
    : humanOnlyScale;
}

// --- Display refs: hold current rendered state, lag behind live data during animation ---
const displayRocketA = shallowRef<RocketConfig | null>(null);
const displayRocketB = shallowRef<RocketConfig | null>(null);

// --- Animated values driven by Konva.Animation ---
const animatedWorldScale = ref<number>(humanOnlyScale);
// Initialise from the no-content default, not baselineY.value — at startup there
// are no rockets so the layer cost in belowFraction shouldn't apply yet.
const DEFAULT_BASELINE = canvasHeight * (1 - BASE_BELOW_FRACTION);
const animatedBaselineY = ref<number>(DEFAULT_BASELINE);
const animatedMaxThrust = ref<number>(0);
const layerRef = ref(null);

const DURATION = 400; // ms
let scaleAnimation: Konva.Animation | null = null;
let animStartTime: number | null = null;
let startScale = humanOnlyScale;
let targetScale = humanOnlyScale;
let startBaseline = DEFAULT_BASELINE;
let targetBaseline = DEFAULT_BASELINE;
let startMaxThrust = 0;
let targetMaxThrust = 0;
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
      animatedMaxThrust.value =
        startMaxThrust + (targetMaxThrust - startMaxThrust) * easedProgress;
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
  fromMaxThrust: number,
  toMaxThrust: number,
  callback: () => void,
): void {
  scaleAnimation?.stop();
  animStartTime = null;
  startScale = fromScale;
  targetScale = toScale;
  startBaseline = fromBaseline;
  targetBaseline = toBaseline;
  startMaxThrust = fromMaxThrust;
  targetMaxThrust = toMaxThrust;
  onComplete = callback;
  scaleAnimation?.start();
}

watch([rocketAData, rocketBData], ([newA, newB]) => {
  // Skip while a selected rocket's query is still in-flight (prop set, data not yet back).
  // Without this guard the watcher fires twice: once for the intermediate null state
  // and again when data arrives, causing two consecutive scale animations.
  if ((props.rocketA && !newA) || (props.rocketB && !newB)) return;

  const newMaxLength = Math.max(newA?.length ?? 0, newB?.length ?? 0);
  // When rockets are present use the layer-adjusted baseline; when removing all
  // rockets always return to the default so the human figure isn't displaced.
  const targetBase = newMaxLength > 0 ? baselineY.value : DEFAULT_BASELINE;
  const newMaxThrust = Math.max(newA?.toThrust ?? 0, newB?.toThrust ?? 0);
  animate(
    animatedWorldScale.value,
    targetScaleForLength(newMaxLength),
    animatedBaselineY.value,
    targetBase,
    animatedMaxThrust.value,
    newMaxThrust,
    () => {
      displayRocketA.value = newA ?? null;
      displayRocketB.value = newB ?? null;
      // Sync display layers to active layers now that rocket presence is settled.
      // This handles the case where layers were toggled while no rockets were loaded.
      for (const id of Object.keys(LAYER_REGISTRY) as LayerId[]) {
        displayLayers[id as LayerId] =
          newMaxLength > 0 && activeLayers[id as LayerId];
      }
    },
  );
});

// When layers toggle: animate canvas into the new layout, then reveal/hide content.
watch(activeLayers, () => {
  const maxLength = Math.max(
    displayRocketA.value?.length ?? 0,
    displayRocketB.value?.length ?? 0,
  );
  // No rockets means no layer content to show — don't reflow or displace the human.
  if (maxLength === 0) {
    pendingLayerShow = null;
    return;
  }
  const layerToShow = pendingLayerShow;
  pendingLayerShow = null;
  animate(
    animatedWorldScale.value,
    targetScaleForLength(maxLength),
    animatedBaselineY.value,
    baselineY.value,
    animatedMaxThrust.value,
    animatedMaxThrust.value,
    () => {
      if (layerToShow !== null) displayLayers[layerToShow] = true;
    },
  );
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
          :baselineY="animatedBaselineY"
          :worldScale="animatedWorldScale"
        />
        <ThrustIndicator
          v-if="displayRocketA && displayLayers.thrust"
          :x="leftRocketX"
          :baselineY="animatedBaselineY"
          :rocketWidth="2 * rocketHalfW(displayRocketA)"
          :thrust="displayRocketA.toThrust"
          :maxThrust="animatedMaxThrust"
        />
        <RocketImage
          v-if="displayRocketB"
          :rocket="displayRocketB"
          :x="rightRocketX"
          :baselineY="animatedBaselineY"
          :worldScale="animatedWorldScale"
        />
        <ThrustIndicator
          v-if="displayRocketB && displayLayers.thrust"
          :x="rightRocketX"
          :baselineY="animatedBaselineY"
          :rocketWidth="2 * rocketHalfW(displayRocketB)"
          :thrust="displayRocketB.toThrust"
          :maxThrust="animatedMaxThrust"
        />
        <HumanFigure
          :x="xHuman"
          :baselineY="animatedBaselineY"
          :worldScale="animatedWorldScale"
        />
      </v-layer>
    </v-stage>

    <!-- Crude layer toggles — placeholder for the future toolbox -->
    <div
      class="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 pointer-events-auto"
    >
      <button
        v-for="[id, layer] in Object.entries(LAYER_REGISTRY)"
        :key="id"
        class="px-3 py-1 text-xs font-mono border transition-colors"
        :class="
          activeLayers[id as LayerId]
            ? 'border-white/60 text-white/60'
            : 'border-white/20 text-white/20'
        "
        @click="toggleLayer(id as LayerId)"
      >
        {{ layer.label }}
      </button>
    </div>

    <!-- DEBUG: remove before ship -->
    <div
      class="absolute top-2 right-2 font-mono text-xs text-status-warning space-y-0.5 pointer-events-none text-right"
    >
      <div>animatedWorldScale: {{ animatedWorldScale.toFixed(4) }}</div>
      <div>rocketHeightFraction: {{ rocketHeightFraction.toFixed(2) }}</div>
      <div>
        baselineY: {{ animatedBaselineY.toFixed(0) }} xA: {{ leftRocketX }} xB:
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
