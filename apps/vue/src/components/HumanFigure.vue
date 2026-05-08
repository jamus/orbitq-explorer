<script setup lang="ts">
import { computed } from "vue";
import { useImage } from "vue-konva";
import humanUrl from "../assets/images/human.svg?url";

const NATIVE_WIDTH = 30;
const NATIVE_HEIGHT = 175;
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
