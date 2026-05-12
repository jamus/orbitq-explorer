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
import CanvasPanel from "./CanvasPanel.vue";
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

// World-space layout constants, expressed as fractions of the tallest rocket's length.
// The canvas fits: TOP_PADDING + rocket + BOTTOM_PADDING + active layer heights.
// worldScale = canvasHeight / (maxLength × totalWorldFrac()).
const TOP_PADDING_FRAC = 0.14;
const BOTTOM_PADDING_FRAC = 0.25;

// When no rockets are loaded, fall back to a scale where the human fills ~40% of
// the canvas — keeping it visible as a standing reference figure.
const humanOnlyScale = (canvasHeight * 0.4) / 1.75;

// ---------------------------------------------------------------------------
// Layer registry
//
// Each entry declares how much world-space height it needs below the baseline.
// bandHeightFrac receives the active rockets and maxLength so it can derive
// its true extent from rocket geometry rather than a hardcoded guess.
// ---------------------------------------------------------------------------
type BandDef = {
  label: string;
  bandHeightFrac: (
    rockets: (RocketConfig | null)[],
    maxLength: number,
  ) => number;
};

// 1 metre of plume height per this many kilonewtons of thrust.
// Drives both the canvas layout reservation and ThrustIndicator rendering.
const KN_PER_PLUME_METRE = 250;

const BAND_REGISTRY = {
  thrust: {
    label: "Thrust",
    bandHeightFrac: (rockets, maxLength) => {
      if (maxLength <= 0) return 0;
      const maxPlumeM = Math.max(
        ...rockets.map((r) => (r?.toThrust ?? 0) / KN_PER_PLUME_METRE),
        0,
      );
      return maxPlumeM / maxLength;
    },
  },
} satisfies Record<string, BandDef>;

type BandId = keyof typeof BAND_REGISTRY;

// enabledBands: logical toggle state — drives computed targets (scale, baselineY).
// visibleBands: what's actually rendered — lags behind enabledBands during transition.
// Separating the two lets us animate the canvas into its new layout before a band
// appears (toggle ON) or immediately after it disappears (toggle OFF).
const enabledBands = reactive<Record<BandId, boolean>>({ thrust: false });
const visibleBands = reactive<Record<BandId, boolean>>({ thrust: false });

// Set by toggleBand so the enabledBands watcher knows which band to reveal
// once the canvas-recenter animation completes (only used for toggle-ON).
let pendingBandShow: BandId | null = null;

function toggleBand(id: BandId): void {
  if (enabledBands[id]) {
    visibleBands[id] = false; // hide immediately
    enabledBands[id] = false; // animate canvas back (watcher fires)
  } else {
    enabledBands[id] = true; // animate canvas forward (watcher fires)
    pendingBandShow = id; // watcher will reveal layer in callback
  }
}

// Total world height as a multiple of maxLength:
// TOP_PADDING + 1 (rocket) + BOTTOM_PADDING + active layer heights.
function totalWorldFrac(
  rockets: (RocketConfig | null)[],
  maxLength: number,
): number {
  let frac = 1 + TOP_PADDING_FRAC + BOTTOM_PADDING_FRAC;
  for (const id of Object.keys(BAND_REGISTRY) as BandId[]) {
    if (enabledBands[id])
      frac += BAND_REGISTRY[id].bandHeightFrac(rockets, maxLength);
  }
  return frac;
}

function targetBaselineY(
  maxLength: number,
  rockets: (RocketConfig | null)[],
): number {
  if (maxLength <= 0) return DEFAULT_BASELINE;
  let belowFrac = BOTTOM_PADDING_FRAC;
  for (const id of Object.keys(BAND_REGISTRY) as BandId[]) {
    if (enabledBands[id])
      belowFrac += BAND_REGISTRY[id].bandHeightFrac(rockets, maxLength);
  }
  return canvasHeight * (1 - belowFrac / totalWorldFrac(rockets, maxLength));
}

function targetScaleForLength(
  maxLength: number,
  rockets: (RocketConfig | null)[],
): number {
  return maxLength > 0
    ? canvasHeight / (maxLength * totalWorldFrac(rockets, maxLength))
    : humanOnlyScale;
}

// --- Display refs: hold current rendered state, lag behind live data during animation ---
const displayRocketA = shallowRef<RocketConfig | null>(null);
const displayRocketB = shallowRef<RocketConfig | null>(null);

// --- Animated values driven by Konva.Animation ---
const animatedWorldScale = ref<number>(humanOnlyScale);
// Initialise from the no-content default, not baselineY.value — at startup there
// are no rockets so active layer costs shouldn't apply yet.
const DEFAULT_BASELINE =
  canvasHeight *
  (1 - BOTTOM_PADDING_FRAC / (1 + TOP_PADDING_FRAC + BOTTOM_PADDING_FRAC));
const animatedBaselineY = ref<number>(DEFAULT_BASELINE);
const layerRef = ref(null);

const DURATION = 400; // ms
let scaleAnimation: Konva.Animation | null = null;
let animStartTime: number | null = null;
let startScale = humanOnlyScale;
let targetScale = humanOnlyScale;
let startBaseline = DEFAULT_BASELINE;
let targetBaseline = DEFAULT_BASELINE;
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
): void {
  scaleAnimation?.stop();
  animStartTime = null;
  startScale = fromScale;
  targetScale = toScale;
  startBaseline = fromBaseline;
  targetBaseline = toBaseline;
  onComplete = callback;
  scaleAnimation?.start();
}

