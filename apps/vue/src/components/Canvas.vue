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

const { result, loading } = useQuery<
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
  return (
    rockets.value.find((rocket) => rocket.id === props.rocketA!.id) ?? null
  );
});
const rocketBData = computed(() => {
  if (!props.rocketB) return null;
  return (
    rockets.value.find((rocket) => rocket.id === props.rocketB!.id) ?? null
  );
});

const activeRockets = computed(() =>
  [rocketAData.value, rocketBData.value].filter(
    (rocket): rocket is RocketConfig => rocket != null,
  ),
);
</script>

<template>
  <div v-if="rocketA || rocketB">
    <p v-if="loading && activeRockets.length === 0">Loading…</p>
    <div v-for="rocket in activeRockets" :key="rocket.id">
      <p>{{ rocket.fullName }}</p>
      <p>{{ rocket.manufacturer?.name }}</p>
      <p>{{ rocket.status }}</p>
      <p>
        {{ rocket.totalLaunchCount }} launches ·
        {{ rocket.successfulLaunches }} successful
      </p>
    </div>
  </div>
</template>
