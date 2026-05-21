<script setup lang="ts">
import NodeCard from "./NodeCard.vue";
import StagesCard from "./StagesCard.vue";
import type { NodeOwner } from "../composables/useNodeGrid";
import { NODE_COLUMN_WIDTH } from "../composables/useNodeGrid";

defineProps<{
  nodes: { id: string; label: string; owner: NodeOwner }[];
  width: number;
  separationActive: boolean;
  isAnimating: boolean;
}>();

const emit = defineEmits<{
  "trigger-separation": [];
}>();
</script>

<template>
  <div
    class="overflow-hidden shrink-0 transition-[width] duration-300 ease-in-out"
    :style="{ width: `${width}px` }"
  >
    <div
      class="h-full p-3 flex flex-col gap-3"
      :style="{ width: `${NODE_COLUMN_WIDTH}px` }"
    >
      <template v-for="node in nodes" :key="node.id">
        <StagesCard
          v-if="node.id === 'stages'"
          :label="node.label"
          :owner="node.owner"
          :separationActive="separationActive"
          :isAnimating="isAnimating"
          @trigger-separation="emit('trigger-separation')"
        />
        <NodeCard v-else :label="node.label" :owner="node.owner" />
      </template>
    </div>
  </div>
</template>
