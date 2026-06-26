<script setup lang="ts">
import NodeCard from "./NodeCards/NodeCard.vue";
import NodeCardEngine from "./NodeCards/EngineCard.vue";
import StagesCard from "./NodeCards/StagesCard.vue";
import BlankNode from "./NodeCards/BlankNode.vue";
import type { NodeOwner } from "../composables/useNodeGrid";
import { NODE_COLUMN_WIDTH } from "../composables/useNodeGrid";
import { useDomGlitchTransition } from "../composables/useDomGlitchTransition";

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
  glitchEffectsEnabled: boolean;
  stageCount?: number;
}>();

const emit = defineEmits<{
  "trigger-separation": [];
  "toggle-node": [typeId: string];
}>();

const cardGlitch = useDomGlitchTransition({}, () => props.glitchEffectsEnabled);

const getNodeComponent = (typeId: string) => {
  if (typeId === "stages") {
    return StagesCard;
  }

  if (isEngineStageNode(typeId)) {
    return engineNodeHasStage(typeId) ? NodeCardEngine : BlankNode;
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
  return typeId.startsWith("engine_stage_");
};

function engineNodeHasStage(typeId: string): boolean {
  let engineNodeHasStage = false;
  // if engine suffix is greater than stageCount, return false
  if (!props.stageCount) return false;
  const suffix = typeId.split("_").pop();
  if (!suffix) return false;
  const stageNumberForEngine = parseInt(suffix);
  if (isNaN(stageNumberForEngine)) return false;
  if (props.stageCount >= stageNumberForEngine) {
    engineNodeHasStage = true;
  }
  return engineNodeHasStage;
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
    <TransitionGroup
      tag="div"
      class="h-full p-3 flex flex-col gap-8"
      :style="{ width: `${NODE_COLUMN_WIDTH}px` }"
      :css="false"
      @before-enter="cardGlitch.beforeEnter"
      @enter="cardGlitch.enter"
      @leave="cardGlitch.leave"
    >
      <component
        v-for="node in nodes"
        :key="node.typeId"
        :is="getNodeComponent(node.typeId)"
        v-bind="getNodeProps(node)"
        @toggle-node="handleToggleNode($event as string)"
        @trigger-separation="emit('trigger-separation')"
      />
    </TransitionGroup>
  </div>
</template>
