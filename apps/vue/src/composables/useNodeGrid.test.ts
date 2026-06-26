import { describe, it, expect } from "vitest";
import { useNodeGrid, NODE_COLUMN_WIDTH } from "./useNodeGrid";

describe("useNodeGrid", () => {
  // -------------------------------------------------------------------------
  describe("initial state", () => {
    it("all nodes start inactive in nodeList", () => {
      const { nodeList } = useNodeGrid();
      expect(nodeList.value.every((n) => !n.active)).toBe(true);
    });

    it("thrustEnabled and thrustRenderVisible start false", () => {
      const { thrustEnabled, thrustRenderVisible } = useNodeGrid();
      expect(thrustEnabled.value).toBe(false);
      expect(thrustRenderVisible.value).toBe(false);
    });

    it("column widths start at 0", () => {
      const { columnAWidth, columnBWidth } = useNodeGrid();
      expect(columnAWidth.value).toBe(0);
      expect(columnBWidth.value).toBe(0);
    });

    it("column node lists start empty", () => {
      const { columnANodes, columnBNodes } = useNodeGrid();
      expect(columnANodes.value).toHaveLength(0);
      expect(columnBNodes.value).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  describe("isDiagramNode", () => {
    it("thrust is a diagram node", () => {
      const { isDiagramNode } = useNodeGrid();
      expect(isDiagramNode("thrust")).toBe(true);
    });

    it("overview is not a diagram node", () => {
      const { isDiagramNode } = useNodeGrid();
      expect(isDiagramNode("overview")).toBe(false);
    });

    it("stages is a diagram node", () => {
      const { isDiagramNode } = useNodeGrid();
      expect(isDiagramNode("stages")).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  describe("thrust (diagram node)", () => {
    it("enableNode sets thrustEnabled but not thrustRenderVisible", () => {
      const { enableNode, thrustEnabled, thrustRenderVisible } = useNodeGrid();
      enableNode("thrust");
      expect(thrustEnabled.value).toBe(true);
      expect(thrustRenderVisible.value).toBe(false);
    });

    it("showNode makes thrustRenderVisible true without changing thrustEnabled", () => {
      const { enableNode, showNode, thrustEnabled, thrustRenderVisible } =
        useNodeGrid();
      enableNode("thrust");
      showNode("thrust");
      expect(thrustEnabled.value).toBe(true);
      expect(thrustRenderVisible.value).toBe(true);
    });

    it("hideNode clears thrustRenderVisible while keeping thrustEnabled", () => {
      const {
        enableNode,
        showNode,
        hideNode,
        thrustEnabled,
        thrustRenderVisible,
      } = useNodeGrid();
      enableNode("thrust");
      showNode("thrust");
      hideNode("thrust");
      expect(thrustEnabled.value).toBe(true);
      expect(thrustRenderVisible.value).toBe(false);
    });

    it("disableNode clears both thrustEnabled and thrustRenderVisible", () => {
      const {
        enableNode,
        showNode,
        disableNode,
        thrustEnabled,
        thrustRenderVisible,
      } = useNodeGrid();
      enableNode("thrust");
      showNode("thrust");
      disableNode("thrust");
      expect(thrustEnabled.value).toBe(false);
      expect(thrustRenderVisible.value).toBe(false);
    });

    it("showNode without enableNode still sets thrustRenderVisible", () => {
      // Machine can call showDiagram independently of enableNode
      const { showNode, thrustRenderVisible } = useNodeGrid();
      showNode("thrust");
      expect(thrustRenderVisible.value).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  describe("overview (data node)", () => {
    it("enableNode sets both isEnabled and isVisible immediately", () => {
      const { enableNode, nodeList } = useNodeGrid();
      enableNode("overview");
      const node = nodeList.value.find((n) => n.typeId === "overview");
      expect(node?.active).toBe(true);
    });

    it("disableNode clears the node", () => {
      const { enableNode, disableNode, nodeList } = useNodeGrid();
      enableNode("overview");
      disableNode("overview");
      const node = nodeList.value.find((n) => n.typeId === "overview");
      expect(node?.active).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  describe("stages (diagram node)", () => {
    it("enableNode adds stages to both column lists", () => {
      const { enableNode, columnANodes, columnBNodes } = useNodeGrid();
      enableNode("stages");
      expect(columnANodes.value.some((n) => n.typeId === "stages")).toBe(true);
      expect(columnBNodes.value.some((n) => n.typeId === "stages")).toBe(true);
    });

    it("disableNode removes stages from column lists", () => {
      const { enableNode, disableNode, columnANodes } = useNodeGrid();
      enableNode("stages");
      disableNode("stages");
      expect(columnANodes.value.some((n) => n.typeId === "stages")).toBe(false);
    });

    it("enableNode does not set isVisible — machine calls showNode when animation completes", () => {
      const { enableNode, showNode, nodeList } = useNodeGrid();
      enableNode("stages");
      // active (isEnabled) is true; isVisible is still false until machine calls showNode
      expect(nodeList.value.find((n) => n.typeId === "stages")?.active).toBe(
        true,
      );
      showNode("stages");
      // showNode sets isVisible — this is the machine's responsibility
      expect(nodeList.value.find((n) => n.typeId === "stages")?.active).toBe(
        true,
      );
    });
  });

  // -------------------------------------------------------------------------
  describe("nodeList", () => {
    it("contains all registered nodes", () => {
      const { nodeList } = useNodeGrid();
      expect(nodeList.value.map((n) => n.typeId).sort()).toEqual([
        "engine_stage_01",
        "engine_stage_02",
        "overview",
        "stages",
        "thrust",
      ]);
    });

    it("thrust has affectsDiagram true", () => {
      const { nodeList } = useNodeGrid();
      const node = nodeList.value.find((n) => n.typeId === "thrust");
      expect(node?.affectsDiagram).toBe(true);
    });

    it("overview has affectsDiagram false", () => {
      const { nodeList } = useNodeGrid();
      const node = nodeList.value.find((n) => n.typeId === "overview");
      expect(node?.affectsDiagram).toBe(false);
    });

    it("stages has affectsDiagram true", () => {
      const { nodeList } = useNodeGrid();
      const node = nodeList.value.find((n) => n.typeId === "stages");
      expect(node?.affectsDiagram).toBe(true);
    });

    it("active flag updates reactively after enableNode", () => {
      const { enableNode, nodeList } = useNodeGrid();
      enableNode("thrust");
      expect(nodeList.value.find((n) => n.typeId === "thrust")?.active).toBe(
        true,
      );
    });

    it("node labels are correct", () => {
      const { nodeList } = useNodeGrid();
      const labels = Object.fromEntries(
        nodeList.value.map((n) => [n.typeId, n.label]),
      );
      expect(labels["thrust"]).toBe("Thrust");
      expect(labels["overview"]).toBe("Overview");
      expect(labels["stages"]).toBe("Stages");
    });
  });

  // -------------------------------------------------------------------------
  describe("column nodes and widths", () => {
    it("thrust (owner: both) appears in both columns when enabled", () => {
      const { enableNode, columnANodes, columnBNodes } = useNodeGrid();
      enableNode("thrust");
      expect(columnANodes.value.some((n) => n.typeId === "thrust")).toBe(true);
      expect(columnBNodes.value.some((n) => n.typeId === "thrust")).toBe(true);
    });

    it("columnAWidth equals NODE_COLUMN_WIDTH when a node is enabled", () => {
      const { enableNode, columnAWidth } = useNodeGrid();
      enableNode("thrust");
      expect(columnAWidth.value).toBe(NODE_COLUMN_WIDTH);
    });

    it("columnBWidth equals NODE_COLUMN_WIDTH when a node is enabled", () => {
      const { enableNode, columnBWidth } = useNodeGrid();
      enableNode("overview");
      expect(columnBWidth.value).toBe(NODE_COLUMN_WIDTH);
    });

    it("columnAWidth drops to 0 after all nodes disabled", () => {
      const { enableNode, disableNode, columnAWidth } = useNodeGrid();
      enableNode("thrust");
      disableNode("thrust");
      expect(columnAWidth.value).toBe(0);
    });

    it("all three enabled nodes appear in both columns (all are owner: both)", () => {
      const { enableNode, columnANodes, columnBNodes } = useNodeGrid();
      enableNode("thrust");
      enableNode("overview");
      enableNode("stages");
      expect(columnANodes.value).toHaveLength(3);
      expect(columnBNodes.value).toHaveLength(3);
    });

    it("orders overview first and thrust last in node-card columns", () => {
      const { enableNode, columnANodes } = useNodeGrid();
      enableNode("thrust");
      enableNode("overview");
      enableNode("stages");
      enableNode("engine_stage_01");
      enableNode("engine_stage_02");

      expect(columnANodes.value.map((n) => n.typeId)).toEqual([
        "overview",
        "stages",
        "engine_stage_02",
        "engine_stage_01",
        "thrust",
      ]);
    });

    it("column list shrinks after disabling one node", () => {
      const { enableNode, disableNode, columnANodes } = useNodeGrid();
      enableNode("thrust");
      enableNode("overview");
      disableNode("thrust");
      expect(columnANodes.value).toHaveLength(1);
      expect(columnANodes.value[0].typeId).toBe("overview");
    });
  });
});
