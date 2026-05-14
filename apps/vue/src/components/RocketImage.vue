<script setup lang="ts">
import { computed, ref, watch, onUnmounted } from "vue";
import Konva from "konva";
import type { RocketConfig } from "@orbitq/graphql";
import { diagrams } from "@shared/const/diagrams";

const SEPARATION_DURATION = 500;
const STROKE = "#bdbebf";
const FILL = "#1e1f21";
const STROKE_WIDTH = 1.5;

const props = defineProps<{
  rocket: RocketConfig;
  x: number;
  baselineY: number;
  worldScale: number;
  separated?: boolean;
}>();

const entry = computed(() => diagrams[props.rocket.id]);

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
  };
});

const pathConfig = computed(() => ({
  fill: FILL,
  stroke: STROKE,
  strokeWidth: STROKE_WIDTH,
  strokeScaleEnabled: false,
  listening: false,
}));

// --- Stage separation animation ---

const rootGroupRef = ref<any>(null);
const stageOffsets = ref<number[]>([]);

watch(
  entry,
  (e) => {
    stageOffsets.value = new Array(e?.stages.length ?? 0).fill(0);
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
    const n = entry.value?.stages.length ?? 0;
    if (n === 0) return;
    if (sep) {
      const gap = entry.value!.viewBox.height * 0.1;
      const mid = (n - 1) / 2;
      animateToOffsets(Array.from({ length: n }, (_, i) => (mid - i) * gap));
    } else {
      animateToOffsets(new Array(n).fill(0));
    }
  },
);

onUnmounted(() => anim?.stop());
</script>

<template>
  <v-group v-if="groupConfig" :config="groupConfig" ref="rootGroupRef">
    <template v-if="entry!.stages.length">
      <v-group
        v-for="(stage, i) in entry!.stages"
        :key="stage.id"
        :config="{ y: stageOffsets[i] ?? 0 }"
      >
        <v-path
          v-for="(path, j) in stage.paths"
          :key="j"
          :config="{ ...pathConfig, data: path.d }"
        />
      </v-group>
    </template>
    <template v-else>
      <v-path
        v-for="(path, i) in entry!.paths"
        :key="i"
        :config="{ ...pathConfig, data: path.d }"
      />
    </template>
  </v-group>
</template>
