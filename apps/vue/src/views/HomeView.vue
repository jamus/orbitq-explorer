<script setup lang="ts">
import { ref } from "vue";
import type { RocketConfigsQuery } from "@orbitq/graphql";
import RocketSelector from "../components/RocketSelector.vue";
import Canvas from "../components/Canvas.vue";

type Rocket = RocketConfigsQuery["rocketConfigs"][number];

const rocketA = ref<Rocket | null>(null);
const rocketB = ref<Rocket | null>(null);
</script>

<template>
  <div class="bg-orbitq-900 mx-auto w-full max-w-4xl px-6 py-8">
    <RocketSelector v-model:rocketA="rocketA" v-model:rocketB="rocketB" />
    <Canvas :rocketA="rocketA" :rocketB="rocketB" />
  </div>
</template>
