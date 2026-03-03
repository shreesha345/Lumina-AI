// Definitions for Gemini AI Function Calling (Tools)
// These tools allow the Gemini Live agent to interact with the Excalidraw canvas.
// The AI generates Excalidraw skeleton JSON, which is auto-converted to full elements.

import { Type } from "@google/genai";
import { convertToExcalidrawElements } from "@excalidraw/excalidraw";

// ─── Interfaces ───

export interface ExcalidrawAPI {
    getSceneElements: () => any[];
    getAppState: () => any;
    getFiles: () => any;
    updateScene: (params: { elements: any[] }) => void;
    scrollToContent: (target?: any | any[], opts?: {
        fitToContent?: boolean;
        fitToViewport?: boolean;
        viewportZoomFactor?: number;
        animate?: boolean;
        duration?: number;
    }) => void;
    addFiles: (files: any[]) => void;
}

// ─── Pointer Constants ───

const POINTER_PREFIX = "__pointer_";

// ─── Function Declarations for Gemini Live API (Manager Agent) ───
// The Live agent only has two tools:
// 1. draw_on_canvas — delegates to the Gemini 2.0 Flash tool agent
// 2. view_canvas — captures a snapshot of the canvas

export const drawOnCanvasDeclaration = {
    name: "draw_on_canvas",
    description: "Send a drawing request to the specialized canvas agent (Gemini 2.0 Flash). The agent will generate and execute Excalidraw diagrams, SVG illustrations, flowcharts, creative art, etc. on the canvas. Provide a detailed natural language description of what to draw, including colors, style, and layout. Examples: 'Draw a red heart with pink outline', 'Create a flowchart of user authentication with blue and green boxes', 'Draw a colorful butterfly', 'Illustrate the solar system with labeled planets'.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            request: {
                type: Type.STRING,
                description: "Detailed natural language description of what to draw on the canvas. Be specific about colors, layout, style, and content.",
            },
        },
        required: ["request"],
    },
};

export const viewCanvasDeclaration = {
    name: "view_canvas",
    description: "Capture a visual snapshot of the Excalidraw canvas to see what is currently drawn. Use this when you want to visually inspect the canvas contents — for example, to review a diagram you just drew, see what the student has drawn, or understand the current state of the whiteboard. Returns the canvas as an image you can see.",
    parameters: {
        type: Type.OBJECT,
        properties: {},
        required: [],
    },
};

export const inspectCanvasDeclaration = {
    name: "inspect_canvas",
    description: "Get structured data about all elements currently on the canvas, including their types, positions, dimensions, and colors. Returns element details as JSON. Use this to understand the canvas layout, check if images are present, find positions of elements, or determine where to place new content. Especially useful before drawing to avoid overlapping user-uploaded images or existing content.",
    parameters: {
        type: Type.OBJECT,
        properties: {},
        required: [],
    },
};

export const viewScreenDeclaration = {
    name: "view_screen",
    description: "Capture a visual snapshot of the user's shared screen. Use this when you need to see what the user is looking at outside of the Excalidraw canvas, or when the user explicitly asks you to look at their screen.",
    parameters: {
        type: Type.OBJECT,
        properties: {},
        required: [],
    },
};

