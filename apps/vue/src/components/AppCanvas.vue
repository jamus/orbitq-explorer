<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from "vue";
import type { RocketConfig } from "@orbitq/graphql";
import { useNodeGrid, NODE_COLUMN_WIDTH } from "../composables/useNodeGrid";
import type { NodeTypeId } from "../composables/useNodeGrid";
import { useBoardSize } from "../composables/useBoardSize";
import { useCanvasAnimation } from "../composables/useCanvasAnimation";
import { useCanvasMachine } from "../composables/useCanvasMachine";
import RocketImage from "./RocketImage.vue";
import HumanFigure from "./HumanFigure.vue";
import ThrustIndicator from "./ThrustIndicator.vue";
import CanvasPanel from "./CanvasPanel.vue";
import NodeColumn from "./NodeColumn.vue";
import { diagrams } from "@shared/const/diagrams";
import ScaleMagnifier from "./ScaleMagnifier.vue";

const props = defineProps<{
  rocketAData: RocketConfig | null;
  rocketBData: RocketConfig | null;
  rocketAFetching: boolean;
  rocketBFetching: boolean;
}>();

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------

const TOP_PADDING_FRAC = 0.14;
const BOTTOM_PADDING_FRAC = 0.25;
const BASE_PADDING_FRAC = 1 + TOP_PADDING_FRAC + BOTTOM_PADDING_FRAC;
const KN_PER_PLUME_METRE = 250;

// Duration of the NodeColumn CSS width transition (must match NodeColumn.vue).
const CSS_COLUMN_DURATION_MS = 300;

// ---------------------------------------------------------------------------
// Board size (reactive, driven by ResizeObserver on the board container)
// ---------------------------------------------------------------------------

const boardRef = ref<HTMLElement | null>(null);
const { boardWidth, boardHeight } = useBoardSize(boardRef);

// ---------------------------------------------------------------------------
// Node grid
// ---------------------------------------------------------------------------

const {
  enableNode,
  disableNode,
  showNode,
  hideNode,
  isDiagramNode,
  nodeList,
  columnANodes,
  columnBNodes,
  thrustEnabled,
  thrustRenderVisible,
} = useNodeGrid();

// ---------------------------------------------------------------------------
// Layout helpers — derived from reactive board dimensions
// ---------------------------------------------------------------------------

const humanOnlyScale = computed(() => (boardHeight.value * 0.4) / 1.75);

const DEFAULT_BASELINE = computed(
  () => boardHeight.value * (1 - BOTTOM_PADDING_FRAC / BASE_PADDING_FRAC),
);

// Thrust frac reads thrustEnabled (not thrustRenderVisible) so the scale target
// updates as soon as the user toggles, before the animation fires.
function thrustFracFor(
  rockets: (RocketConfig | null)[],
  maxLength: number,
): number {
  if (!thrustEnabled.value || maxLength <= 0) return 0;
  const maxPlumeM = Math.max(
    ...rockets.map((r) => (r?.toThrust ?? 0) / KN_PER_PLUME_METRE),
    0,
  );
  return maxPlumeM / maxLength;
}

function targetScaleForLength(
  maxLength: number,
  rockets: (RocketConfig | null)[],
): number {
  if (maxLength <= 0) return humanOnlyScale.value;
  const tf = thrustFracFor(rockets, maxLength);
  return boardHeight.value / (maxLength * (BASE_PADDING_FRAC + tf));
}

function targetBaselineY(
  maxLength: number,
  rockets: (RocketConfig | null)[],
): number {
  if (maxLength <= 0) return DEFAULT_BASELINE.value;
  const tf = thrustFracFor(rockets, maxLength);
  const total = BASE_PADDING_FRAC + tf;
  return boardHeight.value * (1 - (BOTTOM_PADDING_FRAC + tf) / total);
}

// ---------------------------------------------------------------------------
// Stage separation
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
// Animation
// ---------------------------------------------------------------------------

const layerRef = ref(null);
const {
  animatedWorldScale,
  animatedBaselineY,
  rocketAOpacity,
  rocketBOpacity,
  displayRocketA,
  displayRocketB,
  animate,
  fadeOut,
  fadeIn,
} = useCanvasAnimation(humanOnlyScale.value, DEFAULT_BASELINE.value, layerRef);

// ---------------------------------------------------------------------------
// State machine
// ---------------------------------------------------------------------------

const showScaleReference = ref(true);
const separationVisible = ref(false);
const isSeparationAnimating = ref(false);

