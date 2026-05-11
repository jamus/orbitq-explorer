<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  x: number;
  baselineY: number;
  rocketWidth: number;
  thrust: number | null;
  maxThrust: number;
}>();

const MIN_PLUME_PX = 8;
const MAX_ASPECT = 6;

const topWidth = computed(() => props.rocketWidth);

const plumeHeight = computed(() =>
  Math.max(
    topWidth.value * MAX_ASPECT * (props.thrust! / props.maxThrust),
    MIN_PLUME_PX,
  ),
);

const groupConfig = computed(() => ({ x: props.x, y: props.baselineY }));

const lineConfig = computed(() => {
  const hw = topWidth.value / 2;
  const h = plumeHeight.value;
  return {
    points: [-hw, 0, hw, 0, 0, h],
    closed: true,
    fill: "transparent",
    stroke: "#eff0f1",
    strokeWidth: 1.5,
    strokeScaleEnabled: false,
    listening: false,
  };
});

const formattedThrust = computed(() =>
  props.thrust !== null ? `${props.thrust.toLocaleString("en-US")} kN` : "",
);

const LABEL_WIDTH = 160;

const textConfig = computed(() => ({
  x: 0,
  y: plumeHeight.value + 6,
  offsetX: LABEL_WIDTH / 2,
  width: LABEL_WIDTH,
  text: formattedThrust.value,
  fontSize: 11,
  fontFamily: "monospace",
  fill: "#eff0f1",
  align: "center",
  listening: false,
}));
</script>

<template>
  <v-group v-if="thrust !== null" :config="groupConfig">
    <v-line :config="lineConfig" />
    <v-text :config="textConfig" />
  </v-group>
</template>
