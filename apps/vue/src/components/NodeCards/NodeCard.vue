<script setup lang="ts">
import NodeCardContainer from "./CardContainer.vue";
import type { NodeOwner } from "../../composables/useNodeGrid.js";

defineProps<{
  label: string;
  owner: NodeOwner;
  typeId: string;
}>();
</script>

<template>
  <NodeCardContainer :label="label" :owner="owner" :typeId="typeId">
    <div class="font-mono text-[11px] text-orbitq-300">
      Type ID: {{ typeId }}
    </div>
  </NodeCardContainer>
</template>