watch([rocketAData, rocketBData], ([newA, newB]) => {
  // Skip while a selected rocket's query is still in-flight (prop set, data not yet back).
  // Without this guard the watcher fires twice: once for the intermediate null state
  // and again when data arrives, causing two consecutive scale animations.
  if ((props.rocketA && !newA) || (props.rocketB && !newB)) return;

  const newMaxLength = Math.max(newA?.length ?? 0, newB?.length ?? 0);
  const newRockets = [newA ?? null, newB ?? null];
  // When rockets are present use the layer-adjusted baseline; when removing all
  // rockets always return to the default so the human figure isn't displaced.
  const targetBase =
    newMaxLength > 0
      ? targetBaselineY(newMaxLength, newRockets)
      : DEFAULT_BASELINE;
  animate(
    animatedWorldScale.value,
    targetScaleForLength(newMaxLength, newRockets),
    animatedBaselineY.value,
    targetBase,
    () => {
      displayRocketA.value = newA ?? null;
      displayRocketB.value = newB ?? null;
      // Sync display layers to active layers now that rocket presence is settled.
      // This handles the case where layers were toggled while no rockets were loaded.
      for (const id of Object.keys(BAND_REGISTRY) as BandId[]) {
        visibleBands[id as BandId] =
          newMaxLength > 0 && enabledBands[id as BandId];
      }
    },
  );
});

// When bands toggle: animate canvas into the new layout, then reveal/hide content.
watch(enabledBands, () => {
  const maxLength = Math.max(
    displayRocketA.value?.length ?? 0,
    displayRocketB.value?.length ?? 0,
  );
  // No rockets means no layer content to show — don't reflow or displace the human.
  if (maxLength === 0) {
    pendingBandShow = null;
    return;
  }
  const layerToShow = pendingBandShow;
  pendingBandShow = null;
  const rockets = [displayRocketA.value, displayRocketB.value];
  animate(
    animatedWorldScale.value,
    targetScaleForLength(maxLength, rockets),
    animatedBaselineY.value,
    targetBaselineY(maxLength, rockets),
    () => {
      if (layerToShow !== null) visibleBands[layerToShow] = true;
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

const leftMarginBounds = computed(() => ({
  x: CANVAS_PAD,
  y: 0,
  width: leftRocketX.value - rocketHalfW(displayRocketA.value) - CANVAS_PAD,
  height: canvasHeight,
}));

const rightMarginBounds = computed(() => ({
  x: rightRocketX.value + rocketHalfW(displayRocketB.value),
  y: 0,
  width:
    canvasWidth -
    CANVAS_PAD -
    (rightRocketX.value + rocketHalfW(displayRocketB.value)),
  height: canvasHeight,
}));

const showScaleReference = ref(true);

const bandList = computed(() =>
  (Object.keys(BAND_REGISTRY) as BandId[]).map((id) => ({
    id,
    label: BAND_REGISTRY[id].label,
    active: enabledBands[id],
  })),
);
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
          v-if="displayRocketA && visibleBands.thrust"
          :x="leftRocketX"
          :baselineY="animatedBaselineY"
          :rocketWidth="2 * rocketHalfW(displayRocketA)"
          :thrust="displayRocketA.toThrust"
          :plumeHeight="
            ((displayRocketA.toThrust ?? 0) / KN_PER_PLUME_METRE) *
            animatedWorldScale
          "
        />
        <RocketImage
          v-if="displayRocketB"
          :rocket="displayRocketB"
          :x="rightRocketX"
          :baselineY="animatedBaselineY"
          :worldScale="animatedWorldScale"
        />
        <ThrustIndicator
          v-if="displayRocketB && visibleBands.thrust"
          :x="rightRocketX"
          :baselineY="animatedBaselineY"
          :rocketWidth="2 * rocketHalfW(displayRocketB)"
          :thrust="displayRocketB.toThrust"
          :plumeHeight="
            ((displayRocketB.toThrust ?? 0) / KN_PER_PLUME_METRE) *
            animatedWorldScale
          "
        />
        <!-- DEBUG: remove before ship -->
        <v-rect
          :config="{
            ...leftMarginBounds,
            fill: 'rgba(100, 200, 255, 0.1)',
            stroke: 'rgba(100, 200, 255, 0.4)',
            strokeWidth: 1,
            dash: [4, 4],
          }"
        />
        <v-rect
          :config="{
            ...rightMarginBounds,
            fill: 'rgba(255, 150, 100, 0.1)',
            stroke: 'rgba(255, 150, 100, 0.4)',
            strokeWidth: 1,
            dash: [4, 4],
          }"
        />
        <HumanFigure
          v-if="showScaleReference"
          :x="xHuman"
          :baselineY="animatedBaselineY"
          :worldScale="animatedWorldScale"
        />
      </v-layer>
    </v-stage>

    <CanvasPanel
      v-model:showScaleReference="showScaleReference"
      :bands="bandList"
      @toggle-band="toggleBand($event as BandId)"
    />
    <!-- DEBUG: remove before ship -->
    <div
      class="absolute top-2 right-2 font-mono text-xs text-status-warning space-y-0.5 pointer-events-none text-right"
    >
      <div>animatedWorldScale: {{ animatedWorldScale.toFixed(4) }}</div>
      <div>worldScale: {{ animatedWorldScale.toFixed(4) }}</div>
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
