<script setup lang="ts">
import type { NodeOwner } from "../composables/useNodeGrid";

defineProps<{
  label: string;
  owner: NodeOwner;
  id: string;
}>();
</script>

<template>
  <div
    class="min-h-32 rounded p-3 border-2 border-dashed flex items-start"
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
      {{ id }}
    </span>
  </div>
</template>
