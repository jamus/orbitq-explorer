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
      <select v-model="rocketAId" class="rocket-select flex-1">
        <button>
          <selectedcontent></selectedcontent>
        </button>
        <option :value="null" disabled>Select rocket A</option>
        <option
          v-for="rocket in result?.rocketConfigs"
          :key="rocket.id"
          :value="rocket.id"
        >
          <span class="option-name">{{ rocket.fullName }}</span>
          <span v-if="rocket.manufacturer" class="option-manufacturer">{{
            rocket.manufacturer.name
          }}</span>
        </option>
      </select>
      <select v-model="rocketBId" class="rocket-select flex-1">
        <button>
          <selectedcontent></selectedcontent>
        </button>
        <option :value="null" disabled>Select rocket B</option>
        <option
          v-for="rocket in result?.rocketConfigs"
          :key="rocket.id"
          :value="rocket.id"
        >
          <span class="option-name">{{ rocket.fullName }}</span>
          <span v-if="rocket.manufacturer" class="option-manufacturer">{{
            rocket.manufacturer.name
          }}</span>
        </option>
      </select>
    </div>
  </section>
</template>

<!-- Not scoped: ::picker(select) renders in the top layer outside Vue's scoped DOM -->
<style>
.rocket-select,
.rocket-select::picker(select) {
  appearance: base-select;
}

.rocket-select {
  background-color: var(--color-orbitq-800);
  border: 1px solid var(--color-orbitq-700);
  color: var(--color-orbitq-50);
  font-family: var(--font-mono);
  font-size: 0.875rem;
  border-radius: 0.125rem;
  padding: 0.5rem 0.75rem;
  transition: border-color 0.15s;
}

.rocket-select:hover,
.rocket-select:focus {
  border-color: var(--color-orbitq-600);
  outline: none;
}

.rocket-select::picker-icon {
  color: var(--color-orbitq-600);
  transition: rotate 0.2s;
}

.rocket-select:open::picker-icon {
  rotate: 180deg;
}

.rocket-select::picker(select) {
  background-color: var(--color-orbitq-850);
  border: 1px solid var(--color-orbitq-700);
  border-radius: 0.25rem;
  padding: 0.25rem;
  margin-top: 2px;
}

.rocket-select option {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  font-family: var(--font-mono);
  font-size: 0.875rem;
  color: var(--color-orbitq-50);
  padding: 0.5rem 0.75rem;
  border-radius: 0.125rem;
  cursor: pointer;
}

.rocket-select option:hover,
.rocket-select option:focus {
  background-color: var(--color-orbitq-700);
  outline: none;
}

.rocket-select option:checked {
  font-weight: 600;
}

.rocket-select .option-manufacturer {
  font-size: 0.75rem;
  color: var(--color-orbitq-600);
}

/* Hide manufacturer in the closed select button — selectedcontent clones the full option */
.rocket-select selectedcontent .option-manufacturer {
  display: none;
}
</style>