// ─── All tool declarations bundled for the Live API config ───
export const canvasToolDeclarations = [
    drawOnCanvasDeclaration,
    viewCanvasDeclaration,
    inspectCanvasDeclaration,
    viewScreenDeclaration,
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
    return elements.map((el, idx) => {
        const skeleton: any = {
            type: el.type,
            x: el.x ?? 0,
            y: el.y ?? 0,
        };

        // Always ensure a unique ID — prevents 'Duplicate id found for undefined'
        skeleton.id = el.id || `el_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 8)}`;

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

        // ── Freedraw elements ──
        if (el.type === "freedraw") {
            skeleton.points = el.points || [[0, 0]];
            if (el.simulatePressure !== undefined) skeleton.simulatePressure = el.simulatePressure;
            if (el.pressures) skeleton.pressures = el.pressures;
        }

        // ── Safety: any element with points that wasn't handled above ──
        if (el.points && !skeleton.points) {
            skeleton.points = el.points;
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
        case "get_canvas":
        case "inspect_canvas": {
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
                    ...(e.type === "image" ? { isImage: true, fileId: e.fileId } : {}),
                }));

            // Compute bounding box of all images for spatial awareness
            const images = simplified.filter((e: any) => e.type === "image");
            let imageBounds = null;
            if (images.length > 0) {
                let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                for (const img of images) {
                    minX = Math.min(minX, img.x);
                    minY = Math.min(minY, img.y);
                    maxX = Math.max(maxX, img.x + img.width);
                    maxY = Math.max(maxY, img.y + img.height);
                }
                imageBounds = {
                    x: minX, y: minY,
                    width: maxX - minX, height: maxY - minY,
                    rightEdge: maxX, bottomEdge: maxY,
                };
            }

            return {
                elementCount: simplified.length,
                imageCount: images.length,
                ...(imageBounds ? { imageBounds } : {}),
                elements: simplified,
                hint: images.length > 0
                    ? `There are ${images.length} image(s) on the canvas. Place new content to the RIGHT of these images (x > ${imageBounds!.rightEdge + 150}) to avoid overlap.`
                    : "Canvas has no images — you can place content anywhere.",
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
            if (mode !== "yes") {
                // "no" mode — append to everything
                existingElements = [...excalidrawApi.getSceneElements()];
            } else {
                // "yes" mode — clear canvas but PRESERVE image elements (user-uploaded content)
                existingElements = excalidrawApi.getSceneElements().filter(
                    (e: any) => e.type === "image" && !e.isDeleted
                );
            }

            // If images were preserved, offset new elements to the RIGHT of images
            // so nothing overlaps — gives a clean side-by-side layout
            const preservedImages = existingElements.filter((e: any) => e.type === "image");
            if (preservedImages.length > 0 && mode === "yes") {
                // Find the rightmost edge of all images
                let maxRight = 0;
                for (const img of preservedImages) {
                    const right = (img.x || 0) + (img.width || 0);
                    if (right > maxRight) maxRight = right;
                }

                // Find the leftmost x of new elements to calculate shift
                let minNewX = Infinity;
                for (const el of inputElements) {
                    if (el.x != null && el.x < minNewX) minNewX = el.x;
                }
                if (!isFinite(minNewX)) minNewX = 0;

                const OFFSET_PADDING = 150; // spacing between image and new content
                const shiftX = maxRight + OFFSET_PADDING - minNewX;

                // Shift all input elements before skeleton conversion
                // (arrows with startId/endId auto-calc from shape positions, so this is safe)
                for (const el of inputElements) {
                    el.x = (el.x || 0) + shiftX;
                }

                // Re-convert after shifting
                const shiftedSkeletons = toExcalidrawSkeleton(inputElements);
                try {
                    newElements = convertToExcalidrawElements(shiftedSkeletons as any, { regenerateIds: false });
                } catch (err) {
                    console.error("[AI Tools] Re-conversion after shift failed:", err);
                    // Fall back to unshifted elements — better than nothing
                }
            }

            excalidrawApi.updateScene({
                elements: [...existingElements, ...newElements],
            });

            // Auto-scroll and zoom to fit all content in the viewport
            try {
                excalidrawApi.scrollToContent(undefined, {
                    fitToViewport: true,
                    viewportZoomFactor: 0.85,
                    animate: true,
                    duration: 300,
                });
            } catch (e) { }

            return {
                success: true,
                addedCount: newElements.length,
                message: `Drew ${newElements.length} elements on the canvas.`,
            };
        }

        case "add_svg": {
            const { svg_code, x: xStr, y: yStr, width: wStr, height: hStr, label } = toolArgs;

            if (!svg_code || typeof svg_code !== "string") {
                return { error: "svg_code is required and must be a non-empty SVG string." };
            }

            // Ensure the SVG has xmlns attribute for proper rendering
            let svgString = svg_code.trim();
            if (!svgString.startsWith("<svg")) {
                return { error: "svg_code must start with an <svg> element." };
            }
            if (!svgString.includes('xmlns')) {
                svgString = svgString.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
            }

            // Parse dimensions from SVG viewBox or width/height attributes
            let svgW = 300, svgH = 300;
            const viewBoxMatch = svgString.match(/viewBox=["']([\d.\-]+)\s+([\d.\-]+)\s+([\d.\-]+)\s+([\d.\-]+)["']/);
            if (viewBoxMatch) {
                svgW = parseFloat(viewBoxMatch[3]);
                svgH = parseFloat(viewBoxMatch[4]);
            } else {
                const wMatch = svgString.match(/width=["'](\d+)/);
                const hMatch = svgString.match(/height=["'](\d+)/);
                if (wMatch) svgW = parseInt(wMatch[1]);
                if (hMatch) svgH = parseInt(hMatch[1]);
            }

            const posX = xStr ? parseFloat(xStr) : 100;
            const posY = yStr ? parseFloat(yStr) : 100;
            const displayW = wStr ? parseFloat(wStr) : svgW;
            const displayH = hStr ? parseFloat(hStr) : svgH;

            // Detect if SVG contains animations (SMIL or CSS)
            const hasAnimation = /<animate\b|<animateTransform\b|<animateMotion\b|<set\b|@keyframes\s|animation\s*:/i.test(svgString);

            // If animated, show as a live overlay so animations actually play
            // and skip embedding the static image on the canvas
            if (hasAnimation) {
                window.dispatchEvent(new CustomEvent('svg-animation-overlay', {
                    detail: { svgHtml: svgString, label },
                }));
                console.log("[AI Tools] Animated SVG detected — rendering as live overlay only");
                return {
                    success: true,
                    message: `Animated SVG shown as live overlay${label ? ` with label "${label}"` : ""}. The user can drag it anywhere and close it when done.`,
                };
            }

            // Convert SVG to base64 data URL
            const encoded = unescape(encodeURIComponent(svgString));
            const base64 = btoa(encoded);
            const dataURL = `data:image/svg+xml;base64,${base64}`;

            // Generate a unique file ID
            const fileId = `svg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

            // Register the SVG file with Excalidraw
            excalidrawApi.addFiles([{
                id: fileId as any,
                mimeType: "image/svg+xml" as any,
                dataURL: dataURL as any,
                created: Date.now(),
            }]);

            // Create the image element
            const imageElement: any = {
                type: "image",
                x: posX,
                y: posY,
                width: displayW,
                height: displayH,
                fileId: fileId,
                status: "saved",
                id: fileId + "_el",
            };

            const newElements: any[] = [imageElement];

            // Optionally add a label below the image
            if (label && typeof label === "string" && label.trim()) {
                newElements.push({
                    type: "text",
                    x: posX + displayW / 2 - (label.length * 5),
                    y: posY + displayH + 10,
                    text: label,
                    fontSize: 18,
                    id: fileId + "_label",
                });
            }

            // Convert skeletons and add to scene
            let converted: any[];
            try {
                converted = convertToExcalidrawElements(newElements as any, { regenerateIds: false });
            } catch (err) {
                console.error("[AI Tools] SVG element conversion failed:", err);
                return { error: "Failed to convert SVG element: " + String(err) };
            }

            const existingElements = [...excalidrawApi.getSceneElements()];
            excalidrawApi.updateScene({
                elements: [...existingElements, ...converted],
            });

            // Auto-scroll and zoom to fit all content in the viewport
            try {
                excalidrawApi.scrollToContent(undefined, {
                    fitToViewport: true,
                    viewportZoomFactor: 0.85,
                    animate: true,
                    duration: 300,
                });
            } catch (e) { }

            return {
                success: true,
                message: `Added SVG image (${displayW}×${displayH}) at (${posX}, ${posY})${label ? ` with label "${label}"` : ""}`,
            };
        }

        default:
            return { error: `Unknown tool: ${toolName}` };
    }
}
