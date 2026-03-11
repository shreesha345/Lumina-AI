// ─── Canvas Tool Agent ───
// Uses Gemini 2.0 Flash to generate Excalidraw JSON / SVG from natural language requests.
// Called by the Live agent (manager) via the draw_on_canvas tool.

import { GoogleGenAI, Type } from "@google/genai";
import canvasRulesDoc from "../../skills/excalidraw/references/canvas-rules.md?raw";
import excalidrawRefDoc from "../../skills/excalidraw/references/excalidraw-reference.md?raw";
import { executeCanvasTool, type ExcalidrawAPI } from "./aiTools";

const API_KEY = (import.meta as any).env.VITE_GEMINI_API_KEY || "";
const VERTEX_API_KEY = (import.meta as any).env.VITE_VERTEX_API_KEY || "";
const GOOGLE_CLOUD_PROJECT =
  (import.meta as any).env.VITE_GOOGLE_CLOUD_PROJECT || "";
const GOOGLE_CLOUD_LOCATION =
  (import.meta as any).env.VITE_GOOGLE_CLOUD_LOCATION_TOOLS ||
  (import.meta as any).env.VITE_GOOGLE_CLOUD_LOCATION ||
  "global";
const USE_VERTEX_AI =
  (
    (import.meta as any).env.VITE_GOOGLE_GENAI_USE_VERTEXAI || ""
  ).toLowerCase() === "true";
const TOOL_MODEL =
  (import.meta as any).env.VITE_GEMINI_TOOL_MODEL || "gemini-2.0-flash-exp";
const TOOL_THINKING_BUDGET_RAW = (import.meta as any).env
  .VITE_GEMINI_TOOL_THINKING_BUDGET;
const TOOL_THINKING_BUDGET = Number.isFinite(Number(TOOL_THINKING_BUDGET_RAW))
  ? Number(TOOL_THINKING_BUDGET_RAW)
  : 0;

function createGenAIClient() {
  if (USE_VERTEX_AI) {
    const baseUrl =
      GOOGLE_CLOUD_LOCATION && GOOGLE_CLOUD_LOCATION !== "global"
        ? `https://${GOOGLE_CLOUD_LOCATION}-aiplatform.googleapis.com/`
        : `https://aiplatform.googleapis.com/`;
    return new GoogleGenAI({
      vertexai: true,
      apiKey: VERTEX_API_KEY || API_KEY,
      httpOptions: { baseUrl },
    });
  }

  return new GoogleGenAI({ apiKey: API_KEY });
}

// ─── Tool declarations the agent can call ───

const toolAgentTools = [
  {
    name: "update_scene",
    description:
      "Draw lightweight whiteboard diagrams on the Excalidraw canvas using JSON elements. Best for small box-arrow-text layouts, quick comparisons, and simple step-by-step structures. ⚠️ Cannot animate. If the visual is dense, highly precise, polished, or larger than about 10-12 meaningful elements, use add_svg instead.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        clear_first: {
          type: Type.STRING,
          description:
            "'yes' to clear canvas, 'no' to append, 'pointer' to show pointer, 'clear_pointer' to remove pointer, 'clear_all' to clear.",
        },
        elements_json: {
          type: Type.STRING,
          description:
            'JSON array string of elements. Each needs type, x, y. Shapes support label.text. Example: [{"type":"rectangle","id":"a","x":100,"y":100,"width":200,"height":80,"backgroundColor":"#a5d8ff","fillStyle":"solid","label":{"text":"Box"}}]. CRITICAL: Must be valid JSON. DO NOT use unescaped newlines (\\n) inside strings.',
        },
        pointer_x: { type: Type.STRING, description: "X coord for pointer" },
        pointer_y: { type: Type.STRING, description: "Y coord for pointer" },
        pointer_label: { type: Type.STRING, description: "Label for pointer" },
      },
      required: ["clear_first"],
    },
  },
  {
    name: "add_svg",
    description:
      "Add an SVG to the canvas. Supports BOTH static AND animated content. Use for all animation, for dense or precise diagrams, and for rich visuals where Excalidraw JSON is too brittle or limited. Animated SVGs auto-render as live draggable overlay panels. Multiple can coexist.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        svg_code: {
          type: Type.STRING,
          description:
            'Complete <svg> element with xmlns, viewBox. Example: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><circle cx="100" cy="100" r="80" fill="#a5d8ff"/></svg>',
        },
        x: {
          type: Type.STRING,
          description: "X position (string number, default '100')",
        },
        y: {
          type: Type.STRING,
          description: "Y position (string number, default '100')",
        },
        width: {
          type: Type.STRING,
          description: "Display width (string number)",
        },
        height: {
          type: Type.STRING,
          description: "Display height (string number)",
        },
        label: { type: Type.STRING, description: "Text label below the SVG" },
      },
      required: ["svg_code"],
    },
  },
  {
    name: "inspect_canvas",
    description:
      "Returns all elements currently on the canvas, including their bounding boxes and coordinates (x, y, width, height). Use this tool to find the exact location of PDFs, images, videos, or existing drawings so you can place your new visuals carefully without overlapping them.",
    parameters: {
      type: Type.OBJECT,
      properties: {},
      required: [],
    },
  },
  {
    name: "clear_canvas_selection",
    description:
      "Remove only specific parts of the canvas so diagrams can be updated without clearing everything. Supports mode='ids' (ids_csv), mode='group' (group_id), or mode='bbox' (x,y,width,height). By default, user images and embedded videos/iframes are protected.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        mode: {
          type: Type.STRING,
          description: "Selection mode: 'ids', 'group', or 'bbox'.",
        },
        ids_csv: {
          type: Type.STRING,
          description: "Comma-separated element IDs to remove when mode='ids'.",
        },
        group_id: {
          type: Type.STRING,
          description: "Group ID to remove when mode='group'.",
        },
        x: { type: Type.STRING, description: "Left coordinate for bbox mode." },
        y: { type: Type.STRING, description: "Top coordinate for bbox mode." },
        width: { type: Type.STRING, description: "Width for bbox mode." },
        height: { type: Type.STRING, description: "Height for bbox mode." },
        include_user_assets: {
          type: Type.STRING,
          description:
            "'yes' to allow deleting images/embeddables/iframes. Default is 'no'.",
        },
      },
      required: ["mode"],
    },
  },
];

