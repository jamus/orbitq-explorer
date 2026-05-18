<script setup lang="ts">
import NodeCard from "./NodeCard.vue";
import type { NodeOwner } from "../composables/useNodeGrid";
import { NODE_COLUMN_WIDTH } from "../composables/useNodeGrid";

defineProps<{
  nodes: { id: string; label: string; owner: NodeOwner }[];
  width: number;
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
      <NodeCard
        v-for="node in nodes"
        :key="node.id"
        :label="node.label"
        :owner="node.owner"
      />
    </div>
  </div>
</template>
