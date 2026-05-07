<script setup lang="ts">
import { useQuery } from '@vue/apollo-composable'
import { ROCKET_CONFIGS_BY_IDS } from '@orbitq/graphql'
import type { RocketConfigsByIdsQuery, RocketConfigsByIdsVariables } from '@orbitq/graphql'

const SMOKE_TEST_IDS = [164, 121]

const { result, loading, error } = useQuery<RocketConfigsByIdsQuery, RocketConfigsByIdsVariables>(
  ROCKET_CONFIGS_BY_IDS,
  { ids: SMOKE_TEST_IDS },
)
</script>

<template>
  <div class="bg-orbitq-900 mx-auto w-full max-w-4xl px-6 py-8">
    <section class="border border-orbitq-700 rounded-sm p-6">
      <h2 class="font-mono text-orbitq-600 text-xs uppercase tracking-widest mb-4">Rockets</h2>
      <p v-if="loading" class="font-mono text-orbitq-600 text-sm">Loading…</p>
      <p v-else-if="error" class="font-mono text-status-negative text-sm">Error: {{ error.message }}</p>
      <ul v-else class="divide-y divide-orbitq-700">
        <li
          v-for="rocket in result?.rocketConfigsByIds"
          :key="rocket.id"
          class="py-3 font-mono text-sm text-orbitq-50 first:pt-0 last:pb-0"
        >
          {{ rocket.fullName }}
        </li>
      </ul>
    </section>
  </div>
</template>
