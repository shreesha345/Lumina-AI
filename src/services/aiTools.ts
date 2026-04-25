// Definitions for Gemini AI Function Calling (Tools)
// These tools allow the Gemini Live agent to interact with the Excalidraw canvas.
// The AI generates Excalidraw skeleton JSON, which is auto-converted to full elements.

import { Type } from "@google/genai";
import { convertToExcalidrawElements } from "@excalidraw/excalidraw";

// ─── Interfaces ───

export interface ExcalidrawAPI {
    getSceneElements: () => any[];
    updateScene: (params: { elements: any[] }) => void;
    scrollToContent: (elements?: any[]) => void;
    addFiles: (files: any[]) => void;
}

// ─── Pointer Constants ───

const POINTER_PREFIX = "__pointer_";

// ─── Function Declarations for Gemini Live API ───

export const getCanvasDeclaration = {
    name: "get_canvas",
    description: "Returns all elements currently on the canvas as JSON.",
    parameters: {
        type: Type.OBJECT,
        properties: {},
        required: [],
    },
};

export const updateSceneDeclaration = {
    name: "update_scene",
    description: "Draw on the canvas. Set elements_json to a JSON array string of elements. Set clear_first to 'yes' to wipe canvas before drawing. Set to 'pointer' with pointer_x,pointer_y to show a laser pointer. Set to 'clear_pointer' to remove pointer. Set to 'clear_all' to clear canvas.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            clear_first: {
                type: Type.STRING,
                description: "'yes' to clear canvas, 'no' to append, 'pointer' to move pointer, 'clear_pointer' to remove pointer, 'clear_all' to clear everything.",
            },
            elements_json: {
                type: Type.STRING,
                description: 'JSON array string of elements to draw. Each needs type,x,y. Shapes need labelText. Example: [{"type":"rectangle","id":"a","x":100,"y":100,"width":200,"height":80,"labelText":"My Box","backgroundColor":"#a5d8ff"}]',
            },
            pointer_x: {
                type: Type.STRING,
                description: "X coordinate for pointer as string number",
            },
            pointer_y: {
                type: Type.STRING,
                description: "Y coordinate for pointer as string number",
            },
            pointer_label: {
                type: Type.STRING,
                description: "Label for the pointer",
            },
        },
        required: ["clear_first"],
    },
};

// ─── All tool declarations bundled for the Live API config ───
export const canvasToolDeclarations = [
    getCanvasDeclaration,
    updateSceneDeclaration,
];

