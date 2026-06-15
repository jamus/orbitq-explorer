<script setup lang="ts">
import NodeCard from "./NodeCards/NodeCard.vue";
import NodeCardEngine from "./NodeCards/EngineCard.vue";
import StagesCard from "./NodeCards/StagesCard.vue";
import type { NodeOwner } from "../composables/useNodeGrid";
import { NODE_COLUMN_WIDTH } from "../composables/useNodeGrid";

interface nodeType {
  typeId: string;
  label: string;
  owner: NodeOwner;
}

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
  "toggle-node": [typeId: string];
}>();

const getNodeComponent = (typeId: string) => {
  console.log("getNodeComponent called with typeId:", typeId);
  if (typeId === "stages") {
    console.log("Returning StagesCard for typeId:", typeId);
    return StagesCard;
  }

  if (isEngineStageNode(typeId) && isStageAvailable(typeId)) {
    return NodeCardEngine;
  }

  return NodeCard;
};

const getNodeProps = (node: nodeType) => {
  if (node.typeId === "stages") {
    return {
      typeId: node.typeId,
      label: node.label,
      owner: node.owner,
      separationActive: props.separationActive,
      isAnimating: props.isAnimating,
      stageCount: props.stageCount ?? 0,
    };
  }

  return {
    typeId: node.typeId,
    label: node.label,
    owner: node.owner,
  };
};

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

function handleToggleNode(typeId: string) {
  emit("toggle-node", typeId);
}
</script>

<template>
  <div
    class="overflow-hidden shrink-0 transition-[width] duration-300 ease-in-out"
    :style="{ width: `${width}px` }"
  >
    <div
      class="h-full p-3 flex flex-col gap-8"
      :style="{ width: `${NODE_COLUMN_WIDTH}px` }"
    >
      <component
        v-for="node in nodes"
        :key="node.typeId"
        :is="getNodeComponent(node.typeId)"
        v-bind="getNodeProps(node)"
        @toggle-node="handleToggleNode($event as string)"
        @trigger-separation="emit('trigger-separation')"
      />
    </div>
  </div>
</template>
