// Definitions for Gemini AI Function Calling (Tools)
// These tools allow the AI agent to interact with the Excalidraw canvas.

// The structure of the Gemini Function Calling parameters
export const canvasTools = [
    {
        name: "get_canvas",
        description: "Get all elements currently on the Excalidraw canvas. Read this to 'see' what's on the board.",
        parameters: {
            type: "object",
            properties: {},
            required: [],
        },
    },
    {
        name: "add_elements",
        description: "Add new Excalidraw elements to the canvas.",
        parameters: {
            type: "object",
            properties: {
                elements: {
                    type: "array",
                    description: "Array of Excalidraw elements to add",
                    items: {
                        type: "object",
                        properties: {
                            type: { type: "string", enum: ["rectangle", "ellipse", "diamond", "line", "arrow", "text", "freedraw"] },
                            x: { type: "number", description: "X position" },
                            y: { type: "number", description: "Y position" },
                            width: { type: "number", description: "Width (not needed for text/freedraw)" },
                            height: { type: "number", description: "Height (not needed for text/freedraw)" },
                            text: { type: "string", description: "Text content (for text elements)" },
                            strokeColor: { type: "string", description: "Stroke color, e.g. '#000000'" },
                            backgroundColor: { type: "string", description: "Fill color, e.g. '#ffffff'" },
                            fontSize: { type: "number", description: "Font size (for text elements)" }
                        },
                        required: ["type", "x", "y"]
                    }
                }
            },
            required: ["elements"]
        }
    },
    {
        name: "update_element",
        description: "Update properties of an existing element on the canvas by its ID.",
        parameters: {
            type: "object",
            properties: {
                elementId: { type: "string", description: "The ID of the element to update" },
                updates: {
                    type: "object",
                    description: "Properties to update",
                    properties: {
                        x: { type: "number" },
                        y: { type: "number" },
                        width: { type: "number" },
                        height: { type: "number" },
                        text: { type: "string" },
                        strokeColor: { type: "string" },
                        backgroundColor: { type: "string" }
                    }
                }
            },
            required: ["elementId", "updates"]
        }
    },
    {
        name: "clear_canvas",
        description: "Remove all elements from the Excalidraw canvas.",
        parameters: {
            type: "object",
            properties: {},
            required: []
        }
    }
];

// Define interfaces for TypeScript
export interface ExcalidrawElement {
    id: string;
    type: string;
    x: number;
    y: number;
    width?: number;
    height?: number;
    angle?: number;
    strokeColor?: string;
    backgroundColor?: string;
    fillStyle?: string;
    strokeWidth?: number;
    roughness?: number;
    opacity?: number;
    groupIds?: string[];
    version: number;
    versionNonce?: number;
    isDeleted?: boolean;
    updated?: number;
    text?: string;
    fontSize?: number;
    fontFamily?: number;
    textAlign?: string;
    verticalAlign?: string;
}

export interface ExcalidrawAPI {
    getSceneElements: () => ExcalidrawElement[];
    updateScene: (params: { elements: ExcalidrawElement[] }) => void;
}

/**
 * Handles the actual execution of the tool calls by the AI agent.
 * You can hook this up to your Gemini response handler in App.jsx.
 */
export const executeCanvasTool = (toolName: string, toolArgs: any, excalidrawApi: ExcalidrawAPI) => {
    if (!excalidrawApi) return { error: "Canvas API not available" };

    const state = excalidrawApi.getSceneElements();

    switch (toolName) {
        case "get_canvas":
            return { elements: state };

        case "add_elements": {
            const { elements } = toolArgs;
            // Map simplified elements to Excalidraw format
            const excalidrawElements: ExcalidrawElement[] = elements.map((el: any, i: number) => ({
                id: `ai_generated_${Date.now()}_${i}`,
                type: el.type,
                x: el.x,
                y: el.y,
                width: el.width || (el.type === 'text' ? 100 : 200),
                height: el.height || (el.type === 'text' ? 25 : 200),
                angle: 0,
                strokeColor: el.strokeColor || '#000000',
                backgroundColor: el.backgroundColor || 'transparent',
                fillStyle: 'solid',
                strokeWidth: 2,
                roughness: 1,
                opacity: 100,
                groupIds: [],
                version: 1,
                versionNonce: Math.floor(Math.random() * 1000000),
                isDeleted: false,
                updated: Date.now(),
                ...(el.type === 'text' ? {
                    text: el.text || '',
                    fontSize: el.fontSize || 20,
                    fontFamily: 1,
                    textAlign: 'left',
                    verticalAlign: 'top',
                } : {}),
            }));
            excalidrawApi.updateScene({ elements: [...state, ...excalidrawElements] });
            return { success: true, addedCount: excalidrawElements.length };
        }

        case "update_element": {
            const { elementId, updates } = toolArgs;
            const updatedElements = state.map((el: ExcalidrawElement) =>
                el.id === elementId ? { ...el, ...updates, version: el.version + 1 } : el
            );
            excalidrawApi.updateScene({ elements: updatedElements });
            return { success: true, updatedElementId: elementId };
        }

        case "clear_canvas":
            excalidrawApi.updateScene({ elements: [] });
            return { success: true, cleared: true };

        default:
            return { error: `Unknown tool: ${toolName}` };
    }
};
