<script setup lang="ts">
import { computed } from "vue";
import type { RocketConfig } from "@orbitq/graphql";
import { diagrams } from "@shared/const/diagrams";

const props = withDefaults(
  defineProps<{
    rocket: RocketConfig;
    x: number;
    baselineY: number;
    worldScale: number;
    stroke?: string;
    strokeWidth?: number;
  }>(),
  { stroke: "#eff0f1", strokeWidth: 1.5 },
);

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
  fill: "transparent",
  stroke: props.stroke,
  strokeWidth: props.strokeWidth,
  strokeScaleEnabled: false,
  listening: false,
}));
</script>

<template>
  <v-group v-if="groupConfig" :config="groupConfig">
    <v-path
      v-for="(path, i) in entry!.paths"
      :key="i"
      :config="{ ...pathConfig, data: path.d }"
    />
  </v-group>
</template>
