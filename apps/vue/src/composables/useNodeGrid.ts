import { reactive, computed } from "vue";

export type NodeOwner = "a" | "b" | "shared";
export type NodeTypeId = "thrust" | "separation" | "overview";

type NodeTypeDef = {
  label: string;
  owner: "a" | "b" | "both";
  affectsDiagram: boolean;
  // isMode: true means this node drives a diagram mode (e.g. separation).
  // disableAllDiagramNodes() skips mode nodes so separation is not
  // inadvertently disabled when the machine enters separation-on.
  isMode: boolean;
};

const NODE_REGISTRY: Record<NodeTypeId, NodeTypeDef> = {
  thrust: {
    label: "Thrust",
    owner: "both",
    affectsDiagram: true,
    isMode: false,
  },
  separation: {
    label: "Stage Separation",
    owner: "both",
    affectsDiagram: true,
    isMode: true,
  },
  overview: {
    label: "Overview",
    owner: "both",
    affectsDiagram: false,
    isMode: false,
  },
};

export const NODE_COLUMN_WIDTH = 260;

export function useNodeGrid() {
  // enabled: drives CSS column open/close; worldscale for effect nodes.
  const enabled = reactive<Record<NodeTypeId, boolean>>({
    thrust: false,
    separation: false,
    overview: false,
  });

  // visible: drives actual diagram rendering (plume, etc.).
  // For diagram nodes this is controlled by the state machine.
  // For non-diagram nodes visible === enabled.
  const visible = reactive<Record<NodeTypeId, boolean>>({
    thrust: false,
    separation: false,
    overview: false,
  });

  function isDiagramNode(id: NodeTypeId): boolean {
    return NODE_REGISTRY[id].affectsDiagram;
  }

  function enableNode(id: NodeTypeId) {
    enabled[id] = true;
    if (!NODE_REGISTRY[id].affectsDiagram) visible[id] = true;
  }

  function disableNode(id: NodeTypeId) {
    enabled[id] = false;
    visible[id] = false;
  }

  function showNode(id: NodeTypeId) {
    visible[id] = true;
  }

  function hideNode(id: NodeTypeId) {
    visible[id] = false;
  }

  // Disables effect (non-mode) diagram nodes — called when entering separation mode.
  // Mode nodes (separation) are intentionally left untouched.
  function disableAllDiagramNodes() {
    for (const id of Object.keys(NODE_REGISTRY) as NodeTypeId[]) {
      if (NODE_REGISTRY[id].affectsDiagram && !NODE_REGISTRY[id].isMode)
        disableNode(id);
    }
  }

  const nodeList = computed(() =>
    (Object.keys(NODE_REGISTRY) as NodeTypeId[]).map((id) => ({
      id,
      label: NODE_REGISTRY[id].label,
      active: enabled[id],
      affectsDiagram: NODE_REGISTRY[id].affectsDiagram,
    })),
  );

  function nodesForSide(side: "a" | "b") {
    return computed(() =>
      (Object.keys(NODE_REGISTRY) as NodeTypeId[])
        .filter(
          (id) =>
            enabled[id] &&
            (NODE_REGISTRY[id].owner === side ||
              NODE_REGISTRY[id].owner === "both"),
        )
        .map((id) => ({
          id,
          label: NODE_REGISTRY[id].label,
          owner: side as NodeOwner,
          affectsDiagram: NODE_REGISTRY[id].affectsDiagram,
        })),
    );
  }

  const columnANodes = nodesForSide("a");
  const columnBNodes = nodesForSide("b");

  const columnAWidth = computed(() =>
    columnANodes.value.length > 0 ? NODE_COLUMN_WIDTH : 0,
  );
  const columnBWidth = computed(() =>
    columnBNodes.value.length > 0 ? NODE_COLUMN_WIDTH : 0,
  );

  const thrustEnabled = computed(() => enabled.thrust);
  const thrustRenderVisible = computed(() => visible.thrust);

  // True when any non-mode diagram node is enabled (i.e. effect nodes like thrust).
  // Used to detect conflicts before activating separation.
  const hasEffectNodesEnabled = computed(() =>
    (Object.keys(NODE_REGISTRY) as NodeTypeId[]).some(
      (id) =>
        NODE_REGISTRY[id].affectsDiagram &&
        !NODE_REGISTRY[id].isMode &&
        enabled[id],
    ),
  );

  return {
    isDiagramNode,
    enableNode,
    disableNode,
    showNode,
    hideNode,
    disableAllDiagramNodes,
    nodeList,
    columnANodes,
    columnBNodes,
    columnAWidth,
    columnBWidth,
    thrustEnabled,
    thrustRenderVisible,
    hasEffectNodesEnabled,
  };
}
