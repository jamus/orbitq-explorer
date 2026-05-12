import { computed } from "vue";
import type { Ref } from "vue";
import { useQuery } from "@vue/apollo-composable";
import { ROCKET_CONFIGS_BY_IDS } from "@orbitq/graphql";
import type {
  RocketConfigsQuery,
  RocketConfigsByIdsQuery,
  RocketConfigsByIdsVariables,
} from "@orbitq/graphql";

export type SlimRocket = RocketConfigsQuery["rocketConfigs"][number];

export function useRocketData(
  rocketA: Ref<SlimRocket | null>,
  rocketB: Ref<SlimRocket | null>,
) {
  const ids = computed(() =>
    [rocketA.value?.id, rocketB.value?.id]
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

  const rockets = computed(() => result.value?.rocketConfigsByIds ?? []);

  const rocketAData = computed(() => {
    if (!rocketA.value) return null;
    return rockets.value.find((r) => r.id === rocketA.value!.id) ?? null;
  });

  const rocketBData = computed(() => {
    if (!rocketB.value) return null;
    return rockets.value.find((r) => r.id === rocketB.value!.id) ?? null;
  });

  // True while a slot is selected but its query result hasn't arrived yet.
  // Consumers can use these to guard against intermediate null states during
  // in-flight fetches (e.g. skip animations until data is settled).
  const rocketAFetching = computed(() => !!rocketA.value && !rocketAData.value);
  const rocketBFetching = computed(() => !!rocketB.value && !rocketBData.value);

  return { rocketAData, rocketBData, rocketAFetching, rocketBFetching };
}
