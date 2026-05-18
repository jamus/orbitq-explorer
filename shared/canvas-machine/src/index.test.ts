import { describe, it, expect, vi } from "vitest";
import { createActor, waitFor } from "xstate";
import { createCanvasMachine } from "./index";
import type { CanvasMachineDeps } from "./index";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const rocketA = { id: "falcon9", length: 70, toThrust: 7607 } as never;
const rocketB = { id: "starship", length: 120, toThrust: 74000 } as never;

function makeDeps(
  overrides: Partial<CanvasMachineDeps> = {},
): CanvasMachineDeps {
  return {
    animate: (_fs, _ts, _fb, _tb, cb) => cb(),
    animatedWorldScale: () => 10,
    animatedBaselineY: () => 500,
    getTargetScale: () => 10,
    getTargetBaseline: () => 500,
    displayRocketA: () => null,
    displayRocketB: () => null,
    setDisplayRockets: vi.fn(),
    showDiagram: vi.fn(),
    hideDiagram: vi.fn(),
    disableEffectNodes: vi.fn(),
    fadeOut: vi.fn(),
    fadeIn: vi.fn(),
    ...overrides,
  };
}

/** Deps whose animate() does not resolve until you call the returned function. */
function makeSuspendedDeps(overrides: Partial<CanvasMachineDeps> = {}) {
  let resume = () => {};
  const deps = makeDeps({
    animate: (_fs, _ts, _fb, _tb, cb) => {
      resume = cb;
    },
    ...overrides,
  });
  return { deps, resume: () => resume() };
}

function start(deps: CanvasMachineDeps) {
  const actor = createActor(createCanvasMachine(deps));
  actor.start();
  return actor;
}

