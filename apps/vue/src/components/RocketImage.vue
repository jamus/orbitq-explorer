<script setup lang="ts">
import { computed, ref, watch, onUnmounted } from "vue";
import Konva from "konva";
import type { RocketConfig } from "@orbitq/graphql";
import { diagrams } from "@shared/const/diagrams";
import { CSS_COLUMN_DURATION_MS } from "@shared/const/canvas";
import { canvasColors } from "@orbitq/styles/canvas";
import ContextMenu from "./ui/ContextMenu.vue";
import { useContextMenu } from "../composables/useContextMenu";
import { useKonvaGlitch } from "../composables/useKonvaGlitch";
import type { KonvaGlitchConfig } from "../composables/useKonvaGlitch";

const SEPARATION_DURATION = 500;
const STROKE_WIDTH = 1.5;
const DIMMED_STROKE_OPACITY = 0.25;

const ROCKET_LOAD_GLITCH = {
  startDelayMs: CSS_COLUMN_DURATION_MS + 200,
  durationMs: 270,
  stepMs: 16,
  fadeStartProgress: 0.62,
  opacity: {
    floor: 0.1,
    burst: 0.2,
  },
  colors: {
    red: "rgba(255, 71, 87, 0.62)",
    cyan: "rgba(0, 217, 255, 0.56)",
    green: "rgba(0, 255, 135, 0.5)",
    scanline: "rgba(255, 255, 255, 0.18)",
  },
  channelOffset: {
    redBaseX: 3.2,
    cyanBaseX: 3,
    cyanJitterRatio: 5,
    redY: { high: -1.2, low: 0.6 },
    cyanY: { high: 1.2, low: -0.7 },
  },
  mainJitter: {
    xRatio: 1000,
    y: 0,
  },
  scanlines: {
    count: 16,
    accentEvery: 3,
    strokeWidthRatio: 0.0018,
    minStrokeWidth: 0.8,
    evenOpacity: 0.26,
    oddOpacity: 0.12,
  },
  blocks: {
    count: 4,
    seedStep: 17,
    yRangePercent: 86,
    xBandPercent: 31,
    minWidthRatio: 0.18,
    widthStepPercent: 7,
    heightRatio: 0.012,
    minHeight: 2,
    evenOpacity: 0.74,
    oddOpacity: 0.48,
    visibleEverySteps: 2,
  },
} as const satisfies KonvaGlitchConfig;

const props = defineProps<{
  rocket: RocketConfig;
  x: number;
  baselineY: number;
  worldScale: number;
  separated?: boolean;
  opacity?: number;
  columnANodesA: string[];
  columnBNodesA: string[];
  glitchEffectsEnabled: boolean;
}>();

const entry = computed(() => {
  const diagram = diagrams[props.rocket.id];
  if (!diagram) {
    return null;
  }
  return diagram;
});

const scaleFactor = computed(() => {
  if (!entry.value || !props.rocket.length) return null;
  return (props.rocket.length / entry.value.nativeHeight) * props.worldScale;
});

const groupConfig = computed(() => {
  if (!entry.value || !scaleFactor.value) return null;
  const { viewBox } = entry.value;
  return {
    x: props.x,
    y: props.baselineY,
    offsetX: viewBox.minX + viewBox.width / 2,
    offsetY: viewBox.minY + viewBox.height,
    scaleX: scaleFactor.value,
    scaleY: scaleFactor.value,
    opacity: props.opacity ?? 1,
  };
});

const pathConfig = computed(() => ({
  fill: canvasColors.rocketFill,
  stroke: canvasColors.rocketStroke,
  strokeWidth: STROKE_WIDTH,
  strokeScaleEnabled: false,
  listening: true,
}));

// --- Stage separation animation ---

const rootGroupRef = ref<any>(null);
const stageOffsets = ref<number[]>([]);

watch(
  entry,
  (e) => {
    stageOffsets.value = Array.from({ length: e?.stages.length ?? 0 }, () => 0);
  },
  { immediate: true },
);

let anim: Konva.Animation | null = null;
let animStartTime: number | null = null;
let startOffsets: number[] = [];
let targetOffsets: number[] = [];

function animateToOffsets(targets: number[]) {
  startOffsets = [...stageOffsets.value];
  targetOffsets = targets;
  const layer = rootGroupRef.value?.getNode()?.getLayer();
  if (!layer) {
    stageOffsets.value = targets;
    return;
  }
  anim?.stop();
  animStartTime = null;
  anim = new Konva.Animation((frame) => {
    if (!frame) return;
    if (animStartTime === null) animStartTime = frame.time;
    const t = Math.min((frame.time - animStartTime) / SEPARATION_DURATION, 1);
    const eased = 1 - (1 - t) ** 3;
    stageOffsets.value = startOffsets.map(
      (s, i) => s + (targetOffsets[i] - s) * eased,
    );
    if (t >= 1) {
      anim!.stop();
      anim = null;
      animStartTime = null;
    }
  }, layer);
  anim.start();
}

