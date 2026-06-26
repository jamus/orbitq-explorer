<script setup lang="ts">
withDefaults(
  defineProps<{
    x: number;
    y: number;
    offset?: number;
  }>(),
  {
    offset: 14,
  },
);
</script>

<template>
  <Teleport to="body">
    <div
      class="context-menu fixed z-50"
      :style="{ left: x + offset + 'px', top: y + offset + 'px' }"
    >
      <slot />
    </div>
  </Teleport>
</template>

<style scoped>
.context-menu {
  min-width: 13rem;
  border: 1px dashed var(--color-status-warning);
  border-radius: 0.25rem;
  background: var(--color-orbitq-900);
  color: var(--color-orbitq-200);
  font-family: var(--font-mono);
  padding: 0.375rem;
}

:slotted(.context-menu-header) {
  display: flex;
  align-items: center;
  min-height: 1.75rem;
  margin: -1.25rem 0.25rem 0.25rem;
  padding: 0 0.25rem;
  background: var(--color-orbitq-900);
  color: var(--color-status-warning);
  font-family: var(--font-mono);
  font-size: 0.6875rem;
  letter-spacing: 0.12em;
  line-height: 1;
  text-transform: uppercase;
}

:slotted(.context-menu-item) {
  display: flex;
  width: 100%;
  min-height: 2rem;
  align-items: center;
  gap: 0.5rem;
  border: 0;
  border-radius: 0.125rem;
  background: transparent;
  color: var(--color-orbitq-300);
  cursor: pointer;
  font-family: var(--font-mono);
  font-size: 0.6875rem;
  letter-spacing: 0.12em;
  line-height: 1;
  padding: 0.5rem 0.5rem;
  text-align: left;
  text-transform: uppercase;
  transition:
    background-color 140ms ease,
    color 140ms ease;
}

:slotted(.context-menu-item:hover) {
  background: rgba(53, 54, 56, 0.78);
  color: var(--color-orbitq-50);
}

:slotted(.context-menu-item:focus-visible) {
  outline: 1px solid var(--color-status-warning);
  outline-offset: -2px;
}

:slotted(.context-menu-item.disabled),
:slotted(.context-menu-item:disabled) {
  color: var(--color-orbitq-700);
  cursor: default;
  pointer-events: none;
}
</style>
