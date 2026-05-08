<script setup lang="ts">
import logoUrl from "@shared/assets/images/orbitq-logo.svg";
</script>

<template>
  <div
    class="min-h-screen flex flex-col bg-grid bg-orbitq-900 text-orbitq-50 font-grotesk"
  >
    <header
      class="bg-orbitq-900 border-b border-orbitq-700 px-6 h-14 flex items-center shrink-0"
    >
      <img :src="logoUrl" alt="OrbitQ" class="h-5 w-auto" />
    </header>
    <main class="flex-1 flex flex-col">
      <slot />
    </main>
    <footer
      class="px-6 py-3 border-t border-orbitq-800 text-orbitq-600 font-mono text-xs"
    >
      Human icon by
      <a
        href="https://thenounproject.com/creator/yangdonggyoo/"
        target="_blank"
        rel="noopener"
        class="underline hover:text-orbitq-400 transition-colors"
        >Dong Gyu Yang</a
      >
      via Noun Project
    </footer>
  </div>
</template>
