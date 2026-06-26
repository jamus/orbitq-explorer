<script setup lang="ts">
import { computed } from "vue";
import type { RocketConfig } from "@orbitq/graphql";
import type { NodeOwner } from "../../composables/useNodeGrid";
import NodeCardContainer from "./CardContainer.vue";

const props = defineProps<{
  id?: number;
  label: string;
  owner: NodeOwner;
  typeId: string;
  rocket: RocketConfig | null;
}>();

const rows = computed(() => [
  ["variant", props.rocket?.variant ?? "N/A"],
  ["name", props.rocket?.name ?? "N/A"],
  ["full_name", props.rocket?.fullName ?? "N/A"],
  ["manufacturer", props.rocket?.manufacturer?.name ?? "N/A"],
  [
    "active",
    props.rocket ? (props.rocket.status === "ACTIVE" ? "Yes" : "No") : "N/A",
  ],
]);
</script>

<template>
  <NodeCardContainer :label="label" :owner="owner" :typeId="typeId">
    <span class="flex justify-end">#{{ props.rocket?.id }}</span>
    <dl class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[11px]">
      <template v-for="[field, value] in rows" :key="field">
        <dt class="text-orbitq-500">{{ field }}</dt>
        <dd class="min-w-0 text-orbitq-200 break-words">{{ value }}</dd>
      </template>
    </dl>
  </NodeCardContainer>
</template>