const TOOL_AGENT_SYSTEM = `You are a world-class visual canvas agent. Produce one reliable, well-placed educational visual.

## Tool policy
- Use \`update_scene\` for simple whiteboard structures: basic boxes, arrows, short labels, and lightweight diagrams.
- Use \`add_svg\` for animation, for dense/high-element-count visuals, and for any diagram likely to exceed about 10-12 meaningful elements.
- If motion is requested or helpful, use \`add_svg\`. Excalidraw cannot animate.
- If the layout needs precision, many aligned items, curves, gradients, charts, or polished illustration detail, use \`add_svg\`.
- Prefer one final drawing call after planning. Extra calls should only be inspection or targeted cleanup.

## Placement policy
- Respect layout context provided in the user message.
- Treat PDFs, images, embeddables, iframes, and floating overlays as protected content.
- Place new visuals to the right of protected content with at least 150px spacing when needed.
- Never delete user assets unless the request explicitly requires it.
- If updating an existing visual, prefer \`clear_canvas_selection\` over clearing everything.

## Quality policy
- Use vibrant readable colors.
- Keep labels concise and instructional.
- Fill available space without crowding protected content.
- Always execute; do not answer with a plan instead of drawing.

=== CANVAS RULES ===
${canvasRulesDoc}
=== END CANVAS RULES ===

=== EXCALIDRAW REFERENCE ===
${excalidrawRefDoc}
=== END EXCALIDRAW REFERENCE ===`;

// ─── Execute a drawing request via the tool agent ───

