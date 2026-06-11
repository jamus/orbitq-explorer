<script setup lang="ts">
import type { NodeOwner } from "../composables/useNodeGrid";

defineProps<{
  label: string;
  owner: NodeOwner;
  separationActive: boolean;
  isAnimating: boolean;
  stageCount: number;
}>();

const emit = defineEmits<{
  "trigger-separation": [];
}>();
</script>

<template>
  <div
    class="min-h-32 rounded p-3 border-2 border-dashed flex flex-col gap-3"
    :class="{
      'border-red-400/40 bg-red-500/5': owner === 'a',
      'border-sky-400/40 bg-sky-500/5': owner === 'b',
      'border-yellow-400/50 bg-yellow-400/10': owner === 'shared',
    }"
  >
    <span
      class="font-mono text-[11px] uppercase tracking-widest text-orbitq-500"
    >
      {{ label }}
    </span>
    <ul class="flex flex-col gap-1">
      <li
        v-for="i in stageCount"
        :key="i"
        class="font-mono text-[11px] text-orbitq-300"
      >
        Stage {{ String(i).padStart(2, "0") }}
      </li>
    </ul>
    <button
      class="w-full py-1.5 px-3 rounded border text-xs font-mono uppercase tracking-wider transition-colors duration-200"
      :class="[
        separationActive
          ? 'border-orbitq-500 text-orbitq-200 bg-orbitq-700/60 hover:bg-orbitq-600/60'
          : 'border-orbitq-700 text-orbitq-400 bg-orbitq-800/60 hover:bg-orbitq-700/60 hover:text-orbitq-200',
        isAnimating ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer',
      ]"
      :disabled="isAnimating"
      @click="emit('trigger-separation')"
    >
      {{ separationActive ? "Join Stages" : "Separate" }}
    </button>
  </div>
</template>
