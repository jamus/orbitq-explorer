import { ref } from "vue";

const closeSignal = ref(0);

export function useContextMenu() {
  function closeAll() {
    closeSignal.value++;
  }
  return { closeSignal, closeAll };
}
