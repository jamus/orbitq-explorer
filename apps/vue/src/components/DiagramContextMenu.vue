<script setup lang="ts">
defineProps<{
  x: number;
  y: number;
  title?: string;
}>();

const emit = defineEmits<{
  close: [];
}>();
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 z-40"
      @click="emit('close')"
      @contextmenu.prevent
    />
    <div
      class="fixed z-50 min-w-32 rounded border border-zinc-200 bg-white py-1 shadow-lg"
      :style="{ left: x + 'px', top: y + 'px' }"
    >
      <div
        v-if="title"
        class="border-b border-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-400"
      >
        {{ title }}
      </div>
      <slot />
    </div>
  </Teleport>
</template>
