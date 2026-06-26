<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { canvasColors } from "@orbitq/styles/canvas";
import ContextMenu from "./ui/ContextMenu.vue";
import { useContextMenu } from "../composables/useContextMenu";
import { useKonvaGlitch } from "../composables/useKonvaGlitch";
import type { KonvaGlitchConfig } from "../composables/useKonvaGlitch";

const STROKE_WIDTH = 1.5;
const THRUST_APPLY_GLITCH = {
  startDelayMs: 0,
  durationMs: 260,
  stepMs: 18,
  fadeStartProgress: 0.58,
  opacity: {
    floor: 0.1,
    burst: 0.55,
  },
  colors: {
    red: "rgba(255, 71, 87, 0.56)",
    cyan: "rgba(0, 217, 255, 0.5)",
    green: "rgba(0, 255, 135, 0.36)",
    scanline: "rgba(255, 255, 255, 0.16)",
  },
  channelOffset: {
    redBaseX: 2.4,
    cyanBaseX: 2.2,
    cyanJitterRatio: 1.4,
    redY: { high: -0.9, low: 0.5 },
    cyanY: { high: 0.9, low: -0.5 },
  },
  mainJitter: {
    xRatio: 0.08,
    y: 0.35,
  },
  scanlines: {
    count: 12,
    accentEvery: 3,
    strokeWidthRatio: 0.003,
    minStrokeWidth: 0.8,
    evenOpacity: 0.18,
    oddOpacity: 0.08,
  },
  blocks: {
    count: 3,
    seedStep: 19,
    yRangePercent: 82,
    xBandPercent: 38,
    minWidthRatio: 0.22,
    widthStepPercent: 9,
    heightRatio: 0.018,
    minHeight: 2,
    evenOpacity: 0.48,
    oddOpacity: 0.28,
    visibleEverySteps: 2,
  },
} as const satisfies KonvaGlitchConfig;

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
    strokeWidth: STROKE_WIDTH,
    strokeScaleEnabled: false,
    listening: true,
  };
});

const plumeBounds = computed(() => {
  const halfWidth = rocketWidth.value / 2;
  const height = plumeHeight.value;
  if (halfWidth <= 0 || height <= 0) return null;
  return {
    minX: -halfWidth,
    minY: 0,
    width: halfWidth * 2,
    height,
  };
});

const thrustGlitch = useKonvaGlitch(
  THRUST_APPLY_GLITCH,
  () => plumeBounds.value,
  STROKE_WIDTH,
);

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

type ContextMenuState = { x: number; y: number };
const contextMenu = ref<ContextMenuState | null>(null);

watch(
  () => props.thrust,
  () => {
    thrustGlitch.start();
  },
  { immediate: true },
);

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

function onMouseEnter(e: any) {
  e.target.getStage()?.container().style.setProperty("cursor", "pointer");
  thrustHovered.value = true;
}

function onMouseLeave(e: any) {
  e.target.getStage()?.container().style.setProperty("cursor", "");
  thrustHovered.value = false;
}
</script>

<template>
  <v-group
    :config="groupConfig"
    @mouseenter="onMouseEnter"
    @mouseleave="onMouseLeave"
    @contextmenu="onTrustContextMenu($event)"
  >
    <v-line :config="lineConfig" />
    <v-group
      v-if="thrustGlitch.active.value"
      :config="thrustGlitch.layerConfig.value"
    >
      <v-line
        :config="{
          ...lineConfig,
          ...thrustGlitch.redPathConfig.value,
          x: thrustGlitch.redOffset.value.x,
          y: thrustGlitch.redOffset.value.y,
        }"
      />
      <v-line
        :config="{
          ...lineConfig,
          ...thrustGlitch.cyanPathConfig.value,
          x: thrustGlitch.cyanOffset.value.x,
          y: thrustGlitch.cyanOffset.value.y,
        }"
      />
      <v-line
        v-for="line in thrustGlitch.scanlineConfig.value"
        :key="line.key"
        :config="line"
      />
      <v-rect
        v-for="(block, index) in thrustGlitch.blocks.value"
        :key="`thrust-glitch-block-${index}`"
        :config="{
          ...block,
          listening: false,
          globalCompositeOperation: 'screen',
        }"
      />
    </v-group>
    <v-text :config="textConfig" />
  </v-group>
  <ContextMenu v-if="contextMenu" :x="contextMenu.x" :y="contextMenu.y">
    <button class="context-menu-item" @click="onHideThrust">
      <span aria-hidden="true">&gt;</span>
      <span>hide thrust</span>
    </button>
  </ContextMenu>
</template>
