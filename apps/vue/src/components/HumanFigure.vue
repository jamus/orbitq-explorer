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

const pathConfig = {
  fill: "white",
  listening: false,
};
</script>

<template>
  <v-group :config="groupConfig">
    <v-path
      v-for="(path, i) in paths"
      :key="i"
      :config="{ ...pathConfig, data: path.d }"
    />
  </v-group>
</template>
