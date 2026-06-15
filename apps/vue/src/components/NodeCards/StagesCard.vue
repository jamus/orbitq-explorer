<script setup lang="ts">
import type { NodeOwner } from "../../composables/useNodeGrid";
import NodeCardContainer from "./CardContainer.vue";

defineProps<{
  typeId: string;
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
  <NodeCardContainer :label="label" :owner="owner" :typeId="typeId">
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
  </NodeCardContainer>
</template>
