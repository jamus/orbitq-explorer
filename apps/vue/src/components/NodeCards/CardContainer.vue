<script setup lang="ts">
import type { NodeOwner } from "../../composables/useNodeGrid";

const props = defineProps<{
  label: string;
  owner: NodeOwner;
  typeId: string;
}>();

const emit = defineEmits<{
  "toggle-node": [typeId: string];
}>();

const handleToggleNode = function () {
  emit("toggle-node", props.typeId);
};
</script>

<template>
  <div
    class="relative w-full font-mono uppercase tracking-widest text-orbitq-500 text-[11px]"
  >
    <div
      class="-top-2 left-2 absolute w-full flex justify-between items-center"
    >
      <div class="">
        <h2 class="text-yellow-400 bg-orbitq-900">[ {{ typeId }} ]</h2>
      </div>
      <div class="top-0 right-0 absolute">
        <button
          @click="handleToggleNode()"
          class="px-1 bg-orbitq-900 cursor-pointer"
          :class="{
            'text-red-400': owner === 'a',
            'text-sky-400': owner === 'b',
            'text-yellow-400': owner === 'shared',
          }"
        >
          <span class="sr-only">Close</span>[ x ]
        </button>
      </div>
    </div>
    <div
      class="bg-orbitq-900 min-h-32 rounded p-3 border border-dashed flex flex-col items-start"
      :class="{
        'border-red-400': owner === 'a',
        'border-sky-400': owner === 'b',
        'border-yellow-400': owner === 'shared',
      }"
    >
      <div class="w-full font-mono">
        <slot></slot>
      </div>
    </div>
  </div>
</template>
