<script setup lang="ts">
import { ref, computed, watch } from "vue";
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

const rocketA = defineModel<Rocket | null>("rocketA", { default: null });
const queryA = ref("");

const rocketB = defineModel<Rocket | null>("rocketB", { default: null });
const queryB = ref("");

const compareMode = ref(false);

// @headlessui/vue is still on v1 (v2 with the `immediate` prop is React-only).
// Clicking the button programmatically opens the listbox; the `open` slot prop
// guards against toggling it closed when it is already open.
const buttonA = ref<InstanceType<typeof ComboboxButton> | null>(null);
const buttonB = ref<InstanceType<typeof ComboboxButton> | null>(null);

watch(
  result,
  (val) => {
    if (rocketA.value === null) {
      const starshipV2 = val?.rocketConfigs.find((r) => r.id === 527) ?? null;
      rocketA.value = starshipV2;
    }
  },
  { once: true },
);

function filterRockets(query: string) {
  const rockets = result.value?.rocketConfigs ?? [];
  if (!query) return rockets;
  const q = query.toLowerCase();
  return rockets.filter((r) => r.fullName.toLowerCase().includes(q));
}

const filteredA = computed(() => filterRockets(queryA.value));
const filteredB = computed(() => filterRockets(queryB.value));

function handleSelectA(val: Rocket | null) {
  if (val === null) return;
  rocketA.value = val.id === rocketA.value?.id ? null : val;
}

function handleSelectB(val: Rocket | null) {
  if (val === null) return;
  rocketB.value = val.id === rocketB.value?.id ? null : val;
}

function removeCompare() {
  compareMode.value = false;
  rocketB.value = null;
  queryB.value = "";
}
</script>

<template>
  <section class="p-6 w-full flex flex-col items-center justify-center gap-6">
    <p v-if="loading" class="font-mono text-orbitq-600 text-sm">Loading…</p>
    <p v-else-if="error" class="font-mono text-status-negative text-sm">
      Error: {{ error.message }}
    </p>
    <div
      v-else
      class="flex items-center justify-around w-1/2"
      :class="{ 'gap-60': compareMode }"
    >
      <Combobox
        v-slot="{ open: openA }"
        :modelValue="rocketA"
        @update:modelValue="handleSelectA"
        nullable
        as="div"
        class="relative flex-1"
      >
        <div class="relative">
          <ComboboxInput
            class="w-full border border-orbitq-700 text-orbitq-50 font-mono text-sm rounded-sm px-3 py-2 pr-8 focus:outline-none focus:border-orbitq-600 transition-colors placeholder:text-orbitq-600"
            :displayValue="(r: unknown) => (r as Rocket | null)?.fullName ?? ''"
            placeholder="Select rocket A"
            @focus="
              () => {
                queryA = '';
                if (!openA) buttonA?.$el.click();
              }
            "
            @change="
              (e: Event) => {
                queryA = (e.target as HTMLInputElement).value;
                if (!openA) buttonA?.$el.click();
              }
            "
          />
          <ComboboxButton
            ref="buttonA"
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
            v-for="rocket in filteredA"
            :key="rocket.id"
            :value="rocket"
            :disabled="rocket.id === rocketB?.id"
            v-slot="{ active, selected, disabled }"
          >
            <div
              :class="[
                'flex flex-col gap-0.5 px-3 py-2',
                disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer',
                active && !disabled && 'bg-orbitq-700',
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

      <template v-if="compareMode">
        <div class="flex gap-2 items-center flex-1">
          <Combobox
            v-slot="{ open: openB }"
            :modelValue="rocketB"
            @update:modelValue="handleSelectB"
            nullable
            as="div"
            class="relative flex-1"
          >
            <div class="relative">
              <ComboboxInput
                class="w-full border border-orbitq-700 text-orbitq-50 font-mono text-sm rounded-sm px-3 py-2 pr-8 focus:outline-none focus:border-orbitq-600 transition-colors placeholder:text-orbitq-600"
                :displayValue="
                  (r: unknown) => (r as Rocket | null)?.fullName ?? ''
                "
                placeholder="Select rocket B"
                @focus="
                  () => {
                    queryB = '';
                    if (!openB) buttonB?.$el.click();
                  }
                "
                @change="
                  (e: Event) => {
                    queryB = (e.target as HTMLInputElement).value;
                    if (!openB) buttonB?.$el.click();
                  }
                "
              />
              <ComboboxButton
                ref="buttonB"
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
                :disabled="rocket.id === rocketA?.id"
                v-slot="{ active, selected, disabled }"
              >
                <div
                  :class="[
                    'flex flex-col gap-0.5 px-3 py-2',
                    disabled
                      ? 'cursor-not-allowed opacity-40'
                      : 'cursor-pointer',
                    active && !disabled && 'bg-orbitq-700',
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
          <button
            class="shrink-0 text-orbitq-600 hover:text-orbitq-50 transition-colors p-1"
            aria-label="Remove comparison"
            @click="removeCompare"
          >
            <svg
              class="h-4 w-4"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z"
              />
            </svg>
          </button>
        </div>
      </template>

      <button
        v-else
        class="shrink-0 font-mono text-sm border border-orbitq-700 text-orbitq-400 hover:text-orbitq-50 hover:border-orbitq-600 rounded-sm px-3 py-2 transition-colors whitespace-nowrap"
        @click="compareMode = true"
      >
        + Add to compare
      </button>
    </div>
  </section>
</template>
