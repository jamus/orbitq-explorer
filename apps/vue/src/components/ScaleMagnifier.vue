<script setup lang="ts">
import { computed } from "vue";
import rawHuman from "@shared/assets/images/diagrams/human.svg?raw";
import { parseSvgPaths } from "@shared/utils/parseSvgPaths";

const emits = defineEmits<{
  (e: "hover-human", pos: { x: number; y: number } | null): void;
}>();

const { paths, viewBox } = parseSvgPaths(rawHuman);

const props = defineProps<{
  x: number;
  y: number;
  targetPos: { x: number; y: number } | null;
}>();

const scaleMagConfig = computed(() => ({
  x: props.x,
  y: props.y,
  radius: 70,
  fill: "black",
  stroke: "black",
  strokeWidth: 4,
  listening: false,
}));

const pathConfig = computed(() => ({
  offsetX: viewBox.minX + viewBox.width / 2,
  offsetY: viewBox.minY + viewBox.height / 2,
  x: props.targetPos ? props.targetPos.x : null,
  y: props.targetPos ? props.targetPos.y : null,
  fill: "white",
  stroke: "transparent",
  strokeScaleEnabled: false,
  listening: false,
}));

const haveTargetPos = computed(() => props.targetPos !== null);

const hideMagnifier = computed(() => props.x === 0 && props.y === 0);
</script>

<template>
  <div>targetPos: {{ targetPos?.x }}, {{ targetPos?.y }}</div>

  <v-group v-if="haveTargetPos">
    <v-path
      v-for="(path, i) in paths"
      :key="i"
      :config="{ ...pathConfig, data: path.d }"
    />
  </v-group>
  <v-group>
    <v-circle v-if="!hideMagnifier" :config="scaleMagConfig" />
  </v-group>
</template>
