// Definitions for Gemini AI Function Calling (Tools)
// These tools allow the Gemini Live agent to interact with the Excalidraw canvas.
// The AI generates Excalidraw skeleton JSON, which is auto-converted to full elements.

import { Type } from "@google/genai";
import {
  convertToExcalidrawElements,
  loadLibraryFromBlob,
  mergeLibraryItems,
} from "@excalidraw/excalidraw";
import * as Chess from "./chessEngine";

// ─── Interfaces ───

export interface ExcalidrawAPI {
  getSceneElements: () => any[];
  getAppState: () => any;
  getFiles: () => any;
  updateScene: (params: { elements: any[] }) => void;
  scrollToContent: (
    target?: any | any[],
    opts?: {
      fitToContent?: boolean;
      fitToViewport?: boolean;
      viewportZoomFactor?: number;
      animate?: boolean;
      duration?: number;
    },
  ) => void;
  addFiles: (files: any[]) => void;
  updateLibrary?: (params: {
    libraryItems: any[];
    merge?: boolean;
    prompt?: boolean;
    openLibraryMenu?: boolean;
    defaultStatus?: "published" | "unpublished";
  }) => Promise<void>;
}

// ─── Pointer Constants ───

const POINTER_PREFIX = "__pointer_";
const EXCALIDRAW_LIBRARIES_BASE = "https://libraries.excalidraw.com/";

type PublicLibraryManifestEntry = {
  id?: string;
  name?: string;
  source?: string;
  description?: string;
  itemNames?: string[];
  authors?: Array<{ name?: string }>;
};

let manifestCache: {
  loadedAt: number;
  items: PublicLibraryManifestEntry[];
} | null = null;

async function fetchPublicLibrariesManifest(): Promise<
  PublicLibraryManifestEntry[]
> {
  const now = Date.now();
  if (manifestCache && now - manifestCache.loadedAt < 5 * 60 * 1000) {
    return manifestCache.items;
  }

  const manifestCandidates = [
    "https://libraries.excalidraw.com/libraries.json",
    "https://raw.githubusercontent.com/excalidraw/excalidraw-libraries/main/libraries.json",
  ];

  let lastError = "";
  for (const url of manifestCandidates) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const json = await response.json();
      if (!Array.isArray(json)) {
        throw new Error("Manifest is not an array.");
      }
      manifestCache = {
        loadedAt: now,
        items: json as PublicLibraryManifestEntry[],
      };
      return manifestCache.items;
    } catch (err: any) {
      lastError = `${url}: ${err?.message || "Unknown error"}`;
    }
  }

  throw new Error(
    `Failed to fetch Excalidraw libraries manifest. ${lastError}`.trim(),
  );
}

// ─── Function Declarations for Gemini Live API (Manager Agent) ───
// Manager tools cover drawing delegation, canvas inspection/viewing, clearing, and screen viewing.

export const drawOnCanvasDeclaration = {
  name: "draw_on_canvas",
  description:
    "Send a drawing request to the specialized canvas agent (Gemini 2.0 Flash). The agent will generate and execute Excalidraw diagrams, SVG illustrations, flowcharts, creative art, etc. on the canvas. Use this for custom drawings, explanations, and non-library visuals. For icon/logo packs, prefer access_excalidraw_library first; only if no suitable library asset exists, use this tool to create a fresh custom substitute (single fallback draw). Provide a detailed natural language description of what to draw, including colors, style, and layout. Examples: 'Draw a red heart with pink outline', 'Create a flowchart of user authentication with blue and green boxes', 'Draw a colorful butterfly', 'Illustrate the solar system with labeled planets'.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      request: {
        type: Type.STRING,
        description:
          "Detailed natural language description of what to draw on the canvas. Be specific about colors, layout, style, and content.",
      },
    },
    required: ["request"],
  },
};

export const viewCanvasDeclaration = {
  name: "view_canvas",
  description:
    "Capture a visual snapshot of the Excalidraw canvas to see what is currently drawn. Use this when you want to visually inspect the canvas contents — for example, to review a diagram you just drew, see what the student has drawn, or understand the current state of the whiteboard. Returns the canvas as an image you can see.",
  parameters: {
    type: Type.OBJECT,
    properties: {},
    required: [],
  },
};

export const inspectCanvasDeclaration = {
  name: "inspect_canvas",
  description:
    "Get structured data about all elements currently on the canvas, including their types, positions, dimensions, and colors. Returns element details as JSON. Use this to understand the canvas layout, check if images or embedded videos (YouTube, iframes) are present, find positions of elements, or determine where to place new content. Especially useful before drawing to avoid overlapping user-uploaded images, embedded videos, or existing content.",
  parameters: {
    type: Type.OBJECT,
    properties: {},
    required: [],
  },
};

export const clearCanvasDeclaration = {
  name: "clear_canvas",
  description:
    "Clear drawable teaching content from the Excalidraw canvas while preserving user-uploaded assets like images and embedded videos/iframes by default. Use this only when the user explicitly asks to clear/reset/start over, or when replacing an old diagram with a new one and the user has agreed.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      mode: {
        type: Type.STRING,
        description:
          "Clearing mode. Use 'teaching_only' (default) to clear non-user drawing content and preserve images/embeddables. Use 'all' only when the user explicitly asks to wipe everything.",
      },
    },
    required: [],
  },
};

export const clearCanvasSelectionDeclaration = {
  name: "clear_canvas_selection",
  description:
    "Clear only specific parts of the canvas (individual elements or one diagram) without wiping everything. Supports targeting by element IDs, by group ID, or by a bounding box region.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      mode: {
        type: Type.STRING,
        description: "Selection mode: 'ids', 'group', or 'bbox'.",
      },
      ids_csv: {
        type: Type.STRING,
        description:
          "Comma-separated element IDs to remove when mode='ids'. Example: 'id1,id2,id3'.",
      },
      group_id: {
        type: Type.STRING,
        description:
          "Group ID to remove when mode='group'. Removes all elements in that diagram group.",
      },
      x: {
        type: Type.STRING,
        description: "Left coordinate for bbox mode.",
      },
      y: {
        type: Type.STRING,
        description: "Top coordinate for bbox mode.",
      },
      width: {
        type: Type.STRING,
        description: "Width for bbox mode.",
      },
      height: {
        type: Type.STRING,
        description: "Height for bbox mode.",
      },
      include_user_assets: {
        type: Type.STRING,
        description:
          "'yes' to allow deleting images/embeddables/iframes in the selection. Default 'no' preserves them.",
      },
    },
    required: ["mode"],
  },
};

