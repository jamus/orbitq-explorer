<script setup lang="ts">
import { computed } from "vue";
const props = defineProps<{
  x: number;
  y: number;
}>();

const scaleMagConfig = computed(() => ({
  x: props.x,
  y: props.y,
  radius: 70,
  // fill: "red",
  stroke: "black",
  strokeWidth: 4,
  listening: false,
}));

const hideMagnifier = computed(() => props.x === 0 && props.y === 0);
</script>

<template>
  <div>{{ x }}, {{ y }}</div>
  <v-circle v-if="!hideMagnifier" :config="scaleMagConfig" />
</template>