function toExcalidrawSkeleton(elements: any[]): any[] {
    // ── Pass 1: Build a position map for all shapes (for startId/endId auto-routing) ──
    const posMap = new Map<string, { x: number; y: number; w: number; h: number }>();
    for (const el of elements) {
        if (el.id && ["rectangle", "ellipse", "diamond"].includes(el.type)) {
            posMap.set(el.id, {
                x: el.x ?? 0,
                y: el.y ?? 0,
                w: el.width || 200,
                h: el.height || 80,
            });
        }
    }

    // ── Pass 2: Convert each element to Excalidraw skeleton ──
    return elements.map((el) => {
        const skeleton: any = {
            type: el.type,
            x: el.x ?? 0,
            y: el.y ?? 0,
        };

        if (el.id) skeleton.id = el.id;

        // Dimensions
        if (el.width != null) skeleton.width = el.width;
        if (el.height != null) skeleton.height = el.height;

        // ── Pass through all native Excalidraw styling properties ──
        if (el.strokeColor) skeleton.strokeColor = el.strokeColor;
        if (el.backgroundColor) {
            skeleton.backgroundColor = el.backgroundColor;
            if (el.backgroundColor !== "transparent") {
                skeleton.fillStyle = el.fillStyle || "solid";
            }
        }
        if (el.fillStyle) skeleton.fillStyle = el.fillStyle;
        if (el.roundness !== undefined) skeleton.roundness = el.roundness;
        if (el.strokeStyle) skeleton.strokeStyle = el.strokeStyle;
        if (el.opacity != null) skeleton.opacity = el.opacity;
        if (el.strokeWidth != null) skeleton.strokeWidth = el.strokeWidth;
        if (el.roughness != null) skeleton.roughness = el.roughness;

        // Defaults
        if (skeleton.strokeWidth == null) skeleton.strokeWidth = 2;
        if (skeleton.roughness == null) skeleton.roughness = 1;

        // ── Shapes: rectangle, ellipse, diamond ──
        if (["rectangle", "ellipse", "diamond"].includes(el.type)) {
            // Handle label — support both {label: {text}} and {labelText} formats
            if (el.label && typeof el.label === "object") {
                skeleton.label = el.label;
            } else {
                const labelText = el.labelText || el.text || (typeof el.label === "string" ? el.label : null);
                if (labelText) {
                    skeleton.label = {
                        text: labelText,
                        fontSize: el.fontSize || el.label?.fontSize || 18,
                        textAlign: "center",
                        verticalAlign: "middle",
                    };
                }
            }
            if (!skeleton.width) skeleton.width = 200;
            if (!skeleton.height) skeleton.height = 80;
        }

        // ── Text elements ──
        if (el.type === "text") {
            skeleton.text = el.text || el.labelText || "";
            if (el.fontSize) skeleton.fontSize = el.fontSize;
        }

        // ── Arrows and lines ──
        if (el.type === "arrow" || el.type === "line") {
            // Pass through arrow-specific properties
            if (el.endArrowhead !== undefined) skeleton.endArrowhead = el.endArrowhead;
            else if (el.type === "arrow") skeleton.endArrowhead = "arrow";

            if (el.startArrowhead !== undefined) skeleton.startArrowhead = el.startArrowhead;
            if (el.startBinding) skeleton.startBinding = el.startBinding;
            if (el.endBinding) skeleton.endBinding = el.endBinding;

            // Arrow label
            if (el.label && typeof el.label === "object") {
                skeleton.label = el.label;
            } else {
                const arrowLabel = el.labelText || (el.type === "arrow" && typeof el.text === "string" ? el.text : null);
                if (arrowLabel) skeleton.label = { text: arrowLabel };
            }

            // ── Determine points ──
            if (el.points) {
                // Explicit points — use directly
                skeleton.points = el.points;
            } else if (el.startId || el.endId) {
                // Auto-route from startId/endId shape positions
                const src = el.startId ? posMap.get(el.startId) : null;
                const dst = el.endId ? posMap.get(el.endId) : null;

                if (src && dst) {
                    const srcCx = src.x + src.w / 2;
                    const srcBot = src.y + src.h;
                    const dstCx = dst.x + dst.w / 2;
                    const dstTop = dst.y;
                    skeleton.x = srcCx;
                    skeleton.y = srcBot;
                    skeleton.points = [[0, 0], [dstCx - srcCx, dstTop - srcBot]];
                } else if (src) {
                    skeleton.x = src.x + src.w / 2;
                    skeleton.y = src.y + src.h;
                    skeleton.points = [[0, 0], [0, el.height || 100]];
                } else if (dst) {
                    skeleton.points = [[0, 0], [
                        (dst.x + dst.w / 2) - (el.x ?? 0),
                        dst.y - (el.y ?? 0)
                    ]];
                } else {
                    skeleton.points = [[0, 0], [0, el.height || 100]];
                }
            } else {
                // Default: use width/height as direction
                skeleton.points = [[0, 0], [el.width || 200, el.height || 0]];
            }
        }

        return skeleton;
    });
}

// ─── Pointer Elements ───

function pointerBase() {
    return {
        angle: 0,
        backgroundColor: "transparent",
        fillStyle: "solid",
        strokeWidth: 2,
        roughness: 0,
        opacity: 100,
        isDeleted: false,
        version: 1,
        versionNonce: Math.floor(Math.random() * 2147483647),
        updated: Date.now(),
        boundElements: null,
        link: null,
        locked: false,
    };
}

function createPointerElements(x: number, y: number, label?: string): any[] {
    const elements: any[] = [];
    const groupId = POINTER_PREFIX + "group";

    // Pointer diamond
    const ringSize = 24;
    elements.push({
        ...pointerBase(),
        id: POINTER_PREFIX + "ring",
        type: "diamond",
        x: x - ringSize / 2,
        y: y - 80 - ringSize / 2,
        width: ringSize,
        height: ringSize,
        strokeColor: "#e03131",
        backgroundColor: "#ff6b6b",
        fillStyle: "solid",
        strokeWidth: 3,
        groupIds: [groupId],
        roundness: null,
    });

    // Arrow pointing down
    elements.push({
        ...pointerBase(),
        id: POINTER_PREFIX + "arrow",
        type: "arrow",
        x: x,
        y: y - 80 + ringSize / 2,
        width: 1,
        height: 50,
        strokeColor: "#e03131",
        backgroundColor: "transparent",
        strokeWidth: 3,
        groupIds: [groupId],
        points: [[0, 0], [0, 50]],
        roundness: { type: 2 },
        startBinding: null,
        endBinding: null,
        startArrowhead: null,
        endArrowhead: "arrow",
        lastCommittedPoint: null,
    });

    // Label
    if (label) {
        const textWidth = label.length * 11;
        elements.push({
            ...pointerBase(),
            id: POINTER_PREFIX + "label",
            type: "text",
            x: x - textWidth / 2,
            y: y - 80 - ringSize - 28,
            width: textWidth,
            height: 22,
            strokeColor: "#e03131",
            backgroundColor: "transparent",
            groupIds: [groupId],
            text: `👉 ${label}`,
            originalText: `👉 ${label}`,
            fontSize: 18,
            fontFamily: 2,
            textAlign: "center",
            verticalAlign: "top",
            containerId: null,
            roundness: null,
        });
    }

    return elements;
}

