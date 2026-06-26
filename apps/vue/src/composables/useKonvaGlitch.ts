import { computed, onUnmounted, ref } from "vue";
import type { ComputedRef } from "vue";

export type GlitchBounds = {
  minX: number;
  minY: number;
  width: number;
  height: number;
};

export type GlitchBlock = {
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
  opacity: number;
};

export type KonvaGlitchConfig = {
  startDelayMs: number;
  durationMs: number;
  stepMs: number;
  fadeStartProgress: number;
  opacity: {
    floor: number;
    burst: number;
  };
  colors: {
    red: string;
    cyan: string;
    green: string;
    scanline: string;
  };
  channelOffset: {
    redBaseX: number;
    cyanBaseX: number;
    cyanJitterRatio: number;
    redY: { high: number; low: number };
    cyanY: { high: number; low: number };
  };
  mainJitter: {
    xRatio: number;
    y: number;
  };
  scanlines: {
    count: number;
    accentEvery: number;
    strokeWidthRatio: number;
    minStrokeWidth: number;
    evenOpacity: number;
    oddOpacity: number;
  };
  blocks: {
    count: number;
    seedStep: number;
    yRangePercent: number;
    xBandPercent: number;
    minWidthRatio: number;
    widthStepPercent: number;
    heightRatio: number;
    minHeight: number;
    evenOpacity: number;
    oddOpacity: number;
    visibleEverySteps: number;
  };
};

