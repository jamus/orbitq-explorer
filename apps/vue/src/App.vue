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
  <div>
    <h1>OrbitQ Explorer</h1>
    <p v-if="loading">Loading rockets…</p>
    <p v-else-if="error">Error: {{ error.message }}</p>
    <ul v-else>
      <li v-for="rocket in result?.rocketConfigsByIds" :key="rocket.id">
        {{ rocket.fullName }}
      </li>
    </ul>
  </div>
</template>
