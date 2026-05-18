import { ref, onMounted, onUnmounted } from "vue";
import type { Ref } from "vue";

// Pre-mount estimates matching the header (86px) + footer (41px) layout.
// ResizeObserver corrects these on first paint.
const HEADER_H = 86;
const FOOTER_H = 41;

export function useBoardSize(containerRef: Ref<HTMLElement | null>) {
  const boardWidth = ref(window.innerWidth * 0.6);
  const boardHeight = ref(window.innerHeight - HEADER_H - FOOTER_H);

  let observer: ResizeObserver | null = null;

  onMounted(() => {
    if (!containerRef.value) return;
    observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      boardWidth.value = entry.contentRect.width;
      boardHeight.value = entry.contentRect.height;
    });
    observer.observe(containerRef.value);
  });

  onUnmounted(() => observer?.disconnect());

  return { boardWidth, boardHeight };
}