export const viewScreenDeclaration = {
  name: "view_screen",
  description:
    "Capture a visual snapshot of the user's shared screen. Use this when you need to see what the user is looking at outside of the Excalidraw canvas, or when the user explicitly asks you to look at their screen.",
  parameters: {
    type: Type.OBJECT,
    properties: {},
    required: [],
  },
};

export const viewPdfSelectionDeclaration = {
  name: "view_pdf_selection",
  description:
    "Read the currently visible/marked area from the PDF overlay on the canvas. Use this when the user asks about content they highlighted in the PDF or asks for explanation of a specific PDF section.",
  parameters: {
    type: Type.OBJECT,
    properties: {},
    required: [],
  },
};

export const accessExcalidrawLibraryDeclaration = {
  name: "access_excalidraw_library",
  description:
    "Browse or import public Excalidraw libraries from the official libraries repository. This is the primary tool for prebuilt icons/logos/symbol packs. Use action='list' to search available libraries and action='import' to load one or more libraries into the current canvas library.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      action: {
        type: Type.STRING,
        description: "Action to perform: 'list' or 'import'.",
      },
      query: {
        type: Type.STRING,
        description:
          "Optional search query for library name/description/authors (used by list and import).",
      },
      limit: {
        type: Type.STRING,
        description:
          "Optional max number of libraries to return/import (default 10 for list, 5 for import).",
      },
      library_ids_csv: {
        type: Type.STRING,
        description:
          "Optional comma-separated library IDs or source names to import. Example: 'youritjang-software-architecture,cloud-cloud'.",
      },
    },
    required: ["action"],
  },
};

export const chessGameDeclaration = {
  name: "chess_game",
  description:
    "Interactive chess game where you (the AI) play against the user. WORKFLOW: (1) When user asks to play chess, use action='start' and ask which color they want (white/black). (2) After they choose, start the game with their color choice. (3) When it's YOUR turn (you'll see isAiTurn=true in the response), you MUST make a move by calling action='move'. (4) When it's the user's turn, they will make their moves by dragging pieces on the screen. DO NOT use the tool to make the user's moves. You must get all the user's moves from observing the screen itself, and then just make your own move when it's your turn. (5) Use action='valid_moves' to see legal moves before making your move. You are playing a real chess game - think strategically!",
  parameters: {
    type: Type.OBJECT,
    properties: {
      action: {
        type: Type.STRING,
        description:
          "Action: 'start' (begin game, requires player_color), 'move' (make a move), 'valid_moves' (see legal moves), 'state' (get game info), 'reset' (new game).",
      },
      player_color: {
        type: Type.STRING,
        description:
          "For 'start' action: 'white' or 'black' - which color the human user wants to play. You (AI) will play the opposite color.",
      },
      from: {
        type: Type.STRING,
        description:
          "Source square for 'move' action, e.g. 'e2'. Uses algebraic notation (a-h for file, 1-8 for rank).",
      },
      to: {
        type: Type.STRING,
        description: "Destination square for 'move' action, e.g. 'e4'.",
      },
      square: {
        type: Type.STRING,
        description: "Square to query for 'valid_moves' action, e.g. 'e2'.",
      },
      promotion: {
        type: Type.STRING,
        description:
          "Piece to promote pawn to: 'Q', 'R', 'B', or 'N'. Default is 'Q' (queen).",
      },
      light_color: {
        type: Type.STRING,
        description:
          "Hex color for light squares, e.g. '#f0d9b5'. AI can choose any color to theme the board.",
      },
      dark_color: {
        type: Type.STRING,
        description:
          "Hex color for dark squares, e.g. '#b58863'. AI can choose any color to theme the board.",
      },
      border_color: {
        type: Type.STRING,
        description: "Hex color for the board border/frame, e.g. '#6b4c2a'.",
      },
    },
    required: ["action"],
  },
};

export const readMemoryDeclaration = {
  name: "read_memory",
  description:
    "Read the persistent user profile memory to understand the user's preferences, interests, and learning style.",
  parameters: {
    type: Type.OBJECT,
    properties: {},
    required: [],
  },
};

export const writeMemoryDeclaration = {
  name: "write_memory",
  description:
    "Write the initial user profile to persistent memory after the onboarding discovery.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      preferred_visual_type: {
        type: Type.STRING,
        description:
          "e.g., 'svg', 'whiteboard drawing', 'animation', 'text explanation'",
      },
      learning_style: {
        type: Type.STRING,
        description: "e.g., 'visual + step-by-step'",
      },
      hobbies: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "User's hobbies.",
      },
      interests: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "User's topics of interest.",
      },
      skill_level: {
        type: Type.STRING,
        description: "e.g., 'beginner', 'intermediate', 'advanced'",
      },
      preferred_examples: {
        type: Type.STRING,
        description: "What kind of examples the user likes.",
      },
    },
    required: ["preferred_visual_type", "learning_style", "skill_level"],
  },
};

export const updateMemoryDeclaration = {
  name: "update_memory",
  description:
    "Update specific fields in the user's persistent memory if new preferences are discovered.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      preferred_visual_type: { type: Type.STRING },
      learning_style: { type: Type.STRING },
      hobbies: { type: Type.ARRAY, items: { type: Type.STRING } },
      interests: { type: Type.ARRAY, items: { type: Type.STRING } },
      skill_level: { type: Type.STRING },
      preferred_examples: { type: Type.STRING },
    },
    required: [],
  },
};

