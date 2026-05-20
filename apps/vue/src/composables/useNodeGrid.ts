import { reactive, computed } from "vue";

export type NodeOwner = "a" | "b" | "shared";
export type NodeTypeId = "thrust" | "overview" | "stages";

type NodeTypeDef = {
  label: string;
  owner: "a" | "b" | "both";
  affectsDiagram: boolean;
};

const NODE_REGISTRY: Record<NodeTypeId, NodeTypeDef> = {
  thrust: { label: "Thrust", owner: "both", affectsDiagram: true },
  overview: { label: "Overview", owner: "both", affectsDiagram: false },
  stages: { label: "Stages", owner: "both", affectsDiagram: false },
};

export const NODE_COLUMN_WIDTH = 260;

export function useNodeGrid() {
  // isEnabled: drives CSS column open/close; worldscale for diagram nodes.
  const isEnabled = reactive<Record<NodeTypeId, boolean>>({
    thrust: false,
    overview: false,
    stages: false,
  });

  // isVisible: drives actual diagram rendering (plume, spread rockets, etc.).
  // For diagram nodes this is controlled by the state machine.
  // For data nodes isVisible === isEnabled.
  const isVisible = reactive<Record<NodeTypeId, boolean>>({
    thrust: false,
    overview: false,
    stages: false,
  });

  function isDiagramNode(id: NodeTypeId): boolean {
    return NODE_REGISTRY[id].affectsDiagram;
  }

  function enableNode(id: NodeTypeId) {
    isEnabled[id] = true;
    if (!NODE_REGISTRY[id].affectsDiagram) isVisible[id] = true;
  }

  function disableNode(id: NodeTypeId) {
    isEnabled[id] = false;
    isVisible[id] = false;
  }

  function showNode(id: NodeTypeId) {
    isVisible[id] = true;
  }

  function hideNode(id: NodeTypeId) {
    isVisible[id] = false;
  }

  const nodeList = computed(() =>
    (Object.keys(NODE_REGISTRY) as NodeTypeId[]).map((id) => ({
      id,
      label: NODE_REGISTRY[id].label,
      active: isEnabled[id],
      affectsDiagram: NODE_REGISTRY[id].affectsDiagram,
    })),
  );

  function nodesForSide(side: "a" | "b") {
    return computed(() =>
      (Object.keys(NODE_REGISTRY) as NodeTypeId[])
        .filter(
          (id) =>
            isEnabled[id] &&
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

  const thrustEnabled = computed(() => isEnabled.thrust);
  const thrustRenderVisible = computed(() => isVisible.thrust);

  return {
    isDiagramNode,
    enableNode,
    disableNode,
    showNode,
    hideNode,
    nodeList,
    columnANodes,
    columnBNodes,
    columnAWidth,
    columnBWidth,
    thrustEnabled,
    thrustRenderVisible,
  };
}
