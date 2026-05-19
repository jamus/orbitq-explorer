<script setup lang="ts">
import { computed } from "vue";
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
}>();

const { paths, viewBox } = parseSvgPaths(rawHuman);

const humanScaleFactor = computed(
  () => (REAL_HEIGHT_M / viewBox.height) * props.worldScale,
);

const scaleMagConfig = computed(() => ({
  x: props.x,
  y: props.y,
  radius: RADIUS,
  fill: "black",
  stroke: "black",
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

  const dx = props.targetPos.x - props.x;
  const dy = props.targetPos.y - props.y;
  const scale = MAG_ZOOM * humanScaleFactor.value;

  const rawX = MAG_ZOOM * dx;
  const rawY = MAG_ZOOM * dy;
  const dist = Math.sqrt(rawX * rawX + rawY * rawY);
  const clamp = dist > MAX_CONTENT_OFFSET ? MAX_CONTENT_OFFSET / dist : 1;

  return {
    x: rawX * clamp,
    y: rawY * clamp,
    offsetX: viewBox.minX + viewBox.width / 2,
    offsetY: viewBox.minY + viewBox.height / 2,
    scaleX: scale,
    scaleY: scale,
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
