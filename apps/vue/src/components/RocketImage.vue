<script setup lang="ts">
import { computed, ref, watch, onUnmounted } from "vue";
import Konva from "konva";
import type { RocketConfig } from "@orbitq/graphql";
import { diagrams } from "@shared/const/diagrams";
import { CSS_COLUMN_DURATION_MS } from "@shared/const/canvas";
import { canvasColors } from "@orbitq/styles/canvas";
import DiagramContextMenu from "./DiagramContextMenu.vue";
import { useContextMenu } from "../composables/useContextMenu";

const SEPARATION_DURATION = 500;
const STROKE_WIDTH = 1.5;

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
} as const;

const props = defineProps<{
  rocket: RocketConfig;
  x: number;
  baselineY: number;
  worldScale: number;
  separated?: boolean;
  opacity?: number;
  columnANodesA: string[];
  columnBNodesA: string[];
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

// --- Initial rocket acquisition glitch ---

type GlitchBlock = {
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
  opacity: number;
};

const glitchActive = ref(false);
const glitchRedOffset = ref({ x: 0, y: 0 });
const glitchCyanOffset = ref({ x: 0, y: 0 });
const glitchMainOffset = ref({ x: 0, y: 0 });
const glitchOpacity = ref(0);
const glitchBlocks = ref<GlitchBlock[]>([]);
const rocketConcealed = ref(false);

let glitchAnimationFrame: number | null = null;
let glitchStartDelay: number | null = null;
let glitchStartTime: number | null = null;

const glitchLayerConfig = computed(() => ({
  listening: false,
  opacity: glitchOpacity.value,
}));

const baseRocketVisibilityConfig = computed(() => ({
  listening: !rocketConcealed.value,
  opacity: rocketConcealed.value ? 0 : 1,
}));

const redPathConfig = computed(() => ({
  fill: ROCKET_LOAD_GLITCH.colors.red,
  stroke: ROCKET_LOAD_GLITCH.colors.red,
  strokeWidth: STROKE_WIDTH,
  strokeScaleEnabled: false,
  listening: false,
  globalCompositeOperation: "screen",
}));

const cyanPathConfig = computed(() => ({
  fill: ROCKET_LOAD_GLITCH.colors.cyan,
  stroke: ROCKET_LOAD_GLITCH.colors.cyan,
  strokeWidth: STROKE_WIDTH,
  strokeScaleEnabled: false,
  listening: false,
  globalCompositeOperation: "screen",
}));

const scanlineConfig = computed(() => {
  if (!entry.value) return [];
  const { viewBox } = entry.value;
  const { scanlines } = ROCKET_LOAD_GLITCH;
  const count = scanlines.count;
  const spacing = viewBox.height / count;
  return Array.from({ length: count }, (_, i) => ({
    key: `scanline-${i}`,
    points: [
      viewBox.minX,
      viewBox.minY + i * spacing,
      viewBox.minX + viewBox.width,
      viewBox.minY + i * spacing,
    ],
    stroke:
      i % scanlines.accentEvery === 0
        ? ROCKET_LOAD_GLITCH.colors.cyan
        : ROCKET_LOAD_GLITCH.colors.scanline,
    strokeWidth: Math.max(
      scanlines.minStrokeWidth,
      viewBox.height * scanlines.strokeWidthRatio,
    ),
    opacity: i % 2 === 0 ? scanlines.evenOpacity : scanlines.oddOpacity,
    listening: false,
  }));
});

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function stopGlitch(revealRocket = true) {
  if (glitchStartDelay !== null) {
    window.clearTimeout(glitchStartDelay);
    glitchStartDelay = null;
  }
  if (glitchAnimationFrame !== null) {
    window.cancelAnimationFrame(glitchAnimationFrame);
    glitchAnimationFrame = null;
  }
  glitchStartTime = null;
  glitchActive.value = false;
  glitchOpacity.value = 0;
  glitchBlocks.value = [];
  glitchRedOffset.value = { x: 0, y: 0 };
  glitchCyanOffset.value = { x: 0, y: 0 };
  glitchMainOffset.value = { x: 0, y: 0 };
  if (revealRocket) rocketConcealed.value = false;
}

function makeGlitchBlocks(seed: number): GlitchBlock[] {
  if (!entry.value) return [];
  const { viewBox } = entry.value;
  const { blocks, colors } = ROCKET_LOAD_GLITCH;
  const blockColors = [colors.cyan, colors.red, colors.green];
  return Array.from({ length: blocks.count }, (_, i) => {
    const band = (seed + i * blocks.seedStep) % 97;
    return {
      x:
        viewBox.minX +
        viewBox.width * (((band * 3) % blocks.xBandPercent) / 100),
      y:
        viewBox.minY +
        viewBox.height * (((band * 7) % blocks.yRangePercent) / 100),
      width:
        viewBox.width *
        (blocks.minWidthRatio + ((band + i) % blocks.widthStepPercent) / 100),
      height: Math.max(viewBox.height * blocks.heightRatio, blocks.minHeight),
      fill: blockColors[i % blockColors.length],
      opacity: i % 2 === 0 ? blocks.evenOpacity : blocks.oddOpacity,
    };
  });
}

function runGlitch() {
  glitchActive.value = true;

  const tick = (now: number) => {
    if (glitchStartTime === null) glitchStartTime = now;
    const elapsed = now - glitchStartTime;
    const progress = Math.min(elapsed / ROCKET_LOAD_GLITCH.durationMs, 1);
    const burst =
      progress < ROCKET_LOAD_GLITCH.fadeStartProgress
        ? 1
        : Math.max(
            0,
            1 -
              (progress - ROCKET_LOAD_GLITCH.fadeStartProgress) /
                (1 - ROCKET_LOAD_GLITCH.fadeStartProgress),
          );
    const step = Math.floor(elapsed / ROCKET_LOAD_GLITCH.stepMs);
    const polarity = step % 2 === 0 ? 1 : -1;
    const jitter = burst * (1 + (step % 3));

    glitchOpacity.value = Math.min(
      1,
      ROCKET_LOAD_GLITCH.opacity.burst * burst +
        ROCKET_LOAD_GLITCH.opacity.floor,
    );
    glitchMainOffset.value = {
      x: polarity * jitter * ROCKET_LOAD_GLITCH.mainJitter.xRatio,
      y: step % 4 === 0 ? polarity * ROCKET_LOAD_GLITCH.mainJitter.y : 0,
    };
    glitchRedOffset.value = {
      x: polarity * (ROCKET_LOAD_GLITCH.channelOffset.redBaseX + jitter),
      y:
        step % 3 === 0
          ? ROCKET_LOAD_GLITCH.channelOffset.redY.high
          : ROCKET_LOAD_GLITCH.channelOffset.redY.low,
    };
    glitchCyanOffset.value = {
      x:
        -polarity *
        (ROCKET_LOAD_GLITCH.channelOffset.cyanBaseX +
          jitter * ROCKET_LOAD_GLITCH.channelOffset.cyanJitterRatio),
      y:
        step % 3 === 1
          ? ROCKET_LOAD_GLITCH.channelOffset.cyanY.high
          : ROCKET_LOAD_GLITCH.channelOffset.cyanY.low,
    };

    if (step % ROCKET_LOAD_GLITCH.blocks.visibleEverySteps === 0) {
      glitchBlocks.value = makeGlitchBlocks(step);
    } else {
      glitchBlocks.value = [];
    }

    if (progress >= 1) {
      stopGlitch();
      return;
    }
    glitchAnimationFrame = window.requestAnimationFrame(tick);
  };

  glitchAnimationFrame = window.requestAnimationFrame(tick);
}

function startGlitch() {
  if (prefersReducedMotion() || !entry.value) {
    stopGlitch();
    return;
  }

  stopGlitch(false);
  rocketConcealed.value = true;

  if (ROCKET_LOAD_GLITCH.startDelayMs <= 0) {
    runGlitch();
    return;
  }

  glitchStartDelay = window.setTimeout(() => {
    glitchStartDelay = null;
    runGlitch();
  }, ROCKET_LOAD_GLITCH.startDelayMs);
}

watch(
  () => props.rocket.id,
  () => {
    startGlitch();
  },
  { immediate: true },
);

onUnmounted(stopGlitch);

// --- Engine hover + context menu ---

const { closeSignal } = useContextMenu();
watch(closeSignal, () => {
  contextMenu.value = null;
});

type ContextMenu = { target: string; x: number; y: number };
const contextMenu = ref<ContextMenu | null>(null);

function onEngineContextMenu(e: any) {
  e.evt.preventDefault();
  const target = e.target.parent.attrs.id;
  contextMenu.value = { target: target, x: e.evt.clientX, y: e.evt.clientY };
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

function tweenGroupPaths(
  group: any,
  stroke: string,
  duration = 0.2,
): Konva.Tween[] {
  const tweens: Konva.Tween[] = group
    .find("Path")
    .map((path: any) => new Konva.Tween({ node: path, duration, stroke }));
  tweens.forEach((t) => t.play());
  return tweens;
}

let engineTweens: Konva.Tween[] = [];

function isEngineGroup(node: any): boolean {
  return node.id?.()?.startsWith("engine") === true;
}

function findEngineAncestor(node: any): any {
  let n = node;
  while (n) {
    if (isEngineGroup(n)) return n;
    n = n.parent;
  }
  return null;
}

function onRocketEnter() {
  const rootNode = rootGroupRef.value?.getNode();
  if (!rootNode) return;
  engineTweens.forEach((t) => t.destroy());
  const engineGroups = rootNode.find((n: any) => isEngineGroup(n));
  engineTweens = engineGroups.flatMap((group: any) =>
    tweenGroupPaths(group, canvasColors.interactionHighlight),
  );
}

function onRocketLeave(e: any) {
  setCanvasCursor(e, "");
  engineTweens.forEach((t) => t.destroy());
  const rootNode = rootGroupRef.value?.getNode();
  if (!rootNode) return;
  engineTweens = rootNode
    .find((n: any) => isEngineGroup(n))
    .flatMap((group: any) => tweenGroupPaths(group, canvasColors.rocketStroke));
}

function onRocketMouseOver(e: any) {
  setCanvasCursor(e, findEngineAncestor(e.target) ? "pointer" : "");
}
</script>

<template>
  <v-group
    v-if="groupConfig"
    :config="groupConfig"
    ref="rootGroupRef"
    @mouseenter="onRocketEnter"
    @mouseleave="onRocketLeave"
    @mouseover="onRocketMouseOver"
  >
    <v-group
      v-for="(stage, i) in entry!.stages"
      :key="stage.id"
      :config="{
        ...baseRocketVisibilityConfig,
        x: glitchActive ? glitchMainOffset.x : 0,
        y: (stageOffsets[i] ?? 0) + (glitchActive ? glitchMainOffset.y : 0),
      }"
    >
      <v-path
        v-for="(path, index) in stage.paths"
        :key="index"
        :config="{ ...pathConfig, data: path.d }"
      />
      <v-group
        v-for="engine in stage.engines"
        :key="engine.id"
        :config="{ id: engine.id }"
        @contextmenu="onEngineContextMenu($event)"
      >
        <v-path
          v-for="(path, index) in engine.paths"
          :key="index"
          :config="{
            ...pathConfig,
            data: path.d,
            listening: true,
            hitStrokeWidth: 12,
          }"
        />
      </v-group>
    </v-group>

    <v-group v-if="glitchActive" :config="glitchLayerConfig">
      <v-group :config="glitchRedOffset">
        <v-group
          v-for="(stage, i) in entry!.stages"
          :key="`glitch-red-${stage.id}`"
          :config="{ y: stageOffsets[i] ?? 0 }"
        >
          <v-path
            v-for="(path, index) in stage.paths"
            :key="`stage-${index}`"
            :config="{ ...redPathConfig, data: path.d }"
          />
          <v-group
            v-for="engine in stage.engines"
            :key="engine.id"
            :config="{ id: `glitch-red-${engine.id}` }"
          >
            <v-path
              v-for="(path, index) in engine.paths"
              :key="`engine-${index}`"
              :config="{ ...redPathConfig, data: path.d }"
            />
          </v-group>
        </v-group>
      </v-group>

      <v-group :config="glitchCyanOffset">
        <v-group
          v-for="(stage, i) in entry!.stages"
          :key="`glitch-cyan-${stage.id}`"
          :config="{ y: stageOffsets[i] ?? 0 }"
        >
          <v-path
            v-for="(path, index) in stage.paths"
            :key="`stage-${index}`"
            :config="{ ...cyanPathConfig, data: path.d }"
          />
          <v-group
            v-for="engine in stage.engines"
            :key="engine.id"
            :config="{ id: `glitch-cyan-${engine.id}` }"
          >
            <v-path
              v-for="(path, index) in engine.paths"
              :key="`engine-${index}`"
              :config="{ ...cyanPathConfig, data: path.d }"
            />
          </v-group>
        </v-group>
      </v-group>

      <v-line v-for="line in scanlineConfig" :key="line.key" :config="line" />
      <v-rect
        v-for="(block, index) in glitchBlocks"
        :key="`glitch-block-${index}`"
        :config="{
          ...block,
          listening: false,
          globalCompositeOperation: 'screen',
        }"
      />
    </v-group>
  </v-group>

  <DiagramContextMenu
    v-if="contextMenu"
    :x="contextMenu.x"
    :y="contextMenu.y"
    variant="terminal"
  >
    <div
      class="border-b border-emerald-900 px-3 py-1 text-[10px] text-emerald-600"
    >
      +-- {{ contextMenu.target }}
    </div>
    <button
      :disabled="props.columnANodesA.includes(contextMenu.target)"
      :class="{
        disabled: props.columnANodesA.includes(contextMenu.target),
      }"
      class="terminal-menu-item"
      @click="onShowConfigurationNode(contextMenu.target)"
    >
      <span class="text-emerald-500">&gt;</span>
      <span>configuration</span>
    </button>
    <button
      v-if="contextMenu.target === 'engine_stage_01'"
      class="terminal-menu-item"
      @click="onShowThrust"
    >
      <span class="text-emerald-500">&gt;</span>
      <span>render thrust_trace</span>
    </button>
  </DiagramContextMenu>
</template>
<style scoped>
.terminal-menu-item {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 0.75rem;
  text-align: left;
  font-size: 0.75rem;
  line-height: 1rem;
  color: #d9f99d;
  text-transform: uppercase;
  transition:
    background-color 150ms ease,
    color 150ms ease;
}

.terminal-menu-item:hover {
  background: #052e16;
  color: #f7fee7;
}

.terminal-menu-item:focus-visible {
  outline: 1px solid #bef264;
  outline-offset: -2px;
}

.disabled {
  color: #3f6212;
  opacity: 0.7;
  pointer-events: none;
}
</style>
