<script setup lang="ts">
import { ref, computed } from "vue";
import { useQuery } from "@vue/apollo-composable";
import { ROCKET_CONFIGS } from "@orbitq/graphql";
import type { RocketConfigsQuery } from "@orbitq/graphql";
import {
  Combobox,
  ComboboxInput,
  ComboboxButton,
  ComboboxOptions,
  ComboboxOption,
} from "@headlessui/vue";

type Rocket = RocketConfigsQuery["rocketConfigs"][number];

const { result, loading, error } = useQuery<RocketConfigsQuery>(ROCKET_CONFIGS);

const rocketA = ref<Rocket | null>(null);
const queryA = ref("");

const rocketB = ref<Rocket | null>(null);
const queryB = ref("");

function filterRockets(query: string) {
  const rockets = result.value?.rocketConfigs ?? [];
  if (!query) return rockets;
  const q = query.toLowerCase();
  return rockets.filter((r) => r.fullName.toLowerCase().includes(q));
}

const filteredA = computed(() => filterRockets(queryA.value));
const filteredB = computed(() => filterRockets(queryB.value));
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
      <Combobox v-model="rocketA" nullable as="div" class="relative flex-1">
        <div class="relative">
          <ComboboxInput
            class="w-full border border-orbitq-700 text-orbitq-50 font-mono text-sm rounded-sm px-3 py-2 pr-8 focus:outline-none focus:border-orbitq-600 transition-colors placeholder:text-orbitq-600"
            :displayValue="(r: unknown) => (r as Rocket | null)?.fullName ?? ''"
            placeholder="Select rocket A"
            @focus="queryA = ''"
            @change="queryA = ($event.target as HTMLInputElement).value"
          />
          <ComboboxButton
            class="absolute inset-y-0 right-0 flex items-center pr-2 text-orbitq-600 hover:text-orbitq-50 transition-colors"
          >
            <svg
              class="h-4 w-4"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              x
              <path
                fill-rule="evenodd"
                d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                clip-rule="evenodd"
              />
            </svg>
          </ComboboxButton>
        </div>
        <ComboboxOptions
          class="absolute z-10 mt-0.5 w-full bg-orbitq-850 border border-orbitq-700 rounded-sm py-1 shadow-lg max-h-60 overflow-auto focus:outline-none"
        >
          <ComboboxOption
            v-for="rocket in filteredA"
            :key="rocket.id"
            :value="rocket"
            v-slot="{ active, selected }"
          >
            <div
              :class="[
                'flex flex-col gap-0.5 px-3 py-2 cursor-pointer',
                active && 'bg-orbitq-700',
              ]"
            >
              <span
                :class="[
                  'font-mono text-sm text-orbitq-50',
                  selected && 'font-semibold',
                ]"
              >
                {{ rocket.fullName }}
              </span>
              <span
                v-if="rocket.manufacturer"
                class="font-mono text-xs text-orbitq-600"
              >
                {{ rocket.manufacturer.name }}
              </span>
            </div>
          </ComboboxOption>
          <p
            v-if="filteredA.length === 0"
            class="px-3 py-2 font-mono text-sm text-orbitq-600"
          >
            No results
          </p>
        </ComboboxOptions>
      </Combobox>

      <Combobox v-model="rocketB" nullable as="div" class="relative flex-1">
        <div class="relative">
          <ComboboxInput
            class="w-full border border-orbitq-700 text-orbitq-50 font-mono text-sm rounded-sm px-3 py-2 pr-8 focus:outline-none focus:border-orbitq-600 transition-colors placeholder:text-orbitq-600"
            :displayValue="(r: unknown) => (r as Rocket | null)?.fullName ?? ''"
            placeholder="Select rocket B"
            @focus="queryB = ''"
            @change="queryB = ($event.target as HTMLInputElement).value"
          />
          <ComboboxButton
            class="absolute inset-y-0 right-0 flex items-center pr-2 text-orbitq-600 hover:text-orbitq-50 transition-colors"
          >
            <svg
              class="h-4 w-4"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fill-rule="evenodd"
                d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                clip-rule="evenodd"
              />
            </svg>
          </ComboboxButton>
        </div>
        <ComboboxOptions
          class="absolute z-10 mt-0.5 w-full bg-orbitq-850 border border-orbitq-700 rounded-sm py-1 shadow-lg max-h-60 overflow-auto focus:outline-none"
        >
          <ComboboxOption
            v-for="rocket in filteredB"
            :key="rocket.id"
            :value="rocket"
            v-slot="{ active, selected }"
          >
            <div
              :class="[
                'flex flex-col gap-0.5 px-3 py-2 cursor-pointer',
                active && 'bg-orbitq-700',
              ]"
            >
              <span
                :class="[
                  'font-mono text-sm text-orbitq-50',
                  selected && 'font-semibold',
                ]"
              >
                {{ rocket.fullName }}
              </span>
              <span
                v-if="rocket.manufacturer"
                class="font-mono text-xs text-orbitq-600"
              >
                {{ rocket.manufacturer.name }}
              </span>
            </div>
          </ComboboxOption>
          <p
            v-if="filteredB.length === 0"
            class="px-3 py-2 font-mono text-sm text-orbitq-600"
          >
            No results
          </p>
        </ComboboxOptions>
      </Combobox>
    </div>
  </section>
</template>
