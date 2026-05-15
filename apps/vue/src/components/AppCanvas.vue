<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { RocketConfig } from "@orbitq/graphql";
import {
  useCanvasBands,
  KN_PER_PLUME_METRE,
} from "../composables/useCanvasBands";
import type { BandId } from "../composables/useCanvasBands";
import { canvasColors } from "@orbitq/styles/canvas";
import { useCanvasAnimation } from "../composables/useCanvasAnimation";
import { useCanvasMachine } from "../composables/useCanvasMachine";
import RocketImage from "./RocketImage.vue";
import HumanFigure from "./HumanFigure.vue";
import ThrustIndicator from "./ThrustIndicator.vue";
import MaidenFlightTimeline from "./MaidenFlightTimeline.vue";
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

const canvasWidth = window.innerWidth;
const canvasHeight = window.innerHeight - 86 - 41;

// ---------------------------------------------------------------------------
// Band system
// ---------------------------------------------------------------------------

const {
  enabledBands,
  visibleBands,
  toggleBand,
  hideBand,
  disableAllBands,
  targetBaselineY,
  targetScaleForLength,
  bandOffsetFracs,
  bandHeightPx,
  syncVisibleBands: syncVisibleBandsBase,
  bandsBelow,
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
  animatedBandOffsets,
  rocketAOpacity,
  rocketBOpacity,
  displayRocketA,
  displayRocketB,
  animate,
  setOffsetAnimation,
  fadeOut,
  fadeIn,
} = useCanvasAnimation(humanOnlyScale, DEFAULT_BASELINE, layerRef);

// ---------------------------------------------------------------------------
// Stage separation helpers
// ---------------------------------------------------------------------------

function effectiveLength(
  rocket: RocketConfig | null,
  separated: boolean,
): number {
  if (!rocket?.length) return 0;
  if (!separated) return rocket.length;
  const n = diagrams[rocket.id]?.stages.length ?? 0;
  return n > 1 ? rocket.length * (1 + (n - 1) * 0.1) : rocket.length;
}

function effectiveMaxLen(
  rockets: (RocketConfig | null)[],
  separated: boolean,
): number {
  return Math.max(...rockets.map((r) => effectiveLength(r, separated)), 0);
}

// ---------------------------------------------------------------------------
// State machine
// ---------------------------------------------------------------------------

const separationVisible = ref(false);
const showScaleReference = ref(true);
const stageSeparationEnabled = ref(false);

const { send } = useCanvasMachine({
  animate,
  animatedWorldScale: () => animatedWorldScale.value,
  animatedBaselineY: () => animatedBaselineY.value,
  displayRocketA: () => displayRocketA.value,
  displayRocketB: () => displayRocketB.value,
  getTargetScale(rockets, separated) {
    const maxLen = effectiveMaxLen(rockets, separated);
    return targetScaleForLength(maxLen, rockets);
  },
  getTargetBaseline(rockets, separated) {
    const maxLen = effectiveMaxLen(rockets, separated);
    return maxLen > 0 ? targetBaselineY(maxLen, rockets) : DEFAULT_BASELINE;
  },
  setDisplayRockets(a, b) {
    displayRocketA.value = a;
    displayRocketB.value = b;
  },
  syncVisibleBands() {
    const maxLen = Math.max(
      displayRocketA.value?.length ?? 0,
      displayRocketB.value?.length ?? 0,
    );
    syncVisibleBandsBase(maxLen);
    // Keep animated offsets in sync after each animation so the next toggle
    // always starts from the correct settled position.
    const rockets: (RocketConfig | null)[] = [
      displayRocketA.value,
      displayRocketB.value,
    ];
    const settled = bandOffsetFracs(rockets, maxLen, animatedWorldScale.value);
    setOffsetAnimation(settled, settled);
  },
  hideBand: hideBand as (id: string) => void,
  disableAllBands,
  setSeparationVisible(v) {
    separationVisible.value = v;
  },
  fadeOut,
  fadeIn,
});

// Dispatch rocket changes to the machine
watch([() => props.rocketAData, () => props.rocketBData], ([newA, newB]) => {
  if (props.rocketAFetching || props.rocketBFetching) return;
  send({
    type: "ROCKET_SELECTION_CHANGED",
    rocketA: newA ?? null,
    rocketB: newB ?? null,
  });
});

// Dispatch separation toggle to the machine
watch(stageSeparationEnabled, (enable) => {
  send({ type: "SEPARATION_TOGGLED", enable });
});

