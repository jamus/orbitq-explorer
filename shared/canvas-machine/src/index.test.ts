import { describe, it, expect, vi } from "vitest";
import { createActor } from "xstate";
import { createCanvasMachine } from "./index.ts";
import type { CanvasMachineDeps } from "./index.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDeps(
  overrides: Partial<CanvasMachineDeps> = {},
): CanvasMachineDeps {
  return {
    animate: vi.fn(),
    animatedWorldScale: vi.fn(() => 1),
    animatedBaselineY: vi.fn(() => 0),
    getTargetScale: vi.fn(() => 1),
    getTargetBaseline: vi.fn(() => 0),
    displayRocketA: vi.fn(() => null),
    displayRocketB: vi.fn(() => null),
    setDisplayRockets: vi.fn(),
    syncVisibleBands: vi.fn(),
    showBands: vi.fn(),
    hideBand: vi.fn(),
    disableAllBands: vi.fn(),
    setSeparationVisible: vi.fn(),
    fadeOut: vi.fn(),
    fadeIn: vi.fn(),
    ...overrides,
  };
}

// Returns deps wired up so tests can resolve the animation promise manually.
function makeDepsWithAnimationControl() {
  let resolveAnimation: () => void = () => {};
  const deps = makeDeps({
    animate: vi.fn((_fs, _ts, _fb, _tb, callback) => {
      resolveAnimation = callback;
    }),
  });
  return {
    deps,
    resolveAnimation: () => resolveAnimation(),
  };
}

