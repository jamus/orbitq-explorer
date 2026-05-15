<script setup lang="ts">
import { computed } from "vue";
import { canvasColors } from "@orbitq/styles/canvas";

const props = defineProps<{
  x: number;
  baselineY: number;
  rocketWidth: number;
  thrust: number | null;
  plumeHeight: number;
  side: "left" | "right";
}>();

const rocketWidth = computed(() => props.rocketWidth);
const plumeHeight = computed(() => props.plumeHeight);

const groupConfig = computed(() => ({ x: props.x, y: props.baselineY }));

const lineConfig = computed(() => {
  const halfWidth = rocketWidth.value / 2;
  const height = plumeHeight.value;
  return {
    points: [
      0,
      0,
      halfWidth / 2,
      0,
      halfWidth,
      height,
      -halfWidth,
      height,
      -halfWidth / 2,
      0,
    ],
    closed: true,
    fill: canvasColors.thrustPlume,
    stroke: "none",
    strokeWidth: 1.5,
    strokeScaleEnabled: false,
    listening: false,
  };
});

const formattedThrust = computed(() =>
  props.thrust !== null ? `${props.thrust.toLocaleString("en-US")} kN` : "",
);

const LABEL_WIDTH = 160;
const LABEL_GAP = 8;

const textConfig = computed(() => {
  const halfWidth = rocketWidth.value / 2;
  const isLeft = props.side === "left";
  return {
    x: isLeft ? -halfWidth - LABEL_WIDTH - LABEL_GAP : halfWidth + LABEL_GAP,
    y: plumeHeight.value - 7,
    width: LABEL_WIDTH,
    text: formattedThrust.value,
    fontSize: 11,
    fontFamily: "monospace",
    fill: canvasColors.thrustPlume,
    align: isLeft ? "right" : "left",
    listening: false,
  };
});
</script>

<template>
  <v-group v-if="thrust !== null" :config="groupConfig">
    <v-line :config="lineConfig" />
    <v-text :config="textConfig" />
  </v-group>
</template>
