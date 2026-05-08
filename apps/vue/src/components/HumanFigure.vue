<script setup lang="ts">
import { computed } from "vue";
import { useImage } from "vue-konva";
import humanUrl from "@shared/assets/images/diagrams/human.svg?url";
const NATIVE_WIDTH = 110;
const NATIVE_HEIGHT = 135;
const REAL_HEIGHT_M = 1.75;

const props = defineProps<{
  x: number;
  baselineY: number;
  worldScale: number;
}>();

const [image] = useImage(humanUrl);

const imageConfig = computed(() => {
  if (!image.value) return null;
  const scale = (REAL_HEIGHT_M / NATIVE_HEIGHT) * props.worldScale;
  const w = NATIVE_WIDTH * scale;
  const h = NATIVE_HEIGHT * scale;
  return {
    image: image.value,
    x: props.x - w / 2,
    y: props.baselineY - h,
    width: w,
    height: h,
  };
});
</script>

<template>
  <v-image v-if="imageConfig" :config="imageConfig" />
</template>
