<script setup lang="ts">
import { ref } from "vue";
import { useQuery } from "@vue/apollo-composable";
import { ROCKET_CONFIGS } from "@orbitq/graphql";
import type { RocketConfigsQuery } from "@orbitq/graphql";

const { result, loading, error } = useQuery<RocketConfigsQuery>(ROCKET_CONFIGS);

const rocketAId = ref<number | null>(null);
const rocketBId = ref<number | null>(null);
</script>

<template>
  <div class="bg-orbitq-900 mx-auto w-full max-w-4xl px-6 py-8">
    <section class="border border-orbitq-700 rounded-sm p-6">
      <h2
        class="font-mono text-orbitq-600 text-xs uppercase tracking-widest mb-4"
      >
        Rockets
      </h2>
      <p v-if="loading" class="font-mono text-orbitq-600 text-sm">Loading…</p>
      <p v-else-if="error" class="font-mono text-status-negative text-sm">
        Error: {{ error.message }}
      </p>
      <div v-else class="flex gap-4">
        <select
          v-model="rocketAId"
          class="flex-1 bg-orbitq-800 border border-orbitq-700 text-orbitq-50 font-mono text-sm rounded-sm px-3 py-2"
        >
          <option :value="null" disabled>Select rocket A</option>
          <option
            v-for="rocket in result?.rocketConfigs"
            :key="rocket.id"
            :value="rocket.id"
          >
            {{ rocket.fullName }}
          </option>
        </select>
        <select
          v-model="rocketBId"
          class="flex-1 bg-orbitq-800 border border-orbitq-700 text-orbitq-50 font-mono text-sm rounded-sm px-3 py-2"
        >
          <option :value="null" disabled>Select rocket B</option>
          <option
            v-for="rocket in result?.rocketConfigs"
            :key="rocket.id"
            :value="rocket.id"
          >
            {{ rocket.fullName }}
          </option>
        </select>
      </div>
    </section>
  </div>
</template>
