<script setup lang="ts">
import NodeCard from "./NodeCards/NodeCard.vue";
import NodeCardEngine from "./NodeCards/EngineCard.vue";
import StagesCard from "./NodeCards/StagesCard.vue";
import type { NodeOwner } from "../composables/useNodeGrid";
import { NODE_COLUMN_WIDTH } from "../composables/useNodeGrid";

const props = defineProps<{
  nodes: {
    typeId: string;
    label: string;
    owner: NodeOwner;
  }[];
  width: number;
  separationActive: boolean;
  isAnimating: boolean;
  stageCount?: number;
}>();

const emit = defineEmits<{
  "trigger-separation": [];
}>();

const isEngineStageNode = (typeId: string) => {
  console.log("isEngineStageNode", props.nodes);
  return typeId.startsWith("engine_stage_");
};

function isStageAvailable(typeId: string): boolean {
  // if engine suffix is greater than stageCount, return false
  if (!props.stageCount) return false;
  const suffix = typeId.split("_").pop();
  if (!suffix) return false;
  const stageNumber = parseInt(suffix);
  if (isNaN(stageNumber)) return false;
  if (stageNumber > props.stageCount) return false;
  return true;
}
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
      <template v-for="node in nodes" :key="node.typeId">
        <StagesCard
          v-if="node.typeId === 'stages'"
          :typeId="node.typeId"
          :label="node.label"
          :owner="node.owner"
          :separationActive="separationActive"
          :isAnimating="isAnimating"
          :stageCount="stageCount ?? 0"
          @trigger-separation="emit('trigger-separation')"
        />
        <div v-else-if="isEngineStageNode(node.typeId)">
          <NodeCardEngine
            v-if="isStageAvailable(node.typeId)"
            :label="node.label"
            :owner="node.owner"
            :typeId="node.typeId"
          />
        </div>
        <NodeCard
          v-else
          :label="node.label"
          :owner="node.owner"
          :typeId="node.typeId"
        />
      </template>
    </div>
  </div>
</template>
