<script setup lang="ts">
import { ref } from "vue";
import RocketSelector from "../components/RocketSelector.vue";
import Canvas from "../components/AppCanvas.vue";
import { useRocketData } from "../composables/useRocketData";
import type { SlimRocket } from "../composables/useRocketData";

const rocketA = ref<SlimRocket | null>(null);
const rocketB = ref<SlimRocket | null>(null);

const { rocketAData, rocketBData, rocketAFetching, rocketBFetching } =
  useRocketData(rocketA, rocketB);
</script>

<template>
  <div class="bg-orbitq-900 mx-auto w-full">
    <RocketSelector v-model:rocketA="rocketA" v-model:rocketB="rocketB" />
    <Canvas
      :rocketAData="rocketAData"
      :rocketBData="rocketBData"
      :rocketAFetching="rocketAFetching"
      :rocketBFetching="rocketBFetching"
    />
  </div>
</template>