function removePointerElements(elements: any[]): any[] {
    return elements.filter((e: any) => !e.id?.startsWith(POINTER_PREFIX));
}

// ─── Main Tool Execution ───

export async function executeCanvasTool(
    toolName: string,
    toolArgs: any,
    excalidrawApi: ExcalidrawAPI
): Promise<any> {
    if (!excalidrawApi) {
        return { error: "Canvas API not available yet." };
    }

    switch (toolName) {
        case "get_canvas": {
            const elements = excalidrawApi.getSceneElements();
            const simplified = elements
                .filter((e: any) => !e.isDeleted && !e.id?.startsWith(POINTER_PREFIX))
                .map((e: any) => ({
                    id: e.id,
                    type: e.type,
                    x: Math.round(e.x),
                    y: Math.round(e.y),
                    width: Math.round(e.width),
                    height: Math.round(e.height),
                    ...(e.text ? { text: e.text } : {}),
                    ...(e.containerId ? { containerId: e.containerId } : {}),
                    strokeColor: e.strokeColor,
                    backgroundColor: e.backgroundColor,
                }));
            return {
                elementCount: simplified.length,
                elements: simplified,
            };
        }

        case "update_scene": {
            const { elements_json, elements: elementsArray, clear_first, pointer_x, pointer_y, pointer_label } = toolArgs;
            const mode = (clear_first || "no").toLowerCase().trim();

            // ── Mode: clear_all — wipe everything
            if (mode === "clear_all" || mode === "clear") {
                excalidrawApi.updateScene({ elements: [] });
                return { success: true, message: "Canvas cleared." };
            }

            // ── Mode: clear_pointer — remove pointer only
            if (mode === "clear_pointer") {
                const elements = excalidrawApi.getSceneElements();
                const withoutPointer = removePointerElements([...elements]);
                excalidrawApi.updateScene({ elements: withoutPointer });
                return { success: true, message: "Pointer cleared." };
            }

            // ── Mode: pointer — move/show the laser pointer
            if (mode === "pointer") {
                const px = parseFloat(pointer_x);
                const py = parseFloat(pointer_y);
                if (isNaN(px) || isNaN(py)) {
                    return { error: "pointer_x and pointer_y must be valid numbers" };
                }

                const elements = excalidrawApi.getSceneElements();
                const withoutPointer = removePointerElements([...elements]);
                const pointerElements = createPointerElements(px, py, pointer_label);

                excalidrawApi.updateScene({
                    elements: [...withoutPointer, ...pointerElements],
                });

                return {
                    success: true,
                    message: `Pointing at (${px}, ${py})${pointer_label ? ` — "${pointer_label}"` : ""}`,
                };
            }

            // ── Mode: yes/no — draw elements on canvas
            // Parse elements from JSON string or direct array
            let inputElements: any[];
            try {
                if (elements_json && typeof elements_json === "string") {
                    inputElements = JSON.parse(elements_json);
                } else if (elementsArray && Array.isArray(elementsArray)) {
                    inputElements = elementsArray;
                } else if (elements_json && Array.isArray(elements_json)) {
                    inputElements = elements_json;
                } else {
                    return { error: "No elements provided. Pass elements_json as a JSON string array." };
                }
            } catch (parseErr) {
                console.error("[AI Tools] Failed to parse elements_json:", parseErr);
                return { error: "Invalid JSON in elements_json: " + String(parseErr) };
            }

            if (!Array.isArray(inputElements) || inputElements.length === 0) {
                return { error: "elements must be a non-empty array" };
            }

            // Convert AI's simplified format → Excalidraw skeleton format
            const skeletons = toExcalidrawSkeleton(inputElements);

            console.log("[AI Tools] Converting skeletons to Excalidraw elements:", skeletons);

            // Use Excalidraw's official converter for proper element creation
            // This handles text binding, arrow binding, IDs, versioning, etc.
            let newElements: any[];
            try {
                newElements = convertToExcalidrawElements(skeletons as any, { regenerateIds: false });
            } catch (err) {
                console.error("[AI Tools] convertToExcalidrawElements failed:", err);
                return { error: "Failed to convert elements: " + String(err) };
            }

            console.log("[AI Tools] Converted elements:", newElements);

            // Get current elements (optionally clear first)
            let existingElements: any[] = [];
            if (mode !== "yes") { // "yes" means clear first, so existingElements should be empty
                existingElements = [...excalidrawApi.getSceneElements()];
            }

            excalidrawApi.updateScene({
                elements: [...existingElements, ...newElements],
            });

            // Auto-scroll to see the new content
            try {
                excalidrawApi.scrollToContent();
            } catch (e) { }

            return {
                success: true,
                addedCount: newElements.length,
                message: `Drew ${newElements.length} elements on the canvas.`,
            };
        }

        default:
            return { error: `Unknown tool: ${toolName}` };
    }
}