// ─── All tool declarations bundled for the Live API config ───
export const canvasToolDeclarations = [
  accessExcalidrawLibraryDeclaration,
  drawOnCanvasDeclaration,
  viewCanvasDeclaration,
  inspectCanvasDeclaration,
  clearCanvasDeclaration,
  clearCanvasSelectionDeclaration,
  viewPdfSelectionDeclaration,
  viewScreenDeclaration,
  chessGameDeclaration,
  readMemoryDeclaration,
  writeMemoryDeclaration,
  updateMemoryDeclaration,
];

function toExcalidrawSkeleton(elements: any[]): any[] {
  // ── Pass 1: Build a position map for all shapes (for startId/endId auto-routing) ──
  const posMap = new Map<
    string,
    { x: number; y: number; w: number; h: number }
  >();
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
    skeleton.id =
      el.id ||
      `el_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 8)}`;

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
        const labelText =
          el.labelText ||
          el.text ||
          (typeof el.label === "string" ? el.label : null);
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
      // Support multiple formats the AI model may use:
      // 1. {text: "Hello"} — standard
      // 2. {labelText: "Hello"} — alternative
      // 3. {label: {text: "Hello", fontSize: 16}} — model sometimes uses label object
      // 4. {label: "Hello"} — label as plain string
      const resolvedText =
        el.text ||
        el.labelText ||
        (el.label && typeof el.label === "object" ? el.label.text : null) ||
        (typeof el.label === "string" ? el.label : null) ||
        "";
      skeleton.text = resolvedText;
      if (el.fontSize) skeleton.fontSize = el.fontSize;
      else if (el.label?.fontSize) skeleton.fontSize = el.label.fontSize;
    }

    // ── Arrows and lines ──
    if (el.type === "arrow" || el.type === "line") {
      // Pass through arrow-specific properties
      if (el.endArrowhead !== undefined)
        skeleton.endArrowhead = el.endArrowhead;
      else if (el.type === "arrow") skeleton.endArrowhead = "arrow";

      if (el.startArrowhead !== undefined)
        skeleton.startArrowhead = el.startArrowhead;
      if (el.startBinding) skeleton.startBinding = el.startBinding;
      if (el.endBinding) skeleton.endBinding = el.endBinding;

      // Arrow label
      if (el.label && typeof el.label === "object") {
        skeleton.label = el.label;
      } else {
        const arrowLabel =
          el.labelText ||
          (el.type === "arrow" && typeof el.text === "string" ? el.text : null);
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
          skeleton.points = [
            [0, 0],
            [dstCx - srcCx, dstTop - srcBot],
          ];
        } else if (src) {
          skeleton.x = src.x + src.w / 2;
          skeleton.y = src.y + src.h;
          skeleton.points = [
            [0, 0],
            [0, el.height || 100],
          ];
        } else if (dst) {
          skeleton.points = [
            [0, 0],
            [dst.x + dst.w / 2 - (el.x ?? 0), dst.y - (el.y ?? 0)],
          ];
        } else {
          skeleton.points = [
            [0, 0],
            [0, el.height || 100],
          ];
        }
      } else {
        // Default: use width/height as direction
        skeleton.points = [
          [0, 0],
          [el.width || 200, el.height || 0],
        ];
      }
    }

    // ── Freedraw elements ──
    if (el.type === "freedraw") {
      skeleton.points = el.points || [[0, 0]];
      if (el.simulatePressure !== undefined)
        skeleton.simulatePressure = el.simulatePressure;
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
    points: [
      [0, 0],
      [0, 50],
    ],
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

function parseCsvIds(input: any): string[] {
  if (!input || typeof input !== "string") return [];
  return input
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function intersectsBBox(
  el: any,
  box: { x: number; y: number; width: number; height: number },
): boolean {
  const ex = Number(el.x || 0);
  const ey = Number(el.y || 0);
  const ew = Number(el.width || 0);
  const eh = Number(el.height || 0);
  const rx1 = box.x;
  const ry1 = box.y;
  const rx2 = box.x + box.width;
  const ry2 = box.y + box.height;
  const ex2 = ex + ew;
  const ey2 = ey + eh;
  return ex < rx2 && ex2 > rx1 && ey < ry2 && ey2 > ry1;
}

function getElementBBox(el: any): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  return {
    x: Number(el?.x || 0),
    y: Number(el?.y || 0),
    width: Number(el?.width || 0),
    height: Number(el?.height || 0),
  };
}

function getSceneBounds(
  elements: any[],
): { x: number; y: number; width: number; height: number } | null {
  if (!Array.isArray(elements) || elements.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const el of elements) {
    const box = getElementBBox(el);
    minX = Math.min(minX, box.x);
    minY = Math.min(minY, box.y);
    maxX = Math.max(maxX, box.x + box.width);
    maxY = Math.max(maxY, box.y + box.height);
  }

  if (
    !Number.isFinite(minX) ||
    !Number.isFinite(minY) ||
    !Number.isFinite(maxX) ||
    !Number.isFinite(maxY)
  ) {
    return null;
  }

  return {
    x: minX,
    y: minY,
    width: Math.max(0, maxX - minX),
    height: Math.max(0, maxY - minY),
  };
}

function getCanvasViewportRect(): DOMRect {
  const canvasRoot =
    document.querySelector(".canvas-area") ||
    document.querySelector(".excalidraw") ||
    document.body;
  return canvasRoot.getBoundingClientRect();
}

function viewportRectToSceneRect(rect: DOMRect, appState: any) {
  const viewportRect = getCanvasViewportRect();
  const zoom = Number(appState?.zoom?.value || 1) || 1;
  const scrollX = Number(appState?.scrollX || 0);
  const scrollY = Number(appState?.scrollY || 0);
  const localLeft = rect.left - viewportRect.left;
  const localTop = rect.top - viewportRect.top;

  return {
    x: (localLeft - scrollX) / zoom,
    y: (localTop - scrollY) / zoom,
    width: rect.width / zoom,
    height: rect.height / zoom,
  };
}

function getProtectedCanvasItems(excalidrawApi: ExcalidrawAPI) {
  const elements = excalidrawApi.getSceneElements();
  const appState = excalidrawApi.getAppState();
  const preservedElements = elements
    .filter(
      (e: any) =>
        !e.isDeleted &&
        !e.id?.startsWith(POINTER_PREFIX) &&
        (e.type === "image" || e.type === "embeddable" || e.type === "iframe"),
    )
    .map((e: any) => ({
      id: e.id,
      type: e.type,
      x: Math.round(e.x),
      y: Math.round(e.y),
      width: Math.round(e.width),
      height: Math.round(e.height),
      ...(e.type === "image" ? { isImage: true, fileId: e.fileId } : {}),
      ...(["embeddable", "iframe"].includes(e.type)
        ? { isEmbeddable: true, link: e.link || null }
        : {}),
    }));

  const overlaySelectors = [
    { selector: ".pdf-overlay-panel", type: "virtual_pdf_overlay" },
    { selector: ".svg-pip-panel", type: "virtual_svg_overlay" },
    { selector: ".chess-board-overlay", type: "virtual_chess_overlay" },
  ];

  const overlayItems = overlaySelectors.flatMap(({ selector, type }) =>
    Array.from(document.querySelectorAll(selector)).map((node, index) => {
      const rect = (node as HTMLElement).getBoundingClientRect();
      const sceneRect = viewportRectToSceneRect(rect, appState);
      return {
        id: `${type}_${index}`,
        type,
        x: Math.round(sceneRect.x),
        y: Math.round(sceneRect.y),
        width: Math.round(sceneRect.width),
        height: Math.round(sceneRect.height),
        strokeColor: "transparent",
        backgroundColor: "transparent",
      };
    }),
  );

  const items = [...preservedElements, ...overlayItems];
  const bounds = getSceneBounds(items);

  return { items, bounds };
}

function shiftElements(elements: any[], dx: number, dy = 0): any[] {
  return elements.map((el) => ({
    ...el,
    x: Number(el?.x || 0) + dx,
    y: Number(el?.y || 0) + dy,
  }));
}

function resolveNonOverlappingPlacement(
  requestedBox: { x: number; y: number; width: number; height: number },
  protectedItems: any[],
  minGap = 150,
) {
  if (protectedItems.length === 0) {
    return { ...requestedBox, shifted: false, shiftX: 0 };
  }

  let maxRight = 0;
  for (const item of protectedItems) {
    maxRight = Math.max(
      maxRight,
      Number(item.x || 0) + Number(item.width || 0),
    );
  }

  const collides = protectedItems.some(
    (item) =>
      intersectsBBox(item, requestedBox) ||
      intersectsBBox(item, {
        x: requestedBox.x - 24,
        y: requestedBox.y - 24,
        width: requestedBox.width + 48,
        height: requestedBox.height + 48,
      }),
  );

  const targetX = maxRight + minGap;
  const shiftX =
    collides || requestedBox.x < targetX ? targetX - requestedBox.x : 0;

  return {
    x: requestedBox.x + shiftX,
    y: requestedBox.y,
    width: requestedBox.width,
    height: requestedBox.height,
    shifted: shiftX !== 0,
    shiftX,
  };
}

function hasFloatingOverlay(items: any[]): boolean {
  return items.some(
    (item: any) =>
      item?.type === "virtual_pdf_overlay" ||
      item?.type === "virtual_svg_overlay" ||
      item?.type === "virtual_chess_overlay",
  );
}

// ─── Robust JSON Parser for AI Outputs ───
// Handles common formatting errors like unescaped newlines within strings
// and trailing commas which frequently break JSON.parse.
function safelyParseJSON(jsonStr: string): any {
  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    try {
      // Attempt 1: Fix unescaped newlines inside strings.
      // Replace literal newline characters with \\n
      let fixedStr = jsonStr.replace(/\n/g, "\\n");
      // Attempt 2: Fix trailing commas
      fixedStr = fixedStr.replace(/,\s*([\]}])/g, "$1");
      return JSON.parse(fixedStr);
    } catch (e2) {
      // Throw original error if fixes don't work
      throw e;
    }
  }
}

