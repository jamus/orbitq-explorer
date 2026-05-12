<template>
  <div
    class="min-h-screen flex flex-col bg-grid bg-orbitq-900 text-orbitq-50 font-grotesk"
  >
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