type StartOptions = {
  conceal?: boolean;
  delayMs?: number;
};

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function useKonvaGlitch(
  config: KonvaGlitchConfig,
  getBounds: () => GlitchBounds | null,
  strokeWidth: ComputedRef<number> | number,
) {
  const active = ref(false);
  const concealed = ref(false);
  const redOffset = ref({ x: 0, y: 0 });
  const cyanOffset = ref({ x: 0, y: 0 });
  const mainOffset = ref({ x: 0, y: 0 });
  const opacity = ref(0);
  const blocks = ref<GlitchBlock[]>([]);

  let animationFrame: number | null = null;
  let startDelay: number | null = null;
  let startTime: number | null = null;

  const resolvedStrokeWidth = computed(() =>
    typeof strokeWidth === "number" ? strokeWidth : strokeWidth.value,
  );

  const layerConfig = computed(() => ({
    listening: false,
    opacity: opacity.value,
  }));

  const baseVisibilityConfig = computed(() => ({
    listening: !concealed.value,
    opacity: concealed.value ? 0 : 1,
  }));

  const redPathConfig = computed(() => ({
    fill: config.colors.red,
    stroke: config.colors.red,
    strokeWidth: resolvedStrokeWidth.value,
    strokeScaleEnabled: false,
    listening: false,
    globalCompositeOperation: "screen",
  }));

  const cyanPathConfig = computed(() => ({
    fill: config.colors.cyan,
    stroke: config.colors.cyan,
    strokeWidth: resolvedStrokeWidth.value,
    strokeScaleEnabled: false,
    listening: false,
    globalCompositeOperation: "screen",
  }));

  const scanlineConfig = computed(() => {
    const bounds = getBounds();
    if (!bounds) return [];
    const { scanlines } = config;
    const spacing = bounds.height / scanlines.count;
    return Array.from({ length: scanlines.count }, (_, i) => ({
      key: `scanline-${i}`,
      points: [
        bounds.minX,
        bounds.minY + i * spacing,
        bounds.minX + bounds.width,
        bounds.minY + i * spacing,
      ],
      stroke:
        i % scanlines.accentEvery === 0
          ? config.colors.cyan
          : config.colors.scanline,
      strokeWidth: Math.max(
        scanlines.minStrokeWidth,
        bounds.height * scanlines.strokeWidthRatio,
      ),
      opacity: i % 2 === 0 ? scanlines.evenOpacity : scanlines.oddOpacity,
      listening: false,
    }));
  });

  function stop(reveal = true) {
    if (startDelay !== null) {
      window.clearTimeout(startDelay);
      startDelay = null;
    }
    if (animationFrame !== null) {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = null;
    }
    startTime = null;
    active.value = false;
    opacity.value = 0;
    blocks.value = [];
    redOffset.value = { x: 0, y: 0 };
    cyanOffset.value = { x: 0, y: 0 };
    mainOffset.value = { x: 0, y: 0 };
    if (reveal) concealed.value = false;
  }

  function makeBlocks(seed: number): GlitchBlock[] {
    const bounds = getBounds();
    if (!bounds) return [];
    const { blocks: blockConfig, colors } = config;
    const blockColors = [colors.cyan, colors.red, colors.green];
    return Array.from({ length: blockConfig.count }, (_, i) => {
      const band = (seed + i * blockConfig.seedStep) % 97;
      return {
        x:
          bounds.minX +
          bounds.width * (((band * 3) % blockConfig.xBandPercent) / 100),
        y:
          bounds.minY +
          bounds.height * (((band * 7) % blockConfig.yRangePercent) / 100),
        width:
          bounds.width *
          (blockConfig.minWidthRatio +
            ((band + i) % blockConfig.widthStepPercent) / 100),
        height: Math.max(
          bounds.height * blockConfig.heightRatio,
          blockConfig.minHeight,
        ),
        fill: blockColors[i % blockColors.length],
        opacity: i % 2 === 0 ? blockConfig.evenOpacity : blockConfig.oddOpacity,
      };
    });
  }

  function run() {
    active.value = true;

    const tick = (now: number) => {
      if (startTime === null) startTime = now;
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / config.durationMs, 1);
      const burst =
        progress < config.fadeStartProgress
          ? 1
          : Math.max(
              0,
              1 -
                (progress - config.fadeStartProgress) /
                  (1 - config.fadeStartProgress),
            );
      const step = Math.floor(elapsed / config.stepMs);
      const polarity = step % 2 === 0 ? 1 : -1;
      const jitter = burst * (1 + (step % 3));

      opacity.value = Math.min(
        1,
        config.opacity.burst * burst + config.opacity.floor,
      );
      mainOffset.value = {
        x: polarity * jitter * config.mainJitter.xRatio,
        y: step % 4 === 0 ? polarity * config.mainJitter.y : 0,
      };
      redOffset.value = {
        x: polarity * (config.channelOffset.redBaseX + jitter),
        y:
          step % 3 === 0
            ? config.channelOffset.redY.high
            : config.channelOffset.redY.low,
      };
      cyanOffset.value = {
        x:
          -polarity *
          (config.channelOffset.cyanBaseX +
            jitter * config.channelOffset.cyanJitterRatio),
        y:
          step % 3 === 1
            ? config.channelOffset.cyanY.high
            : config.channelOffset.cyanY.low,
      };

      if (step % config.blocks.visibleEverySteps === 0) {
        blocks.value = makeBlocks(step);
      } else {
        blocks.value = [];
      }

      if (progress >= 1) {
        stop();
        return;
      }
      animationFrame = window.requestAnimationFrame(tick);
    };

    animationFrame = window.requestAnimationFrame(tick);
  }

  function start(options: StartOptions = {}) {
    if (prefersReducedMotion() || !getBounds()) {
      stop();
      return;
    }

    stop(false);
    concealed.value = options.conceal ?? false;

    const delayMs = options.delayMs ?? config.startDelayMs;
    if (delayMs <= 0) {
      run();
      return;
    }

    startDelay = window.setTimeout(() => {
      startDelay = null;
      run();
    }, delayMs);
  }

  onUnmounted(stop);

  return {
    active,
    concealed,
    redOffset,
    cyanOffset,
    mainOffset,
    opacity,
    blocks,
    layerConfig,
    baseVisibilityConfig,
    redPathConfig,
    cyanPathConfig,
    scanlineConfig,
    start,
    stop,
  };
}