function handleToggleBand(id: BandId) {
  const enable = !enabledBands[id];
  if (enable) stageSeparationEnabled.value = false;

  const rockets: (RocketConfig | null)[] = [
    displayRocketA.value,
    displayRocketB.value,
  ];
  const maxLen = maxRocketLength.value;

  // Hide bands below the toggled band for the duration of the animation —
  // they shift position as the world scale changes, so hiding them avoids a
  // visible jump. syncVisibleBands restores them once the animation settles.
  for (const bid of bandsBelow(id)) hideBand(bid);

  if (!enable) {
    // Band turned OFF: animate offsets so the canvas layout transitions smoothly.
    const fromOffsets = bandOffsetFracs(
      rockets,
      maxLen,
      animatedWorldScale.value,
    );
    toggleBand(id);
    const toOffsets = bandOffsetFracs(
      rockets,
      maxLen,
      targetScaleForLength(maxLen, rockets),
    );
    setOffsetAnimation(fromOffsets, toOffsets);
  } else {
    // Band turned ON: new band content is hidden during animation, existing
    // bands absorb an instant offset update.
    toggleBand(id);
    const snapped = bandOffsetFracs(rockets, maxLen, animatedWorldScale.value);
    setOffsetAnimation(snapped, snapped);
  }

  send({ type: "BAND_TOGGLED", id, enable });
}

const hasRocketWithStages = computed(() =>
  [displayRocketA.value, displayRocketB.value].some(
    (r) => r && (diagrams[r.id]?.stages.length ?? 0) > 0,
  ),
);

// ---------------------------------------------------------------------------
// Band-specific pixel dimensions
// ---------------------------------------------------------------------------

const maxRocketLength = computed(() =>
  Math.max(
    displayRocketA.value?.length ?? 0,
    displayRocketB.value?.length ?? 0,
  ),
);

const timelineBandHeight = computed(() =>
  bandHeightPx(
    "maidenFlight",
    [displayRocketA.value, displayRocketB.value],
    maxRocketLength.value,
    animatedWorldScale.value,
  ),
);

const bandStartYs = computed(() => {
  const maxLength = maxRocketLength.value;
  const ws = animatedWorldScale.value;
  const pxPerFrac = maxLength * ws;
  const offsets = animatedBandOffsets.value;
  return {
    thrust: animatedBaselineY.value + (offsets.thrust ?? 0) * pxPerFrac,
    maidenFlight:
      animatedBaselineY.value + (offsets.maidenFlight ?? 0) * pxPerFrac,
  };
});

// ---------------------------------------------------------------------------
// Canvas positioning
// ---------------------------------------------------------------------------

const HUMAN_NATIVE_W = 30;
const HUMAN_NATIVE_H = 175;
const HUMAN_REAL_H_M = 1.75;
const EDGE_GAP = 80;
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
          :separated="separationVisible"
          :opacity="rocketAOpacity"
        />
        <ThrustIndicator
          v-if="displayRocketA && visibleBands.thrust"
          side="left"
          :x="leftRocketX"
          :baselineY="bandStartYs.thrust"
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
          :separated="separationVisible"
          :opacity="rocketBOpacity"
        />
        <ThrustIndicator
          v-if="displayRocketB && visibleBands.thrust"
          side="right"
          :x="rightRocketX"
          :baselineY="bandStartYs.thrust"
          :rocketWidth="2 * rocketHalfW(displayRocketB)"
          :thrust="displayRocketB.toThrust"
          :plumeHeight="
            ((displayRocketB.toThrust ?? 0) / KN_PER_PLUME_METRE) *
            animatedWorldScale
          "
        />
        <MaidenFlightTimeline
          v-if="visibleBands.maidenFlight"
          :baselineY="bandStartYs.maidenFlight"
          :bandHeight="timelineBandHeight"
          :canvasWidth="canvasWidth"
          :rocketA="displayRocketA"
          :rocketB="displayRocketB"
        />
        <!-- DEBUG: remove before ship -->
        <v-rect
          :config="{
            ...leftMarginBounds,
            fill: canvasColors.rocketAAccentSubtle,
            stroke: canvasColors.rocketAAccentMid,
            strokeWidth: 1,
            dash: [4, 4],
          }"
        />
        <v-rect
          :config="{
            ...rightMarginBounds,
            fill: canvasColors.rocketBAccentSubtle,
            stroke: canvasColors.rocketBAccentMid,
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
      @toggle-band="handleToggleBand($event as BandId)"
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
