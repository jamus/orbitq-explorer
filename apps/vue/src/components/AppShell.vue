<script setup lang="ts">
import logoUrl from '@orbitq/assets/orbitq-logo.svg'
</script>

<template>
  <div class="min-h-screen flex flex-col bg-grid bg-orbitq-900 text-orbitq-50 font-grotesk">
    <header class="bg-orbitq-900 border-b border-orbitq-700 px-6 h-14 flex items-center shrink-0">
      <img :src="logoUrl" alt="OrbitQ" class="h-5 w-auto" />
    </header>
    <main class="flex-1 flex flex-col">
      <slot />
    </main>
  </div>
</template>