const { send, isAnimating } = useCanvasMachine({
  animate,
  animatedWorldScale: () => animatedWorldScale.value,
  animatedBaselineY: () => animatedBaselineY.value,
  displayRocketA: () => displayRocketA.value,
  displayRocketB: () => displayRocketB.value,
  getTargetScale(rockets) {
    return targetScaleForLength(
      effectiveMaxLen(rockets, separationVisible.value),
      rockets,
    );
  },
  getTargetBaseline(rockets) {
    return targetBaselineY(
      effectiveMaxLen(rockets, separationVisible.value),
      rockets,
    );
  },
  setDisplayRockets(a, b) {
    displayRocketA.value = a;
    displayRocketB.value = b;
  },
  showDiagram(id) {
    showNode(id as NodeTypeId);
  },
  hideDiagram(id) {
    hideNode(id as NodeTypeId);
  },
  fadeOut,
  fadeIn,
});

// ---------------------------------------------------------------------------
// CSS-first animation sequencing
//
// A single pending-event slot ensures rapid toggles don't queue up stale events.
// Diagram-affecting nodes: CSS column animates first (CSS_COLUMN_DURATION_MS),
// then the machine fires Konva animation.
// Non-diagram nodes: immediate — no machine event needed.
// ---------------------------------------------------------------------------

let pendingMachineEvent: ReturnType<typeof setTimeout> | null = null;

function cancelPending() {
  if (pendingMachineEvent !== null) {
    clearTimeout(pendingMachineEvent);
    pendingMachineEvent = null;
  }
}

function scheduleAfterColumn(event: Parameters<typeof send>[0]) {
  cancelPending();
  pendingMachineEvent = setTimeout(() => {
    pendingMachineEvent = null;
    send(event);
  }, CSS_COLUMN_DURATION_MS);
}

onUnmounted(cancelPending);

function handleNodeToggle(id: NodeTypeId) {
  const isCurrentlyEnabled =
    nodeList.value.find((n) => n.id === id)?.active ?? false;

  if (!isDiagramNode(id)) {
    if (isCurrentlyEnabled) disableNode(id);
    else enableNode(id);
    return;
  }

  // Enabling a diagram node while separation is active — dismiss separation first.
  if (!isCurrentlyEnabled && separationVisible.value) {
    separationVisible.value = false;
  }

  if (isCurrentlyEnabled) {
    disableNode(id);
  } else {
    enableNode(id);
  }

  scheduleAfterColumn({
    type: "DIAGRAM_OPTION_CHANGED",
    id,
    enable: !isCurrentlyEnabled,
  });
}

watch([() => props.rocketAData, () => props.rocketBData], ([newA, newB]) => {
  if (props.rocketAFetching || props.rocketBFetching) return;
  send({
    type: "ROCKET_SELECTION_CHANGED",
    rocketA: newA ?? null,
    rocketB: newB ?? null,
  });
});

const rocketHasStages = (r: RocketConfig | null) =>
  !!(r && (diagrams[r.id]?.stages.length ?? 0) > 0);

const hasRocketAWithStages = computed(() =>
  rocketHasStages(displayRocketA.value),
);
const hasRocketBWithStages = computed(() =>
  rocketHasStages(displayRocketB.value),
);
const hasRocketWithStages = computed(
  () => hasRocketAWithStages.value || hasRocketBWithStages.value,
);

// Auto-show the stages node when any staged rocket is loaded.
// Reset separation when stages disappear.
watch(
  hasRocketWithStages,
  (has) => {
    if (has) enableNode("stages");
    else {
      disableNode("stages");
      separationVisible.value = false;
    }
  },
  { immediate: true },
);

function handleSeparationToggle() {
  if (!separationVisible.value && thrustEnabled.value) {
    // Thrust is active — disable it and let the machine's diagram-off animation
    // serve as the separation zoom. Avoids two concurrent animate() calls
    // (which would leave the machine stuck in animating-diagram-off forever).
    cancelPending();
    disableNode("thrust");
    separationVisible.value = true;
    send({ type: "DIAGRAM_OPTION_CHANGED", id: "thrust", enable: false });
    return;
  }

  separationVisible.value = !separationVisible.value;
  isSeparationAnimating.value = true;
  const rockets = [displayRocketA.value, displayRocketB.value];
  const maxLen = effectiveMaxLen(rockets, separationVisible.value);
  animate(
    animatedWorldScale.value,
    targetScaleForLength(maxLen, rockets),
    animatedBaselineY.value,
    targetBaselineY(maxLen, rockets),
    () => {
      isSeparationAnimating.value = false;
    },
  );
}

// Per-side filtered node arrays — suppress the stages card on a given side
// when that rocket has no stages, even if the other rocket does.
const columnANodesDisplay = computed(() =>
  columnANodes.value.filter(
    (n) => n.id !== "stages" || hasRocketAWithStages.value,
  ),
);
const columnBNodesDisplay = computed(() =>
  columnBNodes.value.filter(
    (n) => n.id !== "stages" || hasRocketBWithStages.value,
  ),
);
const columnAWidthDisplay = computed(() =>
  columnANodesDisplay.value.length > 0 ? NODE_COLUMN_WIDTH : 0,
);
const columnBWidthDisplay = computed(() =>
  columnBNodesDisplay.value.length > 0 ? NODE_COLUMN_WIDTH : 0,
);

