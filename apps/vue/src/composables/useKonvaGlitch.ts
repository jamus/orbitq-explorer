import { computed, onUnmounted, ref, watch } from "vue";
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

const RANDOM_PROFILE = {
  durationJitterRatio: 0.14,
  stepJitterRatio: 0.16,
  channelOffsetRatio: 0.28,
  mainJitterRatio: 0.24,
  scanlineJitterRatio: 0.22,
  blockPositionRatio: 0.18,
  blockSizeRatio: 0.18,
  opacityRatio: 0.1,
} as const;

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function randomRatio(ratio: number): number {
  return randomBetween(1 - ratio, 1 + ratio);
}

export function useKonvaGlitch(
  config: KonvaGlitchConfig,
  getBounds: () => GlitchBounds | null,
  strokeWidth: ComputedRef<number> | number,
  isEnabled: ComputedRef<boolean> | boolean = true,
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
  let runSeed = Math.floor(Math.random() * 10_000);
  let runDurationMs = config.durationMs;
  let runStepMs = config.stepMs;
  let channelOffsetMultiplier = 1;
  let mainJitterMultiplier = 1;
  let opacityMultiplier = 1;
  let scanlinePhase = 0;
  let blockPhase = 0;
  let blockPositionMultiplier = 1;
  let blockSizeMultiplier = 1;

  const resolvedStrokeWidth = computed(() =>
    typeof strokeWidth === "number" ? strokeWidth : strokeWidth.value,
  );
  const enabled = computed(() =>
    typeof isEnabled === "boolean" ? isEnabled : isEnabled.value,
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
        bounds.minY + i * spacing + scanlinePhase,
        bounds.minX + bounds.width,
        bounds.minY + i * spacing + scanlinePhase,
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

  function prepareRun() {
    const bounds = getBounds();
    runSeed = Math.floor(Math.random() * 10_000);
    runDurationMs = Math.max(
      1,
      config.durationMs * randomRatio(RANDOM_PROFILE.durationJitterRatio),
    );
    runStepMs = Math.max(
      1,
      config.stepMs * randomRatio(RANDOM_PROFILE.stepJitterRatio),
    );
    channelOffsetMultiplier = randomRatio(RANDOM_PROFILE.channelOffsetRatio);
    mainJitterMultiplier = randomRatio(RANDOM_PROFILE.mainJitterRatio);
    opacityMultiplier = randomRatio(RANDOM_PROFILE.opacityRatio);
    scanlinePhase = bounds
      ? randomBetween(-bounds.height, bounds.height) *
        RANDOM_PROFILE.scanlineJitterRatio *
        0.08
      : 0;
    blockPhase = Math.floor(randomBetween(0, 97));
    blockPositionMultiplier = randomRatio(RANDOM_PROFILE.blockPositionRatio);
    blockSizeMultiplier = randomRatio(RANDOM_PROFILE.blockSizeRatio);
  }

  function makeBlocks(seed: number): GlitchBlock[] {
    const bounds = getBounds();
    if (!bounds) return [];
    const { blocks: blockConfig, colors } = config;
    const blockColors = [colors.cyan, colors.red, colors.green];
    return Array.from({ length: blockConfig.count }, (_, i) => {
      const band =
        (seed + runSeed + blockPhase + i * blockConfig.seedStep) % 97;
      const xPercent =
        (((band * 3) % blockConfig.xBandPercent) / 100) *
        blockPositionMultiplier;
      const yPercent =
        (((band * 7) % blockConfig.yRangePercent) / 100) *
        blockPositionMultiplier;
      return {
        x: bounds.minX + bounds.width * Math.min(xPercent, 0.98),
        y: bounds.minY + bounds.height * Math.min(yPercent, 0.98),
        width:
          bounds.width *
          (blockConfig.minWidthRatio +
            (((band + i) % blockConfig.widthStepPercent) / 100) *
              blockSizeMultiplier),
        height: Math.max(
          bounds.height * blockConfig.heightRatio * blockSizeMultiplier,
          blockConfig.minHeight,
        ),
        fill: blockColors[(i + runSeed) % blockColors.length],
        opacity: i % 2 === 0 ? blockConfig.evenOpacity : blockConfig.oddOpacity,
      };
    });
  }

  function run() {
    prepareRun();
    active.value = true;

    const tick = (now: number) => {
      if (startTime === null) startTime = now;
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / runDurationMs, 1);
      const burst =
        progress < config.fadeStartProgress
          ? 1
          : Math.max(
              0,
              1 -
                (progress - config.fadeStartProgress) /
                  (1 - config.fadeStartProgress),
            );
      const step = Math.floor(elapsed / runStepMs);
      const polarity = (step + runSeed) % 2 === 0 ? 1 : -1;
      const jitter = burst * (1 + ((step + runSeed) % 3));

      opacity.value = Math.min(
        1,
        (config.opacity.burst * burst + config.opacity.floor) *
          opacityMultiplier,
      );
      mainOffset.value = {
        x: polarity * jitter * config.mainJitter.xRatio * mainJitterMultiplier,
        y:
          step % 4 === 0
            ? polarity * config.mainJitter.y * mainJitterMultiplier
            : 0,
      };
      redOffset.value = {
        x:
          polarity *
          (config.channelOffset.redBaseX + jitter) *
          channelOffsetMultiplier,
        y:
          step % 3 === 0
            ? config.channelOffset.redY.high * channelOffsetMultiplier
            : config.channelOffset.redY.low * channelOffsetMultiplier,
      };
      cyanOffset.value = {
        x:
          -polarity *
          (config.channelOffset.cyanBaseX +
            jitter * config.channelOffset.cyanJitterRatio) *
          channelOffsetMultiplier,
        y:
          step % 3 === 1
            ? config.channelOffset.cyanY.high * channelOffsetMultiplier
            : config.channelOffset.cyanY.low * channelOffsetMultiplier,
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
    if (!enabled.value || prefersReducedMotion() || !getBounds()) {
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

  watch(enabled, (value) => {
    if (!value) stop();
  });

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