watch(
  () => props.separated,
  (sep) => {
    const stages = entry.value?.stages;
    const n = stages?.length ?? 0;
    if (n <= 1) return;
    if (sep) {
      const gap = entry.value!.viewBox.height * 0.1;
      const midpointSuffix = (n - 1) / 2;
      const suffixOf = (s: { id: string }) =>
        parseInt(s.id.replace("stage_", ""), 10) - 1;
      animateToOffsets(
        stages!.map((s) => (midpointSuffix - suffixOf(s)) * gap),
      );
    } else {
      animateToOffsets(Array.from({ length: n }, () => 0));
    }
  },
  { immediate: true },
);

onUnmounted(() => anim?.stop());

// --- Glitch effects ---

const loadGlitch = useKonvaGlitch(
  ROCKET_LOAD_GLITCH,
  () => entry.value?.viewBox ?? null,
  STROKE_WIDTH,
  computed(() => props.glitchEffectsEnabled),
);

watch(
  () => props.rocket.id,
  () => {
    loadGlitch.start({ conceal: true });
  },
  { immediate: true },
);

// --- Part hover + context menu ---

const { closeSignal } = useContextMenu();
watch(closeSignal, () => {
  contextMenu.value = null;
});

type ContextMenuState = { target: string; x: number; y: number };
type HoverLabelState = { target: string; x: number; y: number };
const contextMenu = ref<ContextMenuState | null>(null);
const hoverLabel = ref<HoverLabelState | null>(null);
const hoveredPartId = ref<string | null>(null);

const labelConfig = computed(() => {
  if (!hoverLabel.value || !scaleFactor.value) return null;
  const inverseScale = 1 / scaleFactor.value;
  return {
    x: hoverLabel.value.x,
    y: hoverLabel.value.y,
    scaleX: inverseScale,
    scaleY: inverseScale,
    listening: false,
  };
});

const labelTextConfig = computed(() => ({
  text: hoverLabel.value?.target ?? "",
  fontSize: 11,
  fontFamily: "monospace",
  fill: canvasColors.interactionHighlight,
  padding: 5,
  listening: false,
}));

const labelTagConfig = computed(() => ({
  fill: canvasColors.rocketFill,
  stroke: canvasColors.interactionHighlight,
  strokeWidth: 1,
  opacity: 0.95,
  pointerDirection: "down" as const,
  pointerWidth: 8,
  pointerHeight: 6,
  lineJoin: "round" as const,
  listening: false,
}));

function onPartContextMenu(e: any) {
  const target = findPartId(e.target);
  if (!target) return;
  e.evt.preventDefault();
  hoverLabel.value = null;
  hoveredPartId.value = null;
  contextMenu.value = { target, x: e.evt.clientX, y: e.evt.clientY };
}

function closeContextMenu() {
  contextMenu.value = null;
}

const emit = defineEmits<{
  "show-thrust": [];
  "show-configuration-node": [target: string];
}>();

function onShowThrust() {
  if (!contextMenu.value) return;
  emit("show-thrust");
  closeContextMenu();
}

function onShowConfigurationNode(target: string) {
  emit("show-configuration-node", target);
  closeContextMenu();
}

function setCanvasCursor(e: any, cursor: string) {
  e.target.getStage()?.container().style.setProperty("cursor", cursor);
}

function isEngineGroup(node: any): boolean {
  return node.id?.()?.startsWith("engine") === true;
}

function isStageGroup(node: any): boolean {
  return node.id?.()?.startsWith("stage") === true;
}

function findPartId(node: any): string | null {
  let stageId: string | null = null;
  let n = node;
  while (n) {
    if (isEngineGroup(n)) return n.id();
    if (!stageId && isStageGroup(n)) stageId = n.id();
    n = n.parent;
  }
  return stageId;
}

function getPointerInRocket(e: any): { x: number; y: number } | null {
  const rootNode = rootGroupRef.value?.getNode();
  const pointer = e.target.getStage()?.getPointerPosition();
  if (!rootNode || !pointer) return null;
  return rootNode.getAbsoluteTransform().copy().invert().point(pointer);
}

function configForPart(partId: string) {
  const isHoveringAnotherPart =
    hoveredPartId.value !== null && hoveredPartId.value !== partId;
  return {
    ...pathConfig.value,
    stroke:
      hoveredPartId.value === partId
        ? canvasColors.interactionHighlight
        : pathConfig.value.stroke,
    strokeOpacity: isHoveringAnotherPart ? DIMMED_STROKE_OPACITY : 1,
  };
}

function onRocketLeave(e: any) {
  setCanvasCursor(e, "");
  hoverLabel.value = null;
  hoveredPartId.value = null;
}

