<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import rawHuman from "@shared/assets/images/diagrams/human.svg?raw";
import { parseSvgPaths } from "@shared/utils/parseSvgPaths";

const REAL_HEIGHT_M = 1.75;
const RADIUS = 70;
const MAG_ZOOM = 15;
// Human center is clamped to this fraction of the radius so it's always partially visible
const MAX_CONTENT_OFFSET = RADIUS * 1.1;

const props = defineProps<{
  x: number;
  y: number;
  targetPos: { x: number; y: number } | null;
  worldScale: number;
  canvasBg: string;
}>();

const { paths, viewBox } = parseSvgPaths(rawHuman);

const gridPatternCanvas = ref<HTMLCanvasElement | null>(null);

onMounted(() => {
  const lineColor =
    getComputedStyle(document.documentElement)
      .getPropertyValue("--color-orbitq-50")
      .trim() || "#eff0f1";

  const size = 20;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = props.canvasBg;
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = lineColor;
  ctx.globalAlpha = 0.2;
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(5, 9.75);
  ctx.lineTo(15, 9.75);
  ctx.moveTo(10.25, 5);
  ctx.lineTo(10.25, 15);
  ctx.stroke();

  gridPatternCanvas.value = canvas;
});

const humanScaleFactor = computed(
  () => (REAL_HEIGHT_M / viewBox.height) * props.worldScale,
);

const humanClipPos = computed(() => {
  if (!props.targetPos) return { x: 0, y: 0 };
  const dx = props.targetPos.x - props.x;
  const dy = props.targetPos.y - props.y;
  const rawX = MAG_ZOOM * dx;
  const rawY = MAG_ZOOM * dy;
  const dist = Math.sqrt(rawX * rawX + rawY * rawY);
  const clamp = dist > MAX_CONTENT_OFFSET ? MAX_CONTENT_OFFSET / dist : 1;
  return { x: rawX * clamp, y: rawY * clamp };
});

const gridRectConfig = computed(() => {
  const S = MAG_ZOOM / props.worldScale;
  const { x: hx, y: hy } = humanClipPos.value;
  return {
    x: -RADIUS,
    y: -RADIUS,
    width: RADIUS * 2,
    height: RADIUS * 2,
    fillPatternImage: gridPatternCanvas.value,
    fillPatternScaleX: S,
    fillPatternScaleY: S,
    fillPatternOffset: {
      x: ((props.x - RADIUS - hx) / S) % 20,
      y: ((props.y - RADIUS - hy) / S) % 20,
    },
    listening: false,
  };
});

const scaleMagConfig = computed(() => ({
  x: props.x,
  y: props.y,
  radius: RADIUS,
  fill: props.canvasBg,
  stroke: props.canvasBg,
  strokeWidth: 4,
  listening: false,
}));

const haveTargetPos = computed(() => props.targetPos !== null);
const hideMagnifier = computed(() => props.x === 0 && props.y === 0);

// Outer group: positioned at the magnifier center, clips content to the circle
const clipGroupConfig = computed(() => ({
  x: props.x,
  y: props.y,
  clipFunc: (ctx: any) => {
    ctx.arc(0, 0, RADIUS, 0, Math.PI * 2);
  },
}));

const humanGroupConfig = computed(() => {
  if (!props.targetPos) return {};
  const { x, y } = humanClipPos.value;
  return {
    x,
    y,
    offsetX: viewBox.minX + viewBox.width / 2,
    offsetY: viewBox.minY + viewBox.height / 2,
    scaleX: MAG_ZOOM * humanScaleFactor.value,
    scaleY: MAG_ZOOM * humanScaleFactor.value,
  };
});

const pathConfig = {
  fill: "white",
  stroke: "transparent",
  strokeScaleEnabled: false,
  listening: false,
};
</script>

<template>
  <v-group>
    <v-circle v-if="!hideMagnifier" :config="scaleMagConfig" />
    <v-group v-if="haveTargetPos && !hideMagnifier" :config="clipGroupConfig">
      <v-rect v-if="gridPatternCanvas" :config="gridRectConfig" />
      <v-group :config="humanGroupConfig">
        <v-path
          v-for="(path, i) in paths"
          :key="i"
          :config="{ ...pathConfig, data: path.d }"
        />
      </v-group>
    </v-group>
  </v-group>
</template>
