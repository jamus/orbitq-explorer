<script setup lang="ts">
defineProps<{
  x: number;
  y: number;
}>();
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed z-50 min-w-44 border border-status-positive bg-orbitq-900 py-1 font-mono text-status-positive"
      :style="{ left: x + 'px', top: y + 'px' }"
    >
      <slot />
    </div>
  </Teleport>
</template>
