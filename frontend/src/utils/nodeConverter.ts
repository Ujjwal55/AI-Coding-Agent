import { Node } from "@xyflow/react";

export function nodeToJSON(node: Node) {
    return {
        id: node.id,
        type: node.data.nodeType,
        label: node.data.label,
        position: node.position,
        // Preserve Inspector settings (model, instructions, maxRetries, maxPlanRevisions).
        data: node.data,
    };
}

export function jsonToNode(json: any): Node {
    return {
        id: json.id,
        type: "custom",
        position: json.position,
        data: {
            // Spread first so model / instructions / retry settings come along.
            ...json.data,
            label: json.label,
            nodeType: json.type,
        },
    };
}