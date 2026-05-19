<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from "vue";
import type { RocketConfig } from "@orbitq/graphql";
import { useNodeGrid } from "../composables/useNodeGrid";
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
  disableEffectNodes,
  isDiagramNode,
  nodeList,
  columnANodes,
  columnBNodes,
  columnAWidth,
  columnBWidth,
  thrustEnabled,
  thrustRenderVisible,
  hasEffectNodesEnabled,
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

const separationVisible = ref(false);
const showScaleReference = ref(true);

const { send, isAnimating } = useCanvasMachine({
  animate,
  animatedWorldScale: () => animatedWorldScale.value,
  animatedBaselineY: () => animatedBaselineY.value,
  displayRocketA: () => displayRocketA.value,
  displayRocketB: () => displayRocketB.value,
  getTargetScale(rockets, separated) {
    return targetScaleForLength(effectiveMaxLen(rockets, separated), rockets);
  },
  getTargetBaseline(rockets, separated) {
    return targetBaselineY(effectiveMaxLen(rockets, separated), rockets);
  },
  setDisplayRockets(a, b) {
    displayRocketA.value = a;
    displayRocketB.value = b;
  },
  showDiagram(id) {
    if (id === "separation") separationVisible.value = true;
    else showNode(id as NodeTypeId);
  },
  hideDiagram(id) {
    if (id === "separation") separationVisible.value = false;
    else hideNode(id as NodeTypeId);
  },
  disableEffectNodes,
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

  if (isCurrentlyEnabled) {
    disableNode(id);
  } else {
    // Enabling separation: close any conflicting effect-node columns first
    // so the CSS animation completes before the machine fires.
    if (id === "separation" && hasEffectNodesEnabled.value) {
      disableEffectNodes();
    }
    enableNode(id);
  }

  scheduleAfterColumn({
    type: "DIAGRAM_OPTION_CHANGED",
    id,
    enable: !isCurrentlyEnabled,
  });
}

// When the machine forces separation off (e.g. user enables a node from separation-active),
// sync the separation column back to disabled.
watch(separationVisible, (v) => {
  if (!v) disableNode("separation");
});

watch([() => props.rocketAData, () => props.rocketBData], ([newA, newB]) => {
  if (props.rocketAFetching || props.rocketBFetching) return;
  send({
    type: "ROCKET_SELECTION_CHANGED",
    rocketA: newA ?? null,
    rocketB: newB ?? null,
  });
});

const hasRocketWithStages = computed(() =>
  [displayRocketA.value, displayRocketB.value].some(
    (r) => r && (diagrams[r.id]?.stages.length ?? 0) > 0,
  ),
);

// Filter separation node from the panel when no staged rockets are loaded.
const panelNodes = computed(() =>
  nodeList.value.filter(
    (n) => n.id !== "separation" || hasRocketWithStages.value,
  ),
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

const leftMarginBounds = computed(() => ({
  x: CANVAS_PAD,
  y: 0,
  width: leftRocketX.value - rocketHalfW(displayRocketA.value) - CANVAS_PAD,
  height: boardHeight.value,
}));

const rightMarginBounds = computed(() => ({
  x: rightRocketX.value + rocketHalfW(displayRocketB.value),
  y: 0,
  width:
    boardWidth.value -
    CANVAS_PAD -
    (rightRocketX.value + rocketHalfW(displayRocketB.value)),
  height: boardHeight.value,
}));

const showMagnifier = ref<{ x: number; y: number } | null>(null);
const magnifierTargetPos = ref<{ x: number; y: number } | null>(null);

const handleMagnification = (
  payload: {
    pos: { x: number; y: number } | null;
    targetPos: { x: number; y: number } | null;
  } | null,
) => {
  if (!payload?.pos || !payload?.targetPos) {
    showMagnifier.value = null;
    magnifierTargetPos.value = null;
    return;
  }
  showMagnifier.value = payload.pos;
  magnifierTargetPos.value = payload.targetPos;
};

function plumeHeight(thrust: number | null): number {
  return ((thrust ?? 0) / KN_PER_PLUME_METRE) * animatedWorldScale.value;
}
</script>

<template>
  <div class="flex h-[calc(100vh-127px)]">
    <NodeColumn :nodes="columnANodes" :width="columnAWidth" />
    <div style="position: absolute; top: 0">
      x: {{ showMagnifier?.x.toFixed(0) }} y: {{ showMagnifier?.y.toFixed(0) }}
    </div>
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
            @hover-human="handleMagnification"
          />
          <ScaleMagnifier
            :x="showMagnifier ? showMagnifier.x : 0"
            :y="showMagnifier ? showMagnifier.y : 0"
            :targetPos="showMagnifier ? magnifierTargetPos : null"
          />
        </v-layer>
      </v-stage>

      <!-- DEBUG: remove before ship -->
      <div
        class="absolute top-2 right-2 font-mono text-xs text-status-warning space-y-0.5 pointer-events-none text-right"
      >
        <div>animatedWorldScale: {{ animatedWorldScale.toFixed(4) }}</div>
        <div>
          baselineY: {{ animatedBaselineY.toFixed(0) }} xA:
          {{ leftRocketX }} xB: {{ rightRocketX }}
        </div>
        <div>
          board: {{ boardWidth.toFixed(0) }}×{{ boardHeight.toFixed(0) }}
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

    <NodeColumn :nodes="columnBNodes" :width="columnBWidth" />

    <CanvasPanel
      v-model:showScaleReference="showScaleReference"
      :nodes="panelNodes"
      :isAnimating="isAnimating"
      @toggle-node="handleNodeToggle($event as NodeTypeId)"
    />
  </div>
</template>
