<script setup lang="ts">
import { ref } from "vue";

const props = defineProps<{
  showScaleReference: boolean;
  glitchEffectsEnabled: boolean;
  prefersReducedMotion: boolean;
  isAnimating: boolean;
  nodes: {
    typeId: string;
    label: string;
    active: boolean;
    affectsDiagram: boolean;
  }[];
}>();

const emit = defineEmits<{
  "update:showScaleReference": [value: boolean];
  "update:glitchEffectsEnabled": [value: boolean];
  "toggle-node": [typeId: string];
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
            Settings
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
            <label
              class="mt-3 flex items-center gap-2"
              :class="
                props.prefersReducedMotion
                  ? 'cursor-not-allowed opacity-60'
                  : 'cursor-pointer'
              "
            >
              <input
                type="checkbox"
                :checked="props.glitchEffectsEnabled"
                :disabled="props.prefersReducedMotion"
                @change="
                  emit(
                    'update:glitchEffectsEnabled',
                    ($event.target as HTMLInputElement).checked,
                  )
                "
              />
              <span class="text-sm text-orbitq-200">Glitch effects</span>
            </label>
            <p
              v-if="props.prefersReducedMotion"
              class="mt-2 text-xs text-orbitq-600"
            >
              Disabled by your browser motion setting.
            </p>
          </div>

          <div
            v-if="props.nodes.some((n) => n.affectsDiagram)"
            class="transition-opacity duration-150"
            :class="
              props.isAnimating
                ? 'opacity-40 pointer-events-none'
                : 'opacity-100'
            "
          >
            <p
              class="font-mono text-xs text-orbitq-500 uppercase tracking-widest mb-3"
            >
              Diagram
            </p>
            <label
              v-for="node in props.nodes.filter((n) => n.affectsDiagram)"
              :key="node.typeId"
              class="flex items-center gap-2"
              :class="
                props.isAnimating ? 'cursor-not-allowed' : 'cursor-pointer'
              "
            >
              <input
                type="checkbox"
                :checked="node.active"
                :disabled="props.isAnimating"
                @change="emit('toggle-node', node.typeId)"
              />
              <span class="text-sm text-orbitq-200">{{ node.label }}</span>
            </label>
          </div>

          <div
            v-if="props.nodes.some((n) => !n.affectsDiagram)"
            class="transition-opacity duration-150"
            :class="
              props.isAnimating
                ? 'opacity-40 pointer-events-none'
                : 'opacity-100'
            "
          >
            <p
              class="font-mono text-xs text-orbitq-500 uppercase tracking-widest mb-3"
            >
              Nodes
            </p>
            <label
              v-for="node in props.nodes.filter((n) => !n.affectsDiagram)"
              :key="node.typeId"
              class="flex items-center gap-2"
              :class="
                props.isAnimating ? 'cursor-not-allowed' : 'cursor-pointer'
              "
            >
              <input
                type="checkbox"
                :checked="node.active"
                :disabled="props.isAnimating"
                @change="emit('toggle-node', node.typeId)"
              />
              <span class="text-sm text-orbitq-200">{{ node.label }}</span>
            </label>
          </div>

          <div>
            <p
              class="font-mono text-xs text-orbitq-500 uppercase tracking-widest mb-3"
            >
              Credits &amp; thanks
            </p>
            <ul class="space-y-2 text-xs text-orbitq-500">
              <li>
                Human icon by
                <a
                  href="https://thenounproject.com/creator/yangdonggyoo/"
                  target="_blank"
                  rel="noopener"
                  class="underline hover:text-orbitq-300 transition-colors"
                  >Dong Gyu Yang</a
                >
                via Noun Project.
              </li>
              <li>
                Glitch effect reference:
                <a
                  href="https://deloughry.co.uk/posts/building-glitch-effects-with-css/"
                  target="_blank"
                  rel="noopener"
                  class="underline hover:text-orbitq-300 transition-colors"
                  >Building glitch effects with CSS</a
                >.
              </li>
              <li>
                Rocket and launch data:
                <a
                  href="https://thespacedevs.com/llapi"
                  target="_blank"
                  rel="noopener"
                  class="underline hover:text-orbitq-300 transition-colors"
                  >The Space Devs LL2 API</a
                >.
              </li>
              <li>
                Built to accompany
                <a
                  href="https://www.orbitq.app/"
                  target="_blank"
                  rel="noopener"
                  class="underline hover:text-orbitq-300 transition-colors"
                  >OrbitQ launch tracker app</a
                >.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
