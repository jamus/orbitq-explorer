<script setup lang="ts">
import { computed } from "vue";
import rawHuman from "@shared/assets/images/diagrams/human.svg?raw";
import { parseSimpleSvg } from "@shared/utils/parseSvgPaths";

const REAL_HEIGHT_M = 1.75;
const HOVER_MARGIN = 100;

const props = defineProps<{
  x: number;
  baselineY: number;
  worldScale: number;
}>();

const emits = defineEmits<{
  (
    e: "hover-human",
    payload: {
      pointerPosition: { x: number; y: number } | null;
      humanPosition: { x: number; y: number } | null;
    } | null,
  ): void;
}>();

const { paths, viewBox } = parseSimpleSvg(rawHuman);

const scaleFactor = computed(
  () => (REAL_HEIGHT_M / viewBox.height) * props.worldScale,
);

const groupConfig = computed(() => ({
  x: props.x,
  y: props.baselineY,
  offsetX: viewBox.minX + viewBox.width / 2,
  offsetY: viewBox.minY + viewBox.height / 2,
  scaleX: scaleFactor.value,
  scaleY: scaleFactor.value,
}));

const needsMagnification = computed(() => scaleFactor.value < 0.25);

const pathConfig = computed(() => ({
  fill: "white",
  stroke: "transparent",
  strokeScaleEnabled: false,
}));

const hitRectConfig = computed(() => ({
  x: viewBox.minX - HOVER_MARGIN,
  y: viewBox.minY - HOVER_MARGIN,
  width: viewBox.width + HOVER_MARGIN * 2,
  height: viewBox.height + HOVER_MARGIN * 2,
  fill: "transparent",
  listening: true,
}));

const handlePointerMove = (event: any) => {
  const pointerPosition = event.target.getStage().getPointerPosition();
  const humanPosition = {
    x: event.target.parent.attrs.x,
    y: event.target.parent.attrs.y,
  };
  if (needsMagnification.value) {
    emits("hover-human", { pointerPosition, humanPosition });
  }
};

const handlePointerLeave = () => {
  emits("hover-human", null);
};
</script>

<template>
  <v-group :config="groupConfig">
    <v-path
      v-for="(path, index) in paths"
      :key="index"
      :config="{ ...pathConfig, data: path.d }"
    />
    <v-rect
      :config="hitRectConfig"
      @pointermove="handlePointerMove"
      @pointerleave="handlePointerLeave"
    />
  </v-group>
</template>