// Filter stages node from the panel — it auto-enables and has its own card UI.
const panelNodes = computed(() =>
  nodeList.value.filter((n) => n.id !== "stages"),
);

// ---------------------------------------------------------------------------
// Canvas positioning
// ---------------------------------------------------------------------------

const HUMAN_NATIVE_W = 30;
const HUMAN_NATIVE_H = 175;
const HUMAN_REAL_H_M = 1.75;
const EDGE_GAP = 80;
const CANVAS_PAD = 20;

const xHuman = computed(() => boardWidth.value * 0.5);

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
  if (!entry || !rocket.length) return 0;
  return (
    (entry.nativeWidth *
      (rocket.length / entry.nativeHeight) *
      animatedWorldScale.value) /
    2
  );
}

const rocketAnchorX = (rocketHalfWidth: number, direction: -1 | 1) =>
  xHuman.value + direction * (humanHalfW.value + EDGE_GAP + rocketHalfWidth);

const leftRocketX = computed(() => {
  const hw = rocketHalfW(displayRocketA.value);
  return Math.max(rocketAnchorX(hw, -1), hw + CANVAS_PAD);
});

const rightRocketX = computed(() => {
  const hw = rocketHalfW(displayRocketB.value);
  return Math.min(rocketAnchorX(hw, 1), boardWidth.value - hw - CANVAS_PAD);
});

const stageConfig = computed(() => ({
  width: boardWidth.value,
  height: boardHeight.value,
}));

const showMagnifier = ref<{ x: number; y: number } | null>(null);
const magnifierTargetPos = ref<{ x: number; y: number } | null>(null);

const handleMagnification = (
  payload: {
    pointerPosition: { x: number; y: number } | null;
    humanPosition: { x: number; y: number } | null;
  } | null,
) => {
  if (!payload?.pointerPosition || !payload?.humanPosition) {
    showMagnifier.value = null;
    magnifierTargetPos.value = null;
    return;
  }
  showMagnifier.value = payload.pointerPosition;
  magnifierTargetPos.value = payload.humanPosition;
};

function plumeHeight(thrust: number | null): number {
  return ((thrust ?? 0) / KN_PER_PLUME_METRE) * animatedWorldScale.value;
}
</script>

<template>
  <div class="flex h-[calc(100vh-127px)]">
    <NodeColumn
      :nodes="columnANodesDisplay"
      :width="columnAWidthDisplay"
      :separationActive="separationVisible"
      :isAnimating="isAnimating || isSeparationAnimating"
      @trigger-separation="handleSeparationToggle"
    />
    <div ref="boardRef" class="relative flex-1 overflow-hidden">
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
            v-if="displayRocketA && thrustRenderVisible"
            :x="leftRocketX"
            :baselineY="animatedBaselineY"
            :rocketWidth="2 * rocketHalfW(displayRocketA)"
            :thrust="displayRocketA.toThrust"
            :plumeHeight="plumeHeight(displayRocketA.toThrust)"
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
            v-if="displayRocketB && thrustRenderVisible"
            :x="rightRocketX"
            :baselineY="animatedBaselineY"
            :rocketWidth="2 * rocketHalfW(displayRocketB)"
            :thrust="displayRocketB.toThrust"
            :plumeHeight="plumeHeight(displayRocketB.toThrust)"
          />

          <HumanFigure
            v-if="showScaleReference"
            :x="xHuman"
            :baselineY="animatedBaselineY"
            :worldScale="animatedWorldScale"
            @hover-human="handleMagnification"
          />
          <ScaleMagnifier
            :x="showMagnifier ? showMagnifier.x : 0"
            :y="showMagnifier ? showMagnifier.y : 0"
            :targetPos="showMagnifier ? magnifierTargetPos : null"
            :worldScale="animatedWorldScale"
          />
        </v-layer>
      </v-stage>
    </div>

    <NodeColumn
      :nodes="columnBNodesDisplay"
      :width="displayRocketB ? columnBWidthDisplay : 0"
      :separationActive="separationVisible"
      :isAnimating="isAnimating || isSeparationAnimating"
      @trigger-separation="handleSeparationToggle"
    />

    <CanvasPanel
      v-model:showScaleReference="showScaleReference"
      :nodes="panelNodes"
      :isAnimating="isAnimating || isSeparationAnimating"
      @toggle-node="handleNodeToggle($event as NodeTypeId)"
    />
  </div>
</template>
