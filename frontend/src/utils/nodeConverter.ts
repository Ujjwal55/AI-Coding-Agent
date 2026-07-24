import { Node } from "@xyflow/react";

export function nodeToJSON(node: Node) {
    return {
        id: node.id,
        type: node.data.nodeType,
        label: node.data.label,
        position: node.position,
        // Preserve everything else set in the Node Inspector (model, instructions,
        // maxRetries, command, etc.) so export/import is lossless.
        data: node.data,
    };
}

export function jsonToNode(json: any): Node {
    return {
        id: json.id,
        type: "custom",
        position: json.position,
        data: {
            // Spread first so any extra fields (model, instructions, maxRetries, command...)
            // come along, then set label/nodeType explicitly in case the JSON's top-level
            // `label`/`type` differ from what's nested in `data` (e.g. an older export format).
            ...json.data,
            label: json.label,
            nodeType: json.type,
        },
    };
}
