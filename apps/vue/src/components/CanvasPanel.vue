<script setup lang="ts">
import { ref } from "vue";

const props = defineProps<{
  showScaleReference: boolean;
  bands: { id: string; label: string; active: boolean }[];
}>();

const emit = defineEmits<{
  "update:showScaleReference": [value: boolean];
  "toggle-band": [id: string];
}>();

const isOpen = ref(false);
</script>

<template>
  <div class="fixed top-0 right-0 bottom-0 pointer-events-none z-10">
    <div
      v-if="isOpen"
      class="fixed inset-0 pointer-events-auto"
      @click="isOpen = false"
    />

    <div
      class="absolute top-0 right-0 h-full w-2xl transform transition-transform ease-in-out duration-300 pointer-events-none"
      :class="isOpen ? 'translate-x-0' : 'translate-x-full'"
    >
      <button
        class="pointer-events-auto absolute top-16 right-full bg-orbitq-800 border border-orbitq-700 border-r-0 rounded-l-md px-2 py-2.5 text-orbitq-400 hover:text-orbitq-50 hover:bg-orbitq-700 transition-colors duration-300"
        :aria-label="isOpen ? 'Close panel' : 'Open panel'"
        @click="isOpen = !isOpen"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          class="transition-transform duration-300"
          :class="isOpen ? 'rotate-0' : 'rotate-180'"
        >
          <path
            d="M9 2L4 7L9 12"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </button>

      <div
        class="pointer-events-auto h-full w-full bg-orbitq-900/95 backdrop-blur-sm border-l border-orbitq-700 overflow-y-auto"
      >
        <div class="p-4 border-b border-orbitq-800">
          <p
            class="font-mono text-xs text-orbitq-500 uppercase tracking-widest"
          >
            Canvas Controls
          </p>
        </div>

        <div class="p-4 space-y-6">
          <div>
            <p
              class="font-mono text-xs text-orbitq-500 uppercase tracking-widest mb-3"
            >
              Display
            </p>
            <label class="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                :checked="props.showScaleReference"
                @change="
                  emit(
                    'update:showScaleReference',
                    ($event.target as HTMLInputElement).checked,
                  )
                "
              />
              <span class="text-sm text-orbitq-200">Scale Reference</span>
            </label>
          </div>

          <div v-if="props.bands.length > 0">
            <p
              class="font-mono text-xs text-orbitq-500 uppercase tracking-widest mb-3"
            >
              Layers
            </p>
            <label
              v-for="band in props.bands"
              :key="band.id"
              class="flex items-center gap-2 cursor-pointer"
            >
              <input
                type="checkbox"
                :checked="band.active"
                @change="emit('toggle-band', band.id)"
              />
              <span class="text-sm text-orbitq-200">{{ band.label }}</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
