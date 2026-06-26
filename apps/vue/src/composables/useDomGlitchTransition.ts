import { onUnmounted } from "vue";

export type DomGlitchTransitionConfig = {
  durationMs: number;
  durationJitterRatio: number;
  leaveDurationMs: number;
  initialY: number;
  jitterX: number;
  jitterY: number;
  intensityJitterRatio: number;
  red: string;
  cyan: string;
  scanline: string;
};

const DEFAULT_DOM_GLITCH: DomGlitchTransitionConfig = {
  durationMs: 260,
  durationJitterRatio: 0.18,
  leaveDurationMs: 140,
  initialY: 6,
  jitterX: 7,
  jitterY: 2,
  intensityJitterRatio: 0.24,
  red: "rgba(255, 71, 87, 0.46)",
  cyan: "rgba(0, 217, 255, 0.42)",
  scanline: "rgba(255, 255, 255, 0.14)",
};

const GLITCH_PROPERTIES = [
  "--dom-glitch-duration",
  "--dom-glitch-red",
  "--dom-glitch-cyan",
  "--dom-glitch-scanline",
  "--dom-glitch-x",
  "--dom-glitch-y",
  "--dom-glitch-opacity",
  "--dom-glitch-brightness",
  "--dom-glitch-scan-a",
  "--dom-glitch-scan-b",
  "--dom-glitch-scan-c",
  "--dom-glitch-scan-d",
  "--dom-glitch-block-a",
  "--dom-glitch-block-b",
  "--dom-glitch-block-c",
  "--dom-glitch-block-d",
  "--dom-glitch-clip-a",
  "--dom-glitch-clip-b",
] as const;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function randomRatio(ratio: number): number {
  return randomBetween(1 - ratio, 1 + ratio);
}

function randomPercent(min: number, max: number): string {
  return `${randomBetween(min, max).toFixed(2)}%`;
}

function asElement(el: Element): HTMLElement {
  return el as HTMLElement;
}

export function useDomGlitchTransition(
  config: Partial<DomGlitchTransitionConfig> = {},
) {
  const resolved = { ...DEFAULT_DOM_GLITCH, ...config };
  const timeouts = new Set<number>();

  function later(callback: () => void, delayMs: number) {
    const timeout = window.setTimeout(() => {
      timeouts.delete(timeout);
      callback();
    }, delayMs);
    timeouts.add(timeout);
  }

  function beforeEnter(el: Element) {
    const node = asElement(el);
    node.style.opacity = "0";
    node.style.transform = `translateY(${resolved.initialY}px)`;
  }

  function enter(el: Element, done: () => void) {
    const node = asElement(el);

    if (prefersReducedMotion()) {
      node.style.opacity = "";
      node.style.transform = "";
      done();
      return;
    }

    const durationMs = Math.round(
      resolved.durationMs * randomRatio(resolved.durationJitterRatio),
    );
    const intensity = randomRatio(resolved.intensityJitterRatio);
    const jitterX =
      randomBetween(resolved.jitterX * 0.5, resolved.jitterX * 1.25) *
      intensity;
    const jitterY =
      randomBetween(resolved.jitterY * 0.45, resolved.jitterY * 1.35) *
      intensity;
    const scanA = randomBetween(8, 24);
    const scanB = scanA + randomBetween(1.5, 4);
    const scanC = randomBetween(36, 62);
    const scanD = scanC + randomBetween(1.5, 4.5);
    const blockA = randomBetween(8, 30);
    const blockB = blockA + randomBetween(8, 22);
    const blockC = randomBetween(52, 76);
    const blockD = blockC + randomBetween(8, 18);

    node.style.setProperty("--dom-glitch-duration", `${durationMs}ms`);
    node.style.setProperty("--dom-glitch-red", resolved.red);
    node.style.setProperty("--dom-glitch-cyan", resolved.cyan);
    node.style.setProperty("--dom-glitch-scanline", resolved.scanline);
    node.style.setProperty("--dom-glitch-x", `${jitterX}px`);
    node.style.setProperty("--dom-glitch-y", `${jitterY}px`);
    node.style.setProperty(
      "--dom-glitch-opacity",
      randomBetween(0.62, 0.96).toFixed(2),
    );
    node.style.setProperty(
      "--dom-glitch-brightness",
      randomBetween(1.22, 1.62).toFixed(2),
    );
    node.style.setProperty("--dom-glitch-scan-a", `${scanA.toFixed(2)}%`);
    node.style.setProperty("--dom-glitch-scan-b", `${scanB.toFixed(2)}%`);
    node.style.setProperty("--dom-glitch-scan-c", `${scanC.toFixed(2)}%`);
    node.style.setProperty("--dom-glitch-scan-d", `${scanD.toFixed(2)}%`);
    node.style.setProperty("--dom-glitch-block-a", `${blockA.toFixed(2)}%`);
    node.style.setProperty("--dom-glitch-block-b", `${blockB.toFixed(2)}%`);
    node.style.setProperty("--dom-glitch-block-c", `${blockC.toFixed(2)}%`);
    node.style.setProperty("--dom-glitch-block-d", `${blockD.toFixed(2)}%`);
    node.style.setProperty("--dom-glitch-clip-a", randomPercent(14, 32));
    node.style.setProperty("--dom-glitch-clip-b", randomPercent(46, 68));
    node.classList.add("dom-glitch-entering");

    later(() => {
      node.classList.remove("dom-glitch-entering");
      node.style.opacity = "";
      node.style.transform = "";
      GLITCH_PROPERTIES.forEach((property) =>
        node.style.removeProperty(property),
      );
      done();
    }, durationMs);
  }

  function leave(el: Element, done: () => void) {
    const node = asElement(el);

    if (prefersReducedMotion()) {
      done();
      return;
    }

    node.style.transition = `opacity ${resolved.leaveDurationMs}ms ease-out, transform ${resolved.leaveDurationMs}ms ease-out`;
    node.style.opacity = "0";
    node.style.transform = "translateY(-4px)";

    later(() => {
      node.style.transition = "";
      node.style.opacity = "";
      node.style.transform = "";
      done();
    }, resolved.leaveDurationMs);
  }

  onUnmounted(() => {
    timeouts.forEach((timeout) => window.clearTimeout(timeout));
    timeouts.clear();
  });

  return {
    beforeEnter,
    enter,
    leave,
  };
}
