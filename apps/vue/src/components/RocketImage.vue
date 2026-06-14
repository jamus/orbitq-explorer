<script setup lang="ts">
import { computed, ref, watch, onUnmounted } from "vue";
import Konva from "konva";
import type { RocketConfig } from "@orbitq/graphql";
import { diagrams } from "@shared/const/diagrams";
import { canvasColors } from "@orbitq/styles/canvas";
import DiagramContextMenu from "./DiagramContextMenu.vue";
import { useContextMenu } from "../composables/useContextMenu";

const SEPARATION_DURATION = 500;
const STROKE_WIDTH = 1.5;

const props = defineProps<{
  rocket: RocketConfig;
  x: number;
  baselineY: number;
  worldScale: number;
  separated?: boolean;
  opacity?: number;
}>();

const entry = computed(() => {
  console.log("RocketImage props", props.rocket);
  const diagram = diagrams[props.rocket.id];
  console.log(diagram, "diagram for rocket", props.rocket.id);
  if (!diagram) {
    console.warn(`No diagram found for rocket ${props.rocket.id}`);
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
    stageOffsets.value = new Array(e?.stages.length ?? 0).fill(0);
    console.log("RocketImage entry", entry.value);
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
      animateToOffsets(new Array(n).fill(0));
    }
  },
  { immediate: true },
);

onUnmounted(() => anim?.stop());

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
      :config="{ y: stageOffsets[i] ?? 0 }"
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
  </v-group>

  <DiagramContextMenu v-if="contextMenu" :x="contextMenu.x" :y="contextMenu.y">
    <button
      class="w-full px-3 py-1.5 text-left text-sm text-zinc-700 hover:bg-zinc-50"
      @click="onShowConfigurationNode(contextMenu.target)"
    >
      Configuration
    </button>
    <button
      v-if="contextMenu.target === 'engine_01'"
      class="w-full px-3 py-1.5 text-left text-sm text-zinc-700 hover:bg-zinc-50"
      @click="onShowThrust"
    >
      Show thrust
    </button>
  </DiagramContextMenu>
</template>