// Flush XState's internal fromPromise microtask queue so onDone fires.
const flushPromises = () => Promise.resolve();

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("createCanvasMachine", () => {
  describe("initial state", () => {
    it("starts in idle", () => {
      const { deps } = makeDepsWithAnimationControl();
      const actor = createActor(createCanvasMachine(deps));
      actor.start();
      expect(actor.getSnapshot().value).toBe("idle");
      actor.stop();
    });
  });

  describe("from idle", () => {
    it("ROCKET_SELECTION_CHANGED → animating-rockets, stores pendingRockets", () => {
      const { deps } = makeDepsWithAnimationControl();
      const actor = createActor(createCanvasMachine(deps));
      actor.start();

      actor.send({
        type: "ROCKET_SELECTION_CHANGED",
        rocketA: null,
        rocketB: null,
      });

      expect(actor.getSnapshot().value).toBe("animating-rockets");
      expect(actor.getSnapshot().context.pendingRockets).toEqual({
        a: null,
        b: null,
      });
      actor.stop();
    });

    it("BAND_TOGGLED enable=true → animating-band-on, stores id in pendingBands", () => {
      const { deps } = makeDepsWithAnimationControl();
      const actor = createActor(createCanvasMachine(deps));
      actor.start();

      actor.send({ type: "BAND_TOGGLED", id: "thrust", enable: true });

      expect(actor.getSnapshot().value).toBe("animating-band-on");
      expect(actor.getSnapshot().context.pendingBands).toEqual(["thrust"]);
      actor.stop();
    });

    it("BAND_TOGGLED enable=false → calls hideBand and → animating-band-off", () => {
      const { deps } = makeDepsWithAnimationControl();
      const actor = createActor(createCanvasMachine(deps));
      actor.start();

      actor.send({ type: "BAND_TOGGLED", id: "thrust", enable: false });

      expect(deps.hideBand).toHaveBeenCalledWith("thrust");
      expect(actor.getSnapshot().value).toBe("animating-band-off");
      actor.stop();
    });

    it("SEPARATION_TOGGLED enable=true → animating-separation-on, calls disableAllBands on entry", () => {
      const { deps } = makeDepsWithAnimationControl();
      const actor = createActor(createCanvasMachine(deps));
      actor.start();

      actor.send({ type: "SEPARATION_TOGGLED", enable: true });

      expect(actor.getSnapshot().value).toBe("animating-separation-on");
      expect(deps.disableAllBands).toHaveBeenCalledOnce();
      actor.stop();
    });

    it("SEPARATION_TOGGLED enable=false is ignored from idle", () => {
      const { deps } = makeDepsWithAnimationControl();
      const actor = createActor(createCanvasMachine(deps));
      actor.start();

      actor.send({ type: "SEPARATION_TOGGLED", enable: false });

      expect(actor.getSnapshot().value).toBe("idle");
      actor.stop();
    });
  });

  describe("animating-rockets", () => {
    it("animation completes → idle, calls setDisplayRockets and syncVisibleBands", async () => {
      const { deps, resolveAnimation } = makeDepsWithAnimationControl();
      const actor = createActor(createCanvasMachine(deps));
      actor.start();

      actor.send({
        type: "ROCKET_SELECTION_CHANGED",
        rocketA: null,
        rocketB: null,
      });
      resolveAnimation();
      await flushPromises();

      expect(actor.getSnapshot().value).toBe("idle");
      expect(deps.setDisplayRockets).toHaveBeenCalledWith(null, null);
      expect(deps.syncVisibleBands).toHaveBeenCalled();
      actor.stop();
    });

    it("separationActive flag routes onDone → separation-active", async () => {
      const { deps, resolveAnimation } = makeDepsWithAnimationControl();
      const actor = createActor(createCanvasMachine(deps));
      actor.start();

      // Enable separation first (sets separationActive=true in context)
      actor.send({ type: "SEPARATION_TOGGLED", enable: true });
      resolveAnimation();
      await flushPromises();
      expect(actor.getSnapshot().value).toBe("separation-active");

      // Now change rockets — should animate then return to separation-active
      actor.send({
        type: "ROCKET_SELECTION_CHANGED",
        rocketA: null,
        rocketB: null,
      });
      expect(actor.getSnapshot().value).toBe("animating-rockets");
      resolveAnimation();
      await flushPromises();

      expect(actor.getSnapshot().value).toBe("separation-active");
      actor.stop();
    });

    it("duplicate ROCKET_SELECTION_CHANGED updates pendingRockets and stays animating", () => {
      const rocketA = { id: "r1" } as any;
      const { deps } = makeDepsWithAnimationControl();
      const actor = createActor(createCanvasMachine(deps));
      actor.start();

      actor.send({
        type: "ROCKET_SELECTION_CHANGED",
        rocketA: null,
        rocketB: null,
      });
      actor.send({ type: "ROCKET_SELECTION_CHANGED", rocketA, rocketB: null });

      expect(actor.getSnapshot().value).toBe("animating-rockets");
      expect(actor.getSnapshot().context.pendingRockets).toEqual({
        a: rocketA,
        b: null,
      });
      actor.stop();
    });

    it("BAND_TOGGLED enable=true while animating queues into pendingBands", () => {
      const { deps } = makeDepsWithAnimationControl();
      const actor = createActor(createCanvasMachine(deps));
      actor.start();

      actor.send({
        type: "ROCKET_SELECTION_CHANGED",
        rocketA: null,
        rocketB: null,
      });
      actor.send({ type: "BAND_TOGGLED", id: "thrust", enable: true });

      expect(actor.getSnapshot().context.pendingBands).toEqual(["thrust"]);
      actor.stop();
    });

    it("pendingBands deduplicates repeated BAND_TOGGLED for the same id", () => {
      const { deps } = makeDepsWithAnimationControl();
      const actor = createActor(createCanvasMachine(deps));
      actor.start();

      actor.send({
        type: "ROCKET_SELECTION_CHANGED",
        rocketA: null,
        rocketB: null,
      });
      actor.send({ type: "BAND_TOGGLED", id: "thrust", enable: true });
      actor.send({ type: "BAND_TOGGLED", id: "thrust", enable: true });

      expect(actor.getSnapshot().context.pendingBands).toEqual(["thrust"]);
      actor.stop();
    });
  });

  describe("animating-band-on", () => {
    it("animation completes → idle, calls showBands then clears pendingBands", async () => {
      const { deps, resolveAnimation } = makeDepsWithAnimationControl();
      const actor = createActor(createCanvasMachine(deps));
      actor.start();

      actor.send({ type: "BAND_TOGGLED", id: "thrust", enable: true });
      resolveAnimation();
      await flushPromises();

      expect(deps.showBands).toHaveBeenCalledWith(["thrust"]);
      expect(actor.getSnapshot().value).toBe("idle");
      expect(actor.getSnapshot().context.pendingBands).toEqual([]);
      actor.stop();
    });
  });

  describe("separation lifecycle", () => {
    async function reachSeparationActive(
      deps: CanvasMachineDeps,
      resolveAnimation: () => void,
    ) {
      const actor = createActor(createCanvasMachine(deps));
      actor.start();
      actor.send({ type: "SEPARATION_TOGGLED", enable: true });
      resolveAnimation();
      await flushPromises();
      expect(actor.getSnapshot().value).toBe("separation-active");
      return actor;
    }

    it("SEPARATION_TOGGLED enable=false → animating-separation-off", async () => {
      const { deps, resolveAnimation } = makeDepsWithAnimationControl();
      const actor = await reachSeparationActive(deps, resolveAnimation);

      actor.send({ type: "SEPARATION_TOGGLED", enable: false });

      expect(actor.getSnapshot().value).toBe("animating-separation-off");
      expect(deps.setSeparationVisible).toHaveBeenLastCalledWith(false);
      actor.stop();
    });

    it("animating-separation-off with no pending bands → idle", async () => {
      const { deps, resolveAnimation } = makeDepsWithAnimationControl();
      const actor = await reachSeparationActive(deps, resolveAnimation);

      actor.send({ type: "SEPARATION_TOGGLED", enable: false });
      resolveAnimation();
      await flushPromises();

      expect(actor.getSnapshot().value).toBe("idle");
      actor.stop();
    });

    it("animating-separation-off with pending bands → animating-band-on", async () => {
      const { deps, resolveAnimation } = makeDepsWithAnimationControl();
      const actor = await reachSeparationActive(deps, resolveAnimation);

      // Queue a band while separated
      actor.send({ type: "BAND_TOGGLED", id: "thrust", enable: true });
      expect(actor.getSnapshot().context.pendingBands).toEqual(["thrust"]);

      actor.send({ type: "SEPARATION_TOGGLED", enable: false });
      resolveAnimation();
      await flushPromises();

      expect(actor.getSnapshot().value).toBe("animating-band-on");
      actor.stop();
    });
  });
});
