<script setup lang="ts">
import { computed } from "vue";
import { useQuery } from "@vue/apollo-composable";
import { ROCKET_CONFIGS_BY_IDS } from "@orbitq/graphql";
import type {
  RocketConfigsQuery,
  RocketConfigsByIdsQuery,
  RocketConfigsByIdsVariables,
  RocketConfig,
} from "@orbitq/graphql";
import RocketImage from "./RocketImage.vue";

type SlimRocket = RocketConfigsQuery["rocketConfigs"][number];

const props = defineProps<{
  rocketA: SlimRocket | null;
  rocketB: SlimRocket | null;
}>();

const ids = computed(() =>
  [props.rocketA?.id, props.rocketB?.id]
    .filter((id): id is number => id != null)
    .sort((a, b) => a - b),
);

const { result } = useQuery<
  RocketConfigsByIdsQuery,
  RocketConfigsByIdsVariables
>(
  ROCKET_CONFIGS_BY_IDS,
  () => ({ ids: ids.value }),
  () => ({ enabled: ids.value.length > 0 }),
);

const rockets = computed<RocketConfig[]>(
  () => result.value?.rocketConfigsByIds ?? [],
);

const rocketAData = computed(() => {
  if (!props.rocketA) return null;
  return rockets.value.find((r) => r.id === props.rocketA!.id) ?? null;
});

const rocketBData = computed(() => {
  if (!props.rocketB) return null;
  return rockets.value.find((r) => r.id === props.rocketB!.id) ?? null;
});

// Canvas fills the full viewport minus the 56px top nav bar.
const canvasWidth = window.innerWidth;
const canvasHeight = window.innerHeight - 56;

// Rockets sit with their base at 82% down the canvas, leaving headroom above
// and a ground strip below for labels / future ground-line artwork.
const baselineY = canvasHeight * 0.82;

// worldScale converts real-world metres into canvas pixels. It is driven by the
// taller of the two rockets so neither ever clips the top of the canvas.
// The available vertical space is capped at 70% of canvas height so the rocket
// doesn't crowd the top edge.
const maxLength = computed(() =>
  Math.max(rocketAData.value?.length ?? 0, rocketBData.value?.length ?? 0),
);

const worldScale = computed(() =>
  maxLength.value > 0 ? (canvasHeight * 0.7) / maxLength.value : 1,
);

// Rocket A is anchored at the 30% horizontal mark, rocket B at 70%,
// giving each side equal breathing room from the canvas edges and from each other.
const xA = canvasWidth * 0.3;
const xB = canvasWidth * 0.7;

const stageConfig = { width: canvasWidth, height: canvasHeight };
</script>

<template>
  <div class="relative">
    <v-stage :config="stageConfig">
      <v-layer>
        <RocketImage
          v-if="rocketAData"
          :rocket="rocketAData"
          :x="xA"
          :baselineY="baselineY"
          :worldScale="worldScale"
        />
        <RocketImage
          v-if="rocketBData"
          :rocket="rocketBData"
          :x="xB"
          :baselineY="baselineY"
          :worldScale="worldScale"
        />
      </v-layer>
    </v-stage>
    <!-- DEBUG: remove before ship -->
    <div
      class="absolute top-2 right-2 font-mono text-xs text-status-warning space-y-0.5 pointer-events-none text-right"
    >
      <div>worldScale: {{ worldScale.toFixed(4) }}</div>
      <div>baselineY: {{ baselineY.toFixed(0) }} xA: {{ xA }} xB: {{ xB }}</div>
      <div>
        A:
        {{
          rocketAData
            ? `id=${rocketAData.id} len=${rocketAData.length}m`
            : "none"
        }}
      </div>
      <div>
        B:
        {{
          rocketBData
            ? `id=${rocketBData.id} len=${rocketBData.length}m`
            : "none"
        }}
      </div>
    </div>
  </div>
</template>
