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
import {
  BASE_PADDING_FRAC,
  BOTTOM_PADDING_FRAC,
  CSS_COLUMN_DURATION_MS,
  KN_PER_PLUME_METRE,
} from "@shared/const/canvas";
import { diagrams } from "@shared/const/diagrams";
import ScaleMagnifier from "./ScaleMagnifier.vue";
import { useContextMenu } from "../composables/useContextMenu";

const props = defineProps<{
  rocketAData: RocketConfig | null;
  rocketBData: RocketConfig | null;
  rocketAFetching: boolean;
  rocketBFetching: boolean;
}>();

// ---------------------------------------------------------------------------
// Board size (reactive, driven by ResizeObserver on the board container)
// ---------------------------------------------------------------------------

const boardRef = ref<HTMLElement | null>(null);
const { boardWidth, boardHeight } = useBoardSize(boardRef);

const { closeAll } = useContextMenu();

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

const isThrustActive = computed(() => {
  const thrustNode = nodeList.value.find((n) => n.typeId === "thrust");
  return thrustNode?.active ?? false;
});

function onShowThrust() {
  if (!isThrustActive.value) handleNodeToggle("thrust");
}

function onHideThrust() {
  if (isThrustActive.value) handleNodeToggle("thrust");
}

function onShowConfigurationNode(target: string) {
  handleNodeToggle(target as NodeTypeId);
}

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

function effectiveMaxLen(rockets: (RocketConfig | null)[]): number {
  return Math.max(
    ...rockets.map((r) => effectiveLength(r, separationVisible.value)),
    0,
  );
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

const { send, isAnimating } = useCanvasMachine({
  animate,
  animatedWorldScale: () => animatedWorldScale.value,
  animatedBaselineY: () => animatedBaselineY.value,
  displayRocketA: () => displayRocketA.value,
  displayRocketB: () => displayRocketB.value,
  getTargetScale(rockets) {
    return targetScaleForLength(effectiveMaxLen(rockets), rockets);
  },
  getTargetBaseline(rockets) {
    return targetBaselineY(effectiveMaxLen(rockets), rockets);
  },
  setDisplayRockets(a, b) {
    displayRocketA.value = a;
    displayRocketB.value = b;
  },
  showDiagram(id) {
    showNode(id as NodeTypeId);
    if (id === "stages") separationVisible.value = true;
  },
  hideDiagram(id) {
    hideNode(id as NodeTypeId);
    if (id === "stages") separationVisible.value = false;
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

function handleNodeToggle(typeId: NodeTypeId) {
  const isCurrentlyEnabled =
    nodeList.value.find((n) => n.typeId === typeId)?.active ?? false;

  if (!isDiagramNode(typeId)) {
    if (isCurrentlyEnabled) disableNode(typeId);
    else enableNode(typeId);
    return;
  }

  if (isCurrentlyEnabled) {
    disableNode(typeId);
  } else {
    enableNode(typeId);
  }

  scheduleAfterColumn({
    type: "DIAGRAM_OPTION_CHANGED",
    id: typeId,
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
    cancelPending();
    disableNode("thrust");
  }
  scheduleAfterColumn({
    type: "DIAGRAM_OPTION_CHANGED",
    id: "stages",
    enable: !separationVisible.value,
  });
}

// Per-side filtered node arrays — suppress the stages card on a given side
// when that rocket has no stages, even if the other rocket does.
const columnANodesDisplay = computed(() =>
  columnANodes.value.filter(
    (n) => n.typeId !== "stages" || hasRocketAWithStages.value,
  ),
);
const columnBNodesDisplay = computed(() =>
  columnBNodes.value.filter(
    (n) => n.typeId !== "stages" || hasRocketBWithStages.value,
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
  nodeList.value.filter((n) => n.typeId !== "stages"),
);

const stageCountA = computed(() =>
  displayRocketA.value
    ? (diagrams[displayRocketA.value.id]?.stages.length ?? 0)
    : 0,
);
const stageCountB = computed(() =>
  displayRocketB.value
    ? (diagrams[displayRocketB.value.id]?.stages.length ?? 0)
    : 0,
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
  <div style="position: absolute; top: 0; left: 0; padding: 8px; z-index: 10">
    <pre>
      {{ rocketAData ? rocketAData.length : "No Rocket A" }}
    </pre>
  </div>
  <div class="flex h-[calc(100vh-127px)]">
    <NodeColumn
      :nodes="columnANodesDisplay"
      :width="columnAWidthDisplay"
      :separationActive="separationVisible"
      :isAnimating="isAnimating"
      :stageCount="stageCountA"
      @trigger-separation="handleSeparationToggle()"
      @toggle-node="handleNodeToggle($event as NodeTypeId)"
    />
    <div ref="boardRef" class="relative flex-1 overflow-hidden">
      <v-stage
        :config="stageConfig"
        @click="(e: any) => e.evt.button === 0 && !e.evt.ctrlKey && closeAll()"
      >
        <v-layer ref="layerRef">
          <RocketImage
            v-if="displayRocketA"
            :rocket="displayRocketA"
            :x="leftRocketX"
            :baselineY="animatedBaselineY"
            :worldScale="animatedWorldScale"
            :separated="separationVisible"
            :opacity="rocketAOpacity"
            :columnANodesA="columnANodesDisplay.map((n) => n.typeId)"
            :columnBNodesA="columnBNodesDisplay.map((n) => n.typeId)"
            @show-thrust="onShowThrust"
            @show-configuration-node="onShowConfigurationNode"
          />
          <ThrustIndicator
            v-if="displayRocketA && thrustRenderVisible"
            :x="leftRocketX"
            :baselineY="animatedBaselineY"
            :rocketWidth="2 * rocketHalfW(displayRocketA)"
            :thrust="displayRocketA.toThrust"
            :plumeHeight="plumeHeight(displayRocketA.toThrust)"
            @hide-thrust="onHideThrust"
          />
          <RocketImage
            v-if="displayRocketB"
            :rocket="displayRocketB"
            :x="rightRocketX"
            :baselineY="animatedBaselineY"
            :worldScale="animatedWorldScale"
            :separated="separationVisible"
            :opacity="rocketBOpacity"
            :columnANodesA="columnANodesDisplay.map((n) => n.typeId)"
            :columnBNodesA="columnBNodesDisplay.map((n) => n.typeId)"
            @show-thrust="onShowThrust"
            @show-configuration-node="onShowConfigurationNode"
          />
          <ThrustIndicator
            v-if="displayRocketB && thrustRenderVisible"
            :x="rightRocketX"
            :baselineY="animatedBaselineY"
            :rocketWidth="2 * rocketHalfW(displayRocketB)"
            :thrust="displayRocketB.toThrust"
            :plumeHeight="plumeHeight(displayRocketB.toThrust)"
            @hide-thrust="onHideThrust"
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
      :isAnimating="isAnimating"
      :stageCount="stageCountB"
      @trigger-separation="handleSeparationToggle()"
      @toggle-node="handleNodeToggle($event as NodeTypeId)"
    />

    <CanvasPanel
      v-model:showScaleReference="showScaleReference"
      :nodes="panelNodes"
      :isAnimating="isAnimating"
      @toggle-node="handleNodeToggle($event as NodeTypeId)"
    />
  </div>
</template>