/** Drive the machine to diagram-active for a given diagram id. */
async function reachDiagramActive(deps: CanvasMachineDeps, id = "thrust") {
  const actor = start(deps);
  actor.send({ type: "DIAGRAM_OPTION_CHANGED", id, enable: true });
  await waitFor(actor, (s) => s.value === "diagram-active");
  return actor;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("canvas machine", () => {
  // -------------------------------------------------------------------------
  describe("idle", () => {
    it("starts in idle", () => {
      expect(start(makeDeps()).getSnapshot().value).toBe("idle");
    });

    it("transitions to animating-rockets on ROCKET_SELECTION_CHANGED", () => {
      const actor = start(makeDeps());
      actor.send({ type: "ROCKET_SELECTION_CHANGED", rocketA, rocketB: null });
      expect(actor.getSnapshot().value).toBe("animating-rockets");
    });

    it("transitions to animating-diagram-on on DIAGRAM_OPTION_CHANGED enable", () => {
      const actor = start(makeDeps());
      actor.send({
        type: "DIAGRAM_OPTION_CHANGED",
        id: "thrust",
        enable: true,
      });
      expect(actor.getSnapshot().value).toBe("animating-diagram-on");
    });

    it("sets activeDiagramId from the event", () => {
      const actor = start(makeDeps());
      actor.send({
        type: "DIAGRAM_OPTION_CHANGED",
        id: "thrust",
        enable: true,
      });
      expect(actor.getSnapshot().context.activeDiagramId).toBe("thrust");
    });

    it("ignores DIAGRAM_OPTION_CHANGED disable — nothing to turn off", () => {
      const actor = start(makeDeps());
      actor.send({
        type: "DIAGRAM_OPTION_CHANGED",
        id: "thrust",
        enable: false,
      });
      expect(actor.getSnapshot().value).toBe("idle");
    });
  });

  // -------------------------------------------------------------------------
  describe("animating-rockets", () => {
    it("calls fadeOut on entry", () => {
      const deps = makeDeps();
      const actor = start(deps);
      actor.send({ type: "ROCKET_SELECTION_CHANGED", rocketA, rocketB: null });
      expect(deps.fadeOut).toHaveBeenCalled();
    });

    it("commits rockets and calls fadeIn after animation", async () => {
      const deps = makeDeps();
      const actor = start(deps);
      actor.send({ type: "ROCKET_SELECTION_CHANGED", rocketA, rocketB: null });
      await waitFor(actor, (s) => s.value === "idle");
      expect(deps.setDisplayRockets).toHaveBeenCalledWith(rocketA, null);
      expect(deps.fadeIn).toHaveBeenCalled();
    });

    it("goes to idle when no active diagram", async () => {
      const actor = start(makeDeps());
      actor.send({ type: "ROCKET_SELECTION_CHANGED", rocketA, rocketB: null });
      await waitFor(actor, (s) => s.value === "idle");
      expect(actor.getSnapshot().value).toBe("idle");
    });

    it("returns to diagram-active when a diagram was already active", async () => {
      const deps = makeDeps();
      const actor = await reachDiagramActive(deps, "thrust");
      actor.send({ type: "ROCKET_SELECTION_CHANGED", rocketA, rocketB: null });
      await waitFor(actor, (s) => s.value === "diagram-active");
      expect(actor.getSnapshot().context.activeDiagramId).toBe("thrust");
    });

    it("ignores DIAGRAM_OPTION_CHANGED while animating — panel is locked", () => {
      const { deps, resume: _resume } = makeSuspendedDeps();
      const actor = start(deps);
      actor.send({ type: "ROCKET_SELECTION_CHANGED", rocketA, rocketB: null });
      actor.send({
        type: "DIAGRAM_OPTION_CHANGED",
        id: "thrust",
        enable: true,
      });
      // Event dropped — no activeDiagramId set, still animating
      expect(actor.getSnapshot().value).toBe("animating-rockets");
      expect(actor.getSnapshot().context.activeDiagramId).toBeNull();
    });

    it("re-enters on a second ROCKET_SELECTION_CHANGED replacing pending rockets", () => {
      const { deps, resume: _resume } = makeSuspendedDeps();
      const actor = start(deps);
      actor.send({ type: "ROCKET_SELECTION_CHANGED", rocketA, rocketB: null });
      actor.send({ type: "ROCKET_SELECTION_CHANGED", rocketA: null, rocketB });
      expect(actor.getSnapshot().context.pendingRockets).toEqual({
        a: null,
        b: rocketB,
      });
    });
  });

  // -------------------------------------------------------------------------
  describe("animating-diagram-on", () => {
    it("transitions to diagram-active and calls showDiagram on done", async () => {
      const deps = makeDeps();
      const actor = start(deps);
      actor.send({
        type: "DIAGRAM_OPTION_CHANGED",
        id: "thrust",
        enable: true,
      });
      await waitFor(actor, (s) => s.value === "diagram-active");
      expect(deps.showDiagram).toHaveBeenCalledWith("thrust");
    });

    it("calls disableEffectNodes when activating separation", () => {
      const deps = makeDeps();
      const actor = start(deps);
      actor.send({
        type: "DIAGRAM_OPTION_CHANGED",
        id: "separation",
        enable: true,
      });
      expect(deps.disableEffectNodes).toHaveBeenCalled();
    });

    it("does not call disableEffectNodes for non-separation nodes", () => {
      const deps = makeDeps();
      const actor = start(deps);
      actor.send({
        type: "DIAGRAM_OPTION_CHANGED",
        id: "thrust",
        enable: true,
      });
      expect(deps.disableEffectNodes).not.toHaveBeenCalled();
    });

    it("passes separated=true to getTargetScale for separation", async () => {
      const getTargetScale = vi.fn().mockReturnValue(10);
      const deps = makeDeps({ getTargetScale });
      const actor = start(deps);
      actor.send({
        type: "DIAGRAM_OPTION_CHANGED",
        id: "separation",
        enable: true,
      });
      await waitFor(actor, (s) => s.value === "diagram-active");
      expect(getTargetScale).toHaveBeenCalledWith(expect.anything(), true);
    });

    it("passes separated=false to getTargetScale for non-separation nodes", async () => {
      const getTargetScale = vi.fn().mockReturnValue(10);
      const deps = makeDeps({ getTargetScale });
      const actor = start(deps);
      actor.send({
        type: "DIAGRAM_OPTION_CHANGED",
        id: "thrust",
        enable: true,
      });
      await waitFor(actor, (s) => s.value === "diagram-active");
      expect(getTargetScale).toHaveBeenCalledWith(expect.anything(), false);
    });

    it("ignores DIAGRAM_OPTION_CHANGED while animating — panel is locked", () => {
      const { deps, resume: _resume } = makeSuspendedDeps();
      const actor = start(deps);
      actor.send({
        type: "DIAGRAM_OPTION_CHANGED",
        id: "thrust",
        enable: true,
      });
      actor.send({
        type: "DIAGRAM_OPTION_CHANGED",
        id: "thrust",
        enable: false,
      });
      // Still animating on, event dropped
      expect(actor.getSnapshot().value).toBe("animating-diagram-on");
    });

    it("interrupts to animating-rockets on ROCKET_SELECTION_CHANGED", () => {
      const { deps, resume: _resume } = makeSuspendedDeps();
      const actor = start(deps);
      actor.send({
        type: "DIAGRAM_OPTION_CHANGED",
        id: "thrust",
        enable: true,
      });
      actor.send({ type: "ROCKET_SELECTION_CHANGED", rocketA, rocketB: null });
      expect(actor.getSnapshot().value).toBe("animating-rockets");
    });
  });

  // -------------------------------------------------------------------------
  describe("diagram-active", () => {
    it("turns off on DIAGRAM_OPTION_CHANGED(off, same id)", async () => {
      const deps = makeDeps();
      const actor = await reachDiagramActive(deps, "thrust");
      actor.send({
        type: "DIAGRAM_OPTION_CHANGED",
        id: "thrust",
        enable: false,
      });
      expect(actor.getSnapshot().value).toBe("animating-diagram-off");
      expect(deps.hideDiagram).toHaveBeenCalledWith("thrust");
    });

    it("ignores DIAGRAM_OPTION_CHANGED(off) for a different id", async () => {
      const actor = await reachDiagramActive(makeDeps(), "thrust");
      actor.send({
        type: "DIAGRAM_OPTION_CHANGED",
        id: "separation",
        enable: false,
      });
      expect(actor.getSnapshot().value).toBe("diagram-active");
    });

    it("switches diagram on DIAGRAM_OPTION_CHANGED(on, different id)", async () => {
      const deps = makeDeps();
      const actor = await reachDiagramActive(deps, "thrust");
      actor.send({
        type: "DIAGRAM_OPTION_CHANGED",
        id: "separation",
        enable: true,
      });
      expect(actor.getSnapshot().value).toBe("animating-diagram-on");
      expect(actor.getSnapshot().context.activeDiagramId).toBe("separation");
      expect(deps.hideDiagram).toHaveBeenCalledWith("thrust");
    });

    it("preserves activeDiagramId through a rocket change", async () => {
      const deps = makeDeps();
      const actor = await reachDiagramActive(deps, "thrust");
      actor.send({ type: "ROCKET_SELECTION_CHANGED", rocketA, rocketB: null });
      await waitFor(actor, (s) => s.value === "diagram-active");
      expect(actor.getSnapshot().context.activeDiagramId).toBe("thrust");
    });
  });

  // -------------------------------------------------------------------------
  describe("animating-diagram-off", () => {
    /** Reach animating-diagram-off with the off animation suspended. */
    async function reachDiagramOff() {
      let callCount = 0;
      let resume = () => {};
      const deps = makeDeps({
        animate: (_fs, _ts, _fb, _tb, cb) => {
          callCount++;
          if (callCount === 1) cb();
          else resume = cb;
        },
      });
      const actor = start(deps);
      actor.send({
        type: "DIAGRAM_OPTION_CHANGED",
        id: "thrust",
        enable: true,
      });
      await waitFor(actor, (s) => s.value === "diagram-active");
      actor.send({
        type: "DIAGRAM_OPTION_CHANGED",
        id: "thrust",
        enable: false,
      });
      return { actor, deps, resume: () => resume() };
    }

    it("enters animating-diagram-off state", async () => {
      const { actor } = await reachDiagramOff();
      expect(actor.getSnapshot().value).toBe("animating-diagram-off");
    });

    it("goes to idle and clears activeDiagramId on done", async () => {
      const actor = await reachDiagramActive(makeDeps(), "thrust");
      actor.send({
        type: "DIAGRAM_OPTION_CHANGED",
        id: "thrust",
        enable: false,
      });
      await waitFor(actor, (s) => s.value === "idle");
      expect(actor.getSnapshot().context.activeDiagramId).toBeNull();
    });

    it("ignores DIAGRAM_OPTION_CHANGED while animating — panel is locked", async () => {
      const { actor } = await reachDiagramOff();
      actor.send({
        type: "DIAGRAM_OPTION_CHANGED",
        id: "separation",
        enable: true,
      });
      expect(actor.getSnapshot().value).toBe("animating-diagram-off");
    });

    it("passes separated=false to getTargetScale — always animates to default scale", async () => {
      const getTargetScale = vi.fn().mockReturnValue(10);
      const actor = await reachDiagramActive(
        makeDeps({ getTargetScale }),
        "thrust",
      );
      getTargetScale.mockClear();
      actor.send({
        type: "DIAGRAM_OPTION_CHANGED",
        id: "thrust",
        enable: false,
      });
      await waitFor(actor, (s) => s.value === "idle");
      expect(getTargetScale).toHaveBeenCalledWith(expect.anything(), false);
    });
  });
});
