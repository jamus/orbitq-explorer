<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { RocketConfig } from "@orbitq/graphql";
import {
  useCanvasBands,
  KN_PER_PLUME_METRE,
} from "../composables/useCanvasBands";
import type { BandId } from "../composables/useCanvasBands";
import { useCanvasAnimation } from "../composables/useCanvasAnimation";
import RocketImage from "./RocketImage.vue";
import HumanFigure from "./HumanFigure.vue";
import ThrustIndicator from "./ThrustIndicator.vue";
import CanvasPanel from "./CanvasPanel.vue";
import { diagrams } from "@shared/const/diagrams";

const props = defineProps<{
  rocketAData: RocketConfig | null;
  rocketBData: RocketConfig | null;
  rocketAFetching: boolean;
  rocketBFetching: boolean;
}>();

// ---------------------------------------------------------------------------
// Canvas dimensions
// ---------------------------------------------------------------------------

// Canvas fills the full viewport minus the 86 & 41px top nav bar & footer.
const canvasWidth = window.innerWidth;
const canvasHeight = window.innerHeight - 86 - 41;

// ---------------------------------------------------------------------------
// Band system
// ---------------------------------------------------------------------------

const {
  enabledBands,
  visibleBands,
  pendingBandShow,
  toggleBand,
  targetBaselineY,
  targetScaleForLength,
  syncVisibleBands,
  bandList,
  humanOnlyScale,
  DEFAULT_BASELINE,
} = useCanvasBands(canvasHeight);

// ---------------------------------------------------------------------------
// Animation
// ---------------------------------------------------------------------------

const layerRef = ref(null);
const {
  animatedWorldScale,
  animatedBaselineY,
  displayRocketA,
  displayRocketB,
  animate,
} = useCanvasAnimation(humanOnlyScale, DEFAULT_BASELINE, layerRef);

// ---------------------------------------------------------------------------
// Watchers
// ---------------------------------------------------------------------------

watch([() => props.rocketAData, () => props.rocketBData], ([newA, newB]) => {
  // Skip while a selected rocket's query is still in-flight (prop set, data not yet back).
  // Without this guard the watcher fires twice: once for the intermediate null state
  // and again when data arrives, causing two consecutive scale animations.
  if (props.rocketAFetching || props.rocketBFetching) return;

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
      syncVisibleBands(newMaxLength);
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
    pendingBandShow.value = null;
    return;
  }
  const layerToShow = pendingBandShow.value;
  pendingBandShow.value = null;
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

// ---------------------------------------------------------------------------
// Canvas positioning
// ---------------------------------------------------------------------------

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
const stageSeparationEnabled = ref(false);

const hasRocketWithStages = computed(() =>
  [displayRocketA.value, displayRocketB.value].some(
    (r) => r && (diagrams[r.id]?.stages.length ?? 0) > 0,
  ),
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
          :separated="stageSeparationEnabled"
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
          :separated="stageSeparationEnabled"
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
      v-model:stageSeparationEnabled="stageSeparationEnabled"
      :hasRocketWithStages="hasRocketWithStages"
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
