<script setup lang="ts">
import { computed } from "vue";
import rawHuman from "@shared/assets/images/diagrams/human.svg?raw";
import { parseSvgPaths } from "@shared/utils/parseSvgPaths";

const REAL_HEIGHT_M = 1.75;

const props = defineProps<{
  x: number;
  baselineY: number;
  worldScale: number;
}>();

const emits = defineEmits<{
  (e: "hover-human", pos: { x: number; y: number } | null): void;
}>();

const { paths, viewBox } = parseSvgPaths(rawHuman);

const scaleFactor = computed(
  () => (REAL_HEIGHT_M / viewBox.height) * props.worldScale,
);

const groupConfig = computed(() => ({
  x: props.x,
  y: props.baselineY,
  offsetX: viewBox.minX + viewBox.width / 2,
  offsetY: viewBox.minY + viewBox.height,
  scaleX: scaleFactor.value,
  scaleY: scaleFactor.value,
}));

const needsMagnification = computed(() => scaleFactor.value < 0.25);

const pathConfig = computed(() => ({
  fill: "white",
  stroke: "transparent",
  strokeWidth: needsMagnification.value ? 8 : 0,
  hitStrokeWidth: needsMagnification.value ? 8 : 0,
  strokeScaleEnabled: false,
}));

const handlePointerMove = (e: any) => {
  const pos = e.target.getStage().getPointerPosition();
  if (needsMagnification.value) {
    emits("hover-human", pos);
  } else {
    emits("hover-human", null);
  }
};
</script>

<template>
  <div>needsMagnification: {{ needsMagnification }}</div>
  <v-group
    :config="groupConfig"
    @pointermove="handlePointerMove"
    @pointerleave="() => emits('hover-human', null)"
  >
    <v-path
      v-for="(path, i) in paths"
      :key="i"
      :config="{ ...pathConfig, data: path.d }"
    />
  </v-group>
</template>