function onRocketPointerMove(e: any) {
  if (contextMenu.value) {
    hoverLabel.value = null;
    hoveredPartId.value = null;
    return;
  }
  const target = findPartId(e.target);
  setCanvasCursor(e, target ? "pointer" : "");
  const pointer = getPointerInRocket(e);
  if (!target || !pointer) {
    hoverLabel.value = null;
    hoveredPartId.value = null;
    return;
  }
  hoveredPartId.value = target;
  hoverLabel.value = {
    target,
    x: pointer.x + 12 / (scaleFactor.value ?? 1),
    y: pointer.y - 12 / (scaleFactor.value ?? 1),
  };
}
</script>

<template>
  <v-group
    v-if="groupConfig"
    :config="groupConfig"
    ref="rootGroupRef"
    @mouseleave="onRocketLeave"
    @mousemove="onRocketPointerMove"
    @contextmenu="onPartContextMenu($event)"
  >
    <v-group
      v-for="(stage, i) in entry!.stages"
      :key="stage.id"
      :config="{
        id: stage.id,
        ...loadGlitch.baseVisibilityConfig.value,
        x: loadGlitch.active.value ? loadGlitch.mainOffset.value.x : 0,
        y:
          (stageOffsets[i] ?? 0) +
          (loadGlitch.active.value ? loadGlitch.mainOffset.value.y : 0),
      }"
    >
      <v-path
        v-for="(path, index) in stage.paths"
        :key="index"
        :config="{ ...configForPart(stage.id), data: path.d }"
      />
      <v-group
        v-for="engine in stage.engines"
        :key="engine.id"
        :config="{ id: engine.id }"
      >
        <v-path
          v-for="(path, index) in engine.paths"
          :key="index"
          :config="{
            ...pathConfig,
            ...configForPart(engine.id),
            data: path.d,
            listening: true,
            hitStrokeWidth: 12,
          }"
        />
      </v-group>
    </v-group>

    <v-group
      v-if="loadGlitch.active.value"
      :config="loadGlitch.layerConfig.value"
    >
      <v-group :config="loadGlitch.redOffset.value">
        <v-group
          v-for="(stage, i) in entry!.stages"
          :key="`glitch-red-${stage.id}`"
          :config="{ y: stageOffsets[i] ?? 0 }"
        >
          <v-path
            v-for="(path, index) in stage.paths"
            :key="`stage-${index}`"
            :config="{ ...loadGlitch.redPathConfig.value, data: path.d }"
          />
          <v-group
            v-for="engine in stage.engines"
            :key="engine.id"
            :config="{ id: `glitch-red-${engine.id}` }"
          >
            <v-path
              v-for="(path, index) in engine.paths"
              :key="`engine-${index}`"
              :config="{ ...loadGlitch.redPathConfig.value, data: path.d }"
            />
          </v-group>
        </v-group>
      </v-group>

      <v-group :config="loadGlitch.cyanOffset.value">
        <v-group
          v-for="(stage, i) in entry!.stages"
          :key="`glitch-cyan-${stage.id}`"
          :config="{ y: stageOffsets[i] ?? 0 }"
        >
          <v-path
            v-for="(path, index) in stage.paths"
            :key="`stage-${index}`"
            :config="{ ...loadGlitch.cyanPathConfig.value, data: path.d }"
          />
          <v-group
            v-for="engine in stage.engines"
            :key="engine.id"
            :config="{ id: `glitch-cyan-${engine.id}` }"
          >
            <v-path
              v-for="(path, index) in engine.paths"
              :key="`engine-${index}`"
              :config="{ ...loadGlitch.cyanPathConfig.value, data: path.d }"
            />
          </v-group>
        </v-group>
      </v-group>

      <v-line
        v-for="line in loadGlitch.scanlineConfig.value"
        :key="line.key"
        :config="line"
      />
      <v-rect
        v-for="(block, index) in loadGlitch.blocks.value"
        :key="`glitch-block-${index}`"
        :config="{
          ...block,
          listening: false,
          globalCompositeOperation: 'screen',
        }"
      />
    </v-group>
    <v-label v-if="labelConfig" :config="labelConfig">
      <v-tag :config="labelTagConfig" />
      <v-text :config="labelTextConfig" />
    </v-label>
  </v-group>

  <ContextMenu v-if="contextMenu" :x="contextMenu.x" :y="contextMenu.y">
    <div class="context-menu-header">[ {{ contextMenu.target }} ]</div>
    <button
      v-if="contextMenu.target.startsWith('engine_stage_')"
      :disabled="props.columnANodesA.includes(contextMenu.target)"
      :class="{
        disabled: props.columnANodesA.includes(contextMenu.target),
      }"
      class="context-menu-item"
      @click="onShowConfigurationNode(contextMenu.target)"
    >
      <span aria-hidden="true">&gt;</span>
      <span>configuration</span>
    </button>
    <button
      v-if="contextMenu.target === 'engine_stage_01'"
      class="context-menu-item"
      @click="onShowThrust"
    >
      <span aria-hidden="true">&gt;</span>
      <span>render thrust_trace</span>
    </button>
  </ContextMenu>
</template>
