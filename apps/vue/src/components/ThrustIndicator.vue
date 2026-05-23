<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { canvasColors } from "@orbitq/styles/canvas";
import DiagramContextMenu from "./DiagramContextMenu.vue";
import { useContextMenu } from "../composables/useContextMenu";

const props = defineProps<{
  x: number;
  baselineY: number;
  rocketWidth: number;
  thrust: number | null;
  plumeHeight: number;
}>();

const { closeSignal } = useContextMenu();
watch(closeSignal, () => {
  contextMenu.value = null;
});

const thrustHovered = ref(false);

const rocketWidth = computed(() => props.rocketWidth);
const plumeHeight = computed(() => props.plumeHeight);

const groupConfig = computed(() => ({ x: props.x, y: props.baselineY }));

const lineConfig = computed(() => {
  const halfWidth = rocketWidth.value / 2;
  const height = plumeHeight.value;
  return {
    points: [
      0,
      0,
      halfWidth / 2,
      0,
      halfWidth,
      height,
      -halfWidth,
      height,
      -halfWidth / 2,
      0,
    ],
    closed: true,
    fill: canvasColors.thrustPlume,
    stroke: thrustHovered.value
      ? canvasColors.interactionHighlight
      : "transparent",
    strokeWidth: 1.5,
    strokeScaleEnabled: false,
    listening: true,
  };
});

const formattedThrust = computed(() =>
  props.thrust !== null ? `${props.thrust.toLocaleString("en-US")} kN` : "",
);

const LABEL_WIDTH = 160;

const textConfig = computed(() => ({
  x: 0,
  y: plumeHeight.value + 6,
  offsetX: LABEL_WIDTH / 2,
  width: LABEL_WIDTH,
  text: formattedThrust.value,
  fontSize: 11,
  fontFamily: "monospace",
  fill: canvasColors.thrustPlume,
  align: "center",
  listening: true,
}));

const emit = defineEmits<{
  "hide-thrust": [];
}>();

type ContextMenu = { x: number; y: number };
const contextMenu = ref<ContextMenu | null>(null);

function onTrustContextMenu(e: any) {
  e.evt.preventDefault();
  contextMenu.value = { x: e.evt.clientX, y: e.evt.clientY };
}
function onHideThrust() {
  if (!contextMenu.value) return;
  emit("hide-thrust");
  closeContextMenu();
}

function closeContextMenu() {
  contextMenu.value = null;
}
</script>

<template>
  <v-group
    :config="groupConfig"
    @mouseenter="thrustHovered = true"
    @mouseleave="thrustHovered = false"
    @contextmenu="onTrustContextMenu($event)"
  >
    <v-line :config="lineConfig" />
    <v-text :config="textConfig" />
  </v-group>
  <DiagramContextMenu v-if="contextMenu" :x="contextMenu.x" :y="contextMenu.y">
    <button
      class="w-full px-3 py-1.5 text-left text-sm text-zinc-700 hover:bg-zinc-50"
      @click="onHideThrust"
    >
      Hide thrust
    </button>
  </DiagramContextMenu>
</template>