// ─── Main Tool Execution ───

export async function executeCanvasTool(
  toolName: string,
  toolArgs: any,
  excalidrawApi: ExcalidrawAPI,
): Promise<any> {
  console.log(`[AI Tools] executeCanvasTool ENTERED: toolName=${toolName}`);
  if (!excalidrawApi) {
    console.error(`[AI Tools] excalidrawApi is falsy!`);
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
          ...(["embeddable", "iframe"].includes(e.type)
            ? { isEmbeddable: true, link: e.link || null }
            : {}),
        }));

      const { items: protectedItems, bounds } =
        getProtectedCanvasItems(excalidrawApi);
      const images = protectedItems.filter(
        (e: any) => e.type === "image" || e.type === "virtual_pdf_overlay",
      );
      const embeddables = protectedItems.filter((e: any) =>
        ["embeddable", "iframe"].includes(e.type),
      );
      const overlays = protectedItems.filter((e: any) =>
        e.type.startsWith("virtual_"),
      );
      const userContentBounds = bounds
        ? {
            x: bounds.x,
            y: bounds.y,
            width: bounds.width,
            height: bounds.height,
            rightEdge: bounds.x + bounds.width,
            bottomEdge: bounds.y + bounds.height,
          }
        : null;

      // Build hint message
      const hintParts: string[] = [];
      if (images.length > 0) hintParts.push(`${images.length} image(s)`);
      if (embeddables.length > 0)
        hintParts.push(
          `${embeddables.length} embedded video(s)/iframe(s) (e.g. YouTube)`,
        );
      if (overlays.length > 0) {
        hintParts.push(`${overlays.length} floating overlay panel(s)`);
      }

      return {
        elementCount: simplified.length,
        imageCount: images.length,
        embeddableCount: embeddables.length,
        overlayCount: overlays.length,
        ...(userContentBounds ? { userContentBounds } : {}),
        // Keep legacy imageBounds alias for backward compat
        ...(userContentBounds ? { imageBounds: userContentBounds } : {}),
        elements: simplified,
        protectedItems,
        hint:
          hintParts.length > 0
            ? `There are ${hintParts.join(" and ")} on the canvas. These are protected layout constraints — NEVER remove or overwrite user assets. Place new content to the RIGHT of them (x > ${userContentBounds!.rightEdge + 150}) to avoid overlap.`
            : "Canvas has no protected assets or overlays — you can place content anywhere.",
      };
    }

    case "clear_canvas": {
      const mode = (toolArgs?.mode || "teaching_only").toLowerCase().trim();
      const sceneElements = excalidrawApi.getSceneElements();

      if (mode === "all") {
        excalidrawApi.updateScene({ elements: [] });
        return {
          success: true,
          mode: "all",
          message: "Canvas fully cleared.",
        };
      }

      // Default/safe behavior: clear tutor drawings but preserve user assets.
      const preserved = sceneElements.filter(
        (e: any) =>
          (e.type === "image" ||
            e.type === "embeddable" ||
            e.type === "iframe") &&
          !e.isDeleted,
      );

      excalidrawApi.updateScene({ elements: preserved });

      return {
        success: true,
        mode: "teaching_only",
        preservedCount: preserved.length,
        message:
          preserved.length > 0
            ? `Cleared teaching drawings and kept ${preserved.length} user asset(s).`
            : "Cleared teaching drawings.",
      };
    }

    case "clear_canvas_selection": {
      const mode = (toolArgs?.mode || "").toLowerCase().trim();
      const includeUserAssets =
        (toolArgs?.include_user_assets || "no").toLowerCase().trim() === "yes";
      const sceneElements = excalidrawApi.getSceneElements();

      if (!["ids", "group", "bbox"].includes(mode)) {
        return { error: "Invalid mode. Use 'ids', 'group', or 'bbox'." };
      }

      const isProtectedUserAsset = (e: any) =>
        !includeUserAssets &&
        (e.type === "image" || e.type === "embeddable" || e.type === "iframe");

      const idsToRemove = new Set<string>();

      if (mode === "ids") {
        const ids = parseCsvIds(toolArgs?.ids_csv);
        if (ids.length === 0) {
          return {
            error: "mode='ids' requires ids_csv with at least one element id.",
          };
        }
        for (const id of ids) idsToRemove.add(id);
      }

      if (mode === "group") {
        const groupId = String(toolArgs?.group_id || "").trim();
        if (!groupId) {
          return { error: "mode='group' requires group_id." };
        }
        for (const el of sceneElements) {
          if (Array.isArray(el.groupIds) && el.groupIds.includes(groupId)) {
            idsToRemove.add(el.id);
          }
        }
        if (idsToRemove.size === 0) {
          return {
            success: true,
            removedCount: 0,
            message: `No elements found for group '${groupId}'.`,
          };
        }
      }

      if (mode === "bbox") {
        const x = parseFloat(toolArgs?.x);
        const y = parseFloat(toolArgs?.y);
        const width = parseFloat(toolArgs?.width);
        const height = parseFloat(toolArgs?.height);

        if ([x, y, width, height].some((n) => Number.isNaN(n))) {
          return { error: "mode='bbox' requires numeric x, y, width, height." };
        }
        if (width <= 0 || height <= 0) {
          return { error: "bbox width and height must be > 0." };
        }

        for (const el of sceneElements) {
          if (intersectsBBox(el, { x, y, width, height })) {
            idsToRemove.add(el.id);
          }
        }
      }

      const beforeCount = sceneElements.length;
      const keptElements = sceneElements.filter((el: any) => {
        if (el.isDeleted) return true;
        if (el.id?.startsWith(POINTER_PREFIX)) return true;
        if (!idsToRemove.has(el.id)) return true;
        if (isProtectedUserAsset(el)) return true;
        return false;
      });

      const removedCount = beforeCount - keptElements.length;
      if (removedCount === 0) {
        return {
          success: true,
          removedCount: 0,
          message: includeUserAssets
            ? "No matching elements were removed."
            : "No matching removable elements found (user assets are protected by default).",
        };
      }

      excalidrawApi.updateScene({ elements: keptElements });
      return {
        success: true,
        mode,
        removedCount,
        message: `Removed ${removedCount} selected element(s).`,
      };
    }

    case "update_scene": {
      const {
        elements_json,
        elements: elementsArray,
        clear_first,
        pointer_x,
        pointer_y,
        pointer_label,
      } = toolArgs;
      const mode = (clear_first || "no").toLowerCase().trim();
      console.log(
        `[AI Tools] update_scene called: mode=${mode}, has_elements_json=${!!elements_json}, has_elements=${!!elementsArray}`,
      );

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
          inputElements = safelyParseJSON(elements_json);
        } else if (elementsArray && Array.isArray(elementsArray)) {
          inputElements = elementsArray;
        } else if (elements_json && Array.isArray(elements_json)) {
          inputElements = elements_json;
        } else {
          return {
            error:
              "No elements provided. Pass elements_json as a JSON string array.",
          };
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

      console.log(
        `[AI Tools] Converting ${skeletons.length} skeletons to Excalidraw elements`,
      );

      // Use Excalidraw's official converter for proper element creation
      // This handles text binding, arrow binding, IDs, versioning, etc.
      let newElements: any[];
      try {
        newElements = convertToExcalidrawElements(skeletons as any, {
          regenerateIds: false,
        });
      } catch (err) {
        console.error("[AI Tools] convertToExcalidrawElements failed:", err);
        return { error: "Failed to convert elements: " + String(err) };
      }

      console.log(
        `[AI Tools] Converted ${newElements.length} elements (from ${inputElements.length} input)`,
      );

      // Get current elements (optionally clear first)
      let existingElements: any[] = [];
      if (mode !== "yes") {
        // "no" mode — append to everything
        existingElements = [...excalidrawApi.getSceneElements()];
      } else {
        // "yes" mode — clear canvas but PRESERVE image and embeddable elements (user content)
        existingElements = excalidrawApi
          .getSceneElements()
          .filter(
            (e: any) =>
              (e.type === "image" ||
                e.type === "embeddable" ||
                e.type === "iframe") &&
              !e.isDeleted,
          );
      }

      const { items: protectedItems } = getProtectedCanvasItems(excalidrawApi);
      const requestedBounds = getSceneBounds(inputElements);
      if (requestedBounds) {
        const placement = resolveNonOverlappingPlacement(
          requestedBounds,
          protectedItems,
          150,
        );
        if (placement.shifted) {
          inputElements = shiftElements(inputElements, placement.shiftX, 0);
          const shiftedSkeletons = toExcalidrawSkeleton(inputElements);
          try {
            newElements = convertToExcalidrawElements(shiftedSkeletons as any, {
              regenerateIds: false,
            });
          } catch (err) {
            console.error("[AI Tools] Re-conversion after shift failed:", err);
          }
        }
      }

      const finalElements = [...existingElements, ...newElements];
      console.log(
        `[AI Tools] updateScene: ${existingElements.length} existing + ${newElements.length} new = ${finalElements.length} total`,
      );

      excalidrawApi.updateScene({
        elements: finalElements,
      });

      if (!hasFloatingOverlay(protectedItems)) {
        try {
          excalidrawApi.scrollToContent(undefined, {
            fitToViewport: true,
            viewportZoomFactor: 0.85,
            animate: true,
            duration: 300,
          });
        } catch (e) {}
      }

      // Verify elements were actually added
      const sceneAfter = excalidrawApi.getSceneElements();
      console.log(
        `[AI Tools] Scene now has ${sceneAfter.length} elements after updateScene`,
      );

      return {
        success: true,
        addedCount: newElements.length,
        totalOnCanvas: sceneAfter.length,
        message: `Drew ${newElements.length} elements on the canvas.`,
      };
    }

    case "access_excalidraw_library": {
      const action = String(toolArgs?.action || "")
        .toLowerCase()
        .trim();
      if (!["list", "import"].includes(action)) {
        return { error: "Invalid action. Use 'list' or 'import'." };
      }

      const manifest = await fetchPublicLibrariesManifest();
      const rawQuery = String(toolArgs?.query || "").trim();
      const query = rawQuery.toLowerCase();
      const requestedLimit = parseInt(String(toolArgs?.limit || ""), 10);
      const defaultLimit = action === "list" ? 10 : 5;
      const limit =
        Number.isFinite(requestedLimit) && requestedLimit > 0
          ? Math.min(requestedLimit, 50)
          : defaultLimit;

      const librariesWithIds = manifest
        .filter(
          (entry) =>
            typeof entry?.source === "string" &&
            /\.excalidrawlib$/i.test(entry.source || ""),
        )
        .map((entry) => {
          const source = String(entry.source || "");
          const derivedId = source
            .toLowerCase()
            .replace(/\//g, "-")
            .replace(/\.excalidrawlib$/i, "");
          return {
            id: entry.id || derivedId,
            name: entry.name || derivedId,
            source,
            description: entry.description || "",
            itemNames: Array.isArray(entry.itemNames) ? entry.itemNames : [],
            authors: Array.isArray(entry.authors) ? entry.authors : [],
          };
        });

      const matchesQuery = (lib: any) => {
        if (!query) return true;
        const authorNames = lib.authors
          .map((a: any) => String(a?.name || ""))
          .join(" ");
        const itemNames = lib.itemNames.join(" ");
        const haystack =
          `${lib.id} ${lib.name} ${lib.description} ${authorNames} ${itemNames}`.toLowerCase();
        return haystack.includes(query);
      };

      const filtered = librariesWithIds.filter(matchesQuery);

      if (action === "list") {
        const preview = filtered.slice(0, limit).map((lib: any) => ({
          id: lib.id,
          name: lib.name,
          source: lib.source,
          author: lib.authors[0]?.name || null,
          description: lib.description,
          sampleItems: lib.itemNames.slice(0, 8),
        }));

        return {
          success: true,
          action: "list",
          totalMatches: filtered.length,
          returned: preview.length,
          libraries: preview,
          message:
            preview.length > 0
              ? `Found ${filtered.length} matching library/libraries. Showing ${preview.length}.`
              : "No matching Excalidraw libraries found.",
        };
      }

      if (!excalidrawApi.updateLibrary) {
        return {
          error: "Canvas library API is not available in this session.",
        };
      }

      const requestedIds = parseCsvIds(toolArgs?.library_ids_csv).map((x) =>
        x.toLowerCase(),
      );
      let selected: any[] = [];
      if (requestedIds.length > 0) {
        const requestedSet = new Set(requestedIds);
        selected = filtered.filter(
          (lib: any) =>
            requestedSet.has(lib.id.toLowerCase()) ||
            requestedSet.has(lib.source.toLowerCase()),
        );
      } else {
        selected = filtered.slice(0, limit);
      }

      if (selected.length === 0) {
        return {
          success: false,
          action: "import",
          importedCount: 0,
          message:
            "No libraries selected for import. Provide library_ids_csv or a broader query.",
        };
      }

      let mergedItems: any[] = [];
      const failed: string[] = [];
      const imported: string[] = [];

      for (const lib of selected) {
        const url = new URL(
          `libraries/${lib.source}`,
          EXCALIDRAW_LIBRARIES_BASE,
        ).toString();
        try {
          const response = await fetch(url);
          if (!response.ok) {
            failed.push(lib.id);
            continue;
          }
          const blob = await response.blob();
          const items = await loadLibraryFromBlob(blob, "published");
          mergedItems = mergeLibraryItems(
            mergedItems as any,
            items as any,
          ) as any[];
          imported.push(lib.id);
        } catch {
          failed.push(lib.id);
        }
      }

      if (mergedItems.length > 0) {
        await excalidrawApi.updateLibrary({
          libraryItems: mergedItems,
          merge: true,
          prompt: false,
          openLibraryMenu: false,
          defaultStatus: "published",
        });
      }

      return {
        success: imported.length > 0,
        action: "import",
        importedCount: imported.length,
        failedCount: failed.length,
        imported,
        failed,
        message: `Imported ${imported.length}/${selected.length} selected Excalidraw libraries.`,
      };
    }

    case "chess_game": {
      const action = String(toolArgs?.action || "")
        .toLowerCase()
        .trim();

      // Helper: render chess board SVG onto the canvas, replacing the old one
      const renderChessBoard = (
        state: Chess.GameState,
        highlights?: string[],
      ) => {
        // Don't render SVG board anymore - we use the interactive HTML board instead
        // Just dispatch event to update the interactive board
        window.dispatchEvent(new CustomEvent("chess-board-updated"));

        // Remove old SVG chess board from canvas if it exists
        const oldId = Chess.getBoardElementId();
        if (oldId) {
          let existingElements = [...excalidrawApi.getSceneElements()];
          existingElements = existingElements.filter(
            (e: any) => e.id !== oldId && e.fileId !== oldId.replace("_el", ""),
          );
          excalidrawApi.updateScene({ elements: existingElements });
          Chess.clearBoardElementId();
        }

        return null; // success
      };

      if (action === "start" || action === "reset") {
        const playerColorChoice = String(toolArgs?.player_color || "")
          .toLowerCase()
          .trim();

        // Validate player color choice
        if (playerColorChoice !== "white" && playerColorChoice !== "black") {
          return {
            error:
              "player_color is required for 'start' action. Ask the user: 'Would you like to play as White or Black?' Then call again with player_color='white' or player_color='black'.",
          };
        }

        const state = Chess.startGame(playerColorChoice as Chess.Color);

        // Apply custom colors if provided
        if (
          toolArgs?.light_color ||
          toolArgs?.dark_color ||
          toolArgs?.border_color
        ) {
          Chess.setBoardColors(
            toolArgs.light_color,
            toolArgs.dark_color,
            toolArgs.border_color,
          );
        }

        const err = renderChessBoard(state);
        if (err) return err;

        const aiColor = Chess.getAiColor();
        const isAiTurn = Chess.isAiTurn();

        // Dispatch event to show interactive chess board
        window.dispatchEvent(new CustomEvent("chess-game-started"));

        // Expose Chess module globally for ChessBoard component
        (window as any).Chess = Chess;

        return {
          success: true,
          message: `Chess game started! User is playing ${playerColorChoice}, you (AI) are playing ${aiColor}. ${state.turn} moves first. ${isAiTurn ? "It's YOUR turn - make a move!" : "It's the user's turn - wait for their move."}`,
          turn: state.turn,
          playerColor: playerColorChoice,
          aiColor: aiColor,
          isAiTurn: isAiTurn,
          isPlayerTurn: Chess.isPlayerTurn(),
        };
      }

      if (action === "move") {
        const from = String(toolArgs?.from || "")
          .toLowerCase()
          .trim();
        const to = String(toolArgs?.to || "")
          .toLowerCase()
          .trim();
        if (!from || !to)
          return {
            error:
              "'move' action requires 'from' and 'to' squares (e.g., from='e2', to='e4').",
          };

        // Execute move with full validation
        const result = Chess.makeMove(from, to, toolArgs?.promotion);

        // Log validation result for debugging
        const movingColor =
          Chess.getState()?.turn === "white" ? "black" : "white"; // Color that just moved
        const wasAiMove = movingColor === Chess.getAiColor();
        console.log(
          `[Chess] Move attempt: ${from} → ${to} (${wasAiMove ? "AI" : "Player"}), Result:`,
          result.ok ? "VALID" : "REJECTED",
          result.error || result.notation,
        );

        if (!result.ok) return { error: result.error };

        const err = renderChessBoard(result.state);
        if (err) return err;

        const isAiTurn = Chess.isAiTurn();
        const isPlayerTurn = Chess.isPlayerTurn();

        let statusMsg = "";
        if (result.state.status === "checkmate") {
          statusMsg = `Checkmate! ${result.state.winner} wins! ${result.state.winner === Chess.getAiColor() ? "You (AI) won!" : "User won!"}`;
        } else if (result.state.status === "stalemate") {
          statusMsg = "Stalemate — draw!";
        } else if (result.state.status === "check") {
          statusMsg = `Check! ${isAiTurn ? "It's YOUR turn - you must respond to the check!" : "It's the user's turn."}`;
        } else {
          statusMsg = `${result.state.turn} to move. ${isAiTurn ? "It's YOUR turn - make your move!" : "It's the user's turn - wait for their move."}`;
        }

        return {
          success: true,
          notation: result.notation,
          message: `Moved ${from} to ${to} (${result.notation}). ${statusMsg}`,
          turn: result.state.turn,
          status: result.state.status,
          winner: result.state.winner,
          isAiTurn: isAiTurn,
          isPlayerTurn: isPlayerTurn,
          playerColor: Chess.getPlayerColor(),
          aiColor: Chess.getAiColor(),
          validationPassed: true,
        };
      }

      if (action === "ai_move") {
        return {
          error:
            "AI move is disabled. You must make all moves using action='move' with from/to parameters. Use action='valid_moves' to see legal moves for any piece.",
        };
      }

      if (action === "valid_moves") {
        const square = String(toolArgs?.square || "")
          .toLowerCase()
          .trim();
        if (!square)
          return {
            error:
              "'valid_moves' action requires 'square' parameter (e.g., square='e2').",
          };

        const moves = Chess.getValidMoves(square);
        const state = Chess.getState();
        if (state && moves.length > 0) {
          const err = renderChessBoard(state, moves);
          if (err) return err;
        }
        return {
          success: true,
          square,
          validMoves: moves,
          message:
            moves.length > 0
              ? `Valid moves for ${square}: ${moves.join(", ")}`
              : `No valid moves for ${square}.`,
        };
      }

      if (action === "state") {
        const state = Chess.getState();
        if (!state)
          return { error: "No game in progress. Use action='start' first." };

        const isAiTurn = Chess.isAiTurn();
        const isPlayerTurn = Chess.isPlayerTurn();

        return {
          success: true,
          turn: state.turn,
          status: state.status,
          winner: state.winner,
          moveCount: state.history.length,
          lastMove: state.lastMove,
          capturedByWhite: state.capturedByWhite,
          capturedByBlack: state.capturedByBlack,
          playerColor: Chess.getPlayerColor(),
          aiColor: Chess.getAiColor(),
          isAiTurn: isAiTurn,
          isPlayerTurn: isPlayerTurn,
          message: isAiTurn
            ? "It's YOUR turn (AI) - make a move!"
            : "It's the user's turn - wait for their move.",
        };
      }

      return {
        error: `Unknown chess action: '${action}'. Valid actions: 'start' (with player_color), 'move', 'valid_moves', 'state', 'reset'.`,
      };
    }

    case "add_svg": {
      const {
        svg_code,
        x: xStr,
        y: yStr,
        width: wStr,
        height: hStr,
        label,
      } = toolArgs;

      if (!svg_code || typeof svg_code !== "string") {
        return {
          error: "svg_code is required and must be a non-empty SVG string.",
        };
      }

      // Ensure the SVG has xmlns attribute for proper rendering
      let svgString = svg_code.trim();
      if (!svgString.startsWith("<svg")) {
        return { error: "svg_code must start with an <svg> element." };
      }
      if (!svgString.includes("xmlns")) {
        svgString = svgString.replace(
          "<svg",
          '<svg xmlns="http://www.w3.org/2000/svg"',
        );
      }

      // Parse dimensions from SVG viewBox or width/height attributes
      let svgW = 300,
        svgH = 300;
      const viewBoxMatch = svgString.match(
        /viewBox=["']([\d.\-]+)\s+([\d.\-]+)\s+([\d.\-]+)\s+([\d.\-]+)["']/,
      );
      if (viewBoxMatch) {
        svgW = parseFloat(viewBoxMatch[3]);
        svgH = parseFloat(viewBoxMatch[4]);
      } else {
        const wMatch = svgString.match(/width=["'](\d+)/);
        const hMatch = svgString.match(/height=["'](\d+)/);
        if (wMatch) svgW = parseInt(wMatch[1]);
        if (hMatch) svgH = parseInt(hMatch[1]);
      }

      const requestedBox = {
        x: xStr ? parseFloat(xStr) : 100,
        y: yStr ? parseFloat(yStr) : 100,
        width: wStr ? parseFloat(wStr) : svgW,
        height: hStr ? parseFloat(hStr) : svgH,
      };
      const { items: protectedItems } = getProtectedCanvasItems(excalidrawApi);
      const placement = resolveNonOverlappingPlacement(
        requestedBox,
        protectedItems,
        150,
      );
      const posX = placement.x;
      const posY = placement.y;
      const displayW = wStr ? parseFloat(wStr) : svgW;
      const displayH = hStr ? parseFloat(hStr) : svgH;

      // Detect if SVG contains animations (SMIL or CSS)
      const hasAnimation =
        /<animate\b|<animateTransform\b|<animateMotion\b|<set\b|@keyframes\s|animation\s*:/i.test(
          svgString,
        );

      // If animated, show as a live overlay so animations actually play
      // and skip embedding the static image on the canvas
      if (hasAnimation) {
        window.dispatchEvent(
          new CustomEvent("svg-animation-overlay", {
            detail: {
              svgHtml: svgString,
              label,
              x: posX,
              y: posY,
              width: displayW,
              height: displayH,
            },
          }),
        );
        console.log(
          "[AI Tools] Animated SVG detected — rendering as live overlay at",
          posX,
          posY,
        );
        return {
          success: true,
          message: `Animated SVG shown as live overlay at (${posX}, ${posY})${label ? ` with label "${label}"` : ""}. Multiple animations can coexist on the canvas. The user can drag them anywhere and close them individually.`,
        };
      }

      // Convert SVG to base64 data URL
      const encoded = unescape(encodeURIComponent(svgString));
      const base64 = btoa(encoded);
      const dataURL = `data:image/svg+xml;base64,${base64}`;

      // Generate a unique file ID
      const fileId = `svg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      // Register the SVG file with Excalidraw
      excalidrawApi.addFiles([
        {
          id: fileId as any,
          mimeType: "image/svg+xml" as any,
          dataURL: dataURL as any,
          created: Date.now(),
        },
      ]);

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
          x: posX + displayW / 2 - label.length * 5,
          y: posY + displayH + 10,
          text: label,
          fontSize: 18,
          id: fileId + "_label",
        });
      }

      // Convert skeletons and add to scene
      let converted: any[];
      try {
        converted = convertToExcalidrawElements(newElements as any, {
          regenerateIds: false,
        });
      } catch (err) {
        console.error("[AI Tools] SVG element conversion failed:", err);
        return { error: "Failed to convert SVG element: " + String(err) };
      }

      const existingElements = [...excalidrawApi.getSceneElements()];
      excalidrawApi.updateScene({
        elements: [...existingElements, ...converted],
      });

      if (!hasFloatingOverlay(protectedItems)) {
        try {
          excalidrawApi.scrollToContent(undefined, {
            fitToViewport: true,
            viewportZoomFactor: 0.85,
            animate: true,
            duration: 300,
          });
        } catch (e) {}
      }

      return {
        success: true,
        message: `Added SVG image (${displayW}×${displayH}) at (${posX}, ${posY})${label ? ` with label "${label}"` : ""}`,
      };
    }

    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}