export async function executeDrawingAgent(
  request: string,
  excalidrawApi: ExcalidrawAPI,
  screenBase64?: string,
): Promise<{ success: boolean; message: string }> {
  if (USE_VERTEX_AI && !VERTEX_API_KEY && !API_KEY) {
    return {
      success: false,
      message: "Missing Vertex AI API key configuration",
    };
  }

  if (!USE_VERTEX_AI && !API_KEY) {
    return { success: false, message: "Missing API key" };
  }

  const ai = createGenAIClient();
  const animationRequested =
    /\b(animat(e|ed|ion)|moving|motion|orbit(ing)?|rotat(e|ing|ion)|puls(e|ing)|flow(ing)?|spin(ning)?|wave|beat(ing)?)\b/i.test(
      request,
    );
  const MAX_DRAW_CALLS = 1;

  try {
    const layoutContext = await executeCanvasTool(
      "inspect_canvas",
      {},
      excalidrawApi,
    );
    const layoutText = layoutContext?.userContentBounds
      ? `Canvas layout context: protected content occupies x=${layoutContext.userContentBounds.x}, y=${layoutContext.userContentBounds.y}, width=${layoutContext.userContentBounds.width}, height=${layoutContext.userContentBounds.height}. Place new drawing to the right of x=${layoutContext.userContentBounds.rightEdge} with at least 150px spacing.`
      : "Canvas layout context: no protected content blocks placement.";

    // Build initial request payload
    const userParts: any[] = [
      {
        text: `${request}\n\n${layoutText}\nPrefer a single final drawing tool call unless cleanup is required first.`,
      },
    ];
    if (screenBase64) {
      userParts.push({
        text: "Here is a snapshot of my current screen. Please notice where the PDF or any user content is located, and draw your visual in the empty canvas space to avoid overlapping them.",
      });
      userParts.push({
        inlineData: { mimeType: "image/jpeg", data: screenBase64 },
      });
    }

    // Initial request to the tool agent
    let response = await ai.models.generateContent({
      model: TOOL_MODEL,
      contents: [{ role: "user", parts: userParts }],
      config: {
        systemInstruction: TOOL_AGENT_SYSTEM,
        tools: [{ functionDeclarations: toolAgentTools }],
        thinkingConfig: { thinkingBudget: TOOL_THINKING_BUDGET },
      },
    });

    const executedTools: string[] = [];
    let iterations = 0;
    const MAX_ITERATIONS = 3; // Reduced from 6 to 3 for faster response
    // Count how many drawing tool calls have been executed
    let drawingCallCount = 0;

    // Agentic loop: keep processing tool calls until the model is done
    while (iterations < MAX_ITERATIONS) {
      iterations++;

      const candidate = response.candidates?.[0];
      if (!candidate?.content?.parts) break;

      // Collect all function calls from the response
      const functionCalls = candidate.content.parts.filter(
        (p: any) => p.functionCall,
      );

      if (functionCalls.length === 0) break; // No more tool calls — model is done

      // Execute each function call
      const functionResponses: any[] = [];
      for (const part of functionCalls) {
        const fc = (part as any).functionCall;
        console.log(`[Tool Agent] Executing: ${fc.name}`, fc.args);

        let result: any;
        try {
          const isDrawingTool =
            fc.name === "update_scene" || fc.name === "add_svg";
          // Allow replacement draws (clear_first='yes') — the model is improving its output.
          // Only block duplicate appends (clear_first='no') after the first draw.
          const clearFirst = String(fc.args?.clear_first || "no")
            .toLowerCase()
            .trim();
          const isReplacement = clearFirst === "yes";
          const shouldSkipDuplicate =
            isDrawingTool &&
            drawingCallCount >= MAX_DRAW_CALLS &&
            !isReplacement;

          if (shouldSkipDuplicate) {
            result = {
              skipped: true,
              reason:
                "Only one appending drawing operation is allowed per request. Use clear_first='yes' to replace the previous drawing.",
            };
          } else if (
            isDrawingTool &&
            animationRequested &&
            fc.name !== "add_svg"
          ) {
            result = {
              skipped: true,
              reason:
                "Animation-related request detected. Use add_svg only (update_scene cannot animate).",
            };
          } else {
            result = await executeCanvasTool(
              fc.name,
              fc.args || {},
              excalidrawApi,
            );
          }
        } catch (err: any) {
          console.error(`[Tool Agent] Error executing ${fc.name}:`, err);
          result = { error: err.message || "Tool execution failed" };
        }

        executedTools.push(fc.name);
        functionResponses.push({
          name: fc.name,
          response: result,
        });

        // Track drawing tool calls
        if (
          (fc.name === "update_scene" || fc.name === "add_svg") &&
          !result?.skipped &&
          !result?.error
        ) {
          drawingCallCount++;
        }
      }

      // If no more function calls are expected (model returns text or stops), break
      // Continue the loop to allow the model to issue more tool calls (e.g., multiple add_svg for multi-animation scenes)
      // Send tool results back and let the model decide if it needs more calls
      response = await ai.models.generateContent({
        model: TOOL_MODEL,
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `${request}\n\n${layoutText}\nPrefer a single final drawing tool call unless cleanup is required first.`,
              },
            ],
          },
          { role: "model", parts: candidate.content.parts },
          {
            role: "user",
            parts: functionResponses.map((fr) => ({
              functionResponse: {
                name: fr.name,
                response: fr.response,
              },
            })),
          },
        ],
        config: {
          systemInstruction: TOOL_AGENT_SYSTEM,
          tools: [{ functionDeclarations: toolAgentTools }],
          thinkingConfig: { thinkingBudget: TOOL_THINKING_BUDGET },
        },
      });
    }

    // Extract final text response from the model
    const finalText =
      response.candidates?.[0]?.content?.parts
        ?.filter((p: any) => p.text)
        .map((p: any) => p.text)
        .join("") || "";

    return {
      success: true,
      message:
        finalText ||
        `Drawing completed. Tools used: ${executedTools.join(", ") || "none"}`,
    };
  } catch (err: any) {
    console.error("[Tool Agent] Error:", err);
    return {
      success: false,
      message: `Drawing agent error: ${err.message || err}`,
    };
  }
}
