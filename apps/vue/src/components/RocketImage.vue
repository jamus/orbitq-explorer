<script setup lang="ts">
import { computed } from "vue";
import { useImage } from "vue-konva";
import type { RocketConfig } from "@orbitq/graphql";
import { diagrams } from "@shared/const/diagrams";

const props = defineProps<{
  rocket: RocketConfig;
  x: number;
  baselineY: number;
  worldScale: number;
}>();

const entry = computed(() => diagrams[props.rocket.id]);

const [image] = useImage(() => entry.value?.url ?? "");

const pathScaleFactor = computed(() => {
  if (!entry.value || !props.rocket.length) return null;
  return (props.rocket.length / entry.value.nativeHeight) * props.worldScale;
});

const imageConfig = computed(() => {
  if (!image.value || !entry.value || !pathScaleFactor.value) return null;
  const scaledWidth = entry.value.nativeWidth * pathScaleFactor.value;
  const scaledHeight = entry.value.nativeHeight * pathScaleFactor.value;
  return {
    image: image.value,
    x: props.x - scaledWidth / 2,
    y: props.baselineY - scaledHeight,
    width: scaledWidth,
    height: scaledHeight,
  };
});
</script>

<template>
  <template v-if="imageConfig">
    <v-image :config="imageConfig" />
  </template>
</template>
