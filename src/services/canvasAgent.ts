// ─── Canvas Tool Agent ───
// Uses Gemini 2.0 Flash to generate Excalidraw JSON / SVG from natural language requests.
// Called by the Live agent (manager) via the draw_on_canvas tool.

import { GoogleGenAI, Type } from "@google/genai";
import skillsDoc from "../skills.md?raw";
import { executeCanvasTool, type ExcalidrawAPI } from "./aiTools";

const API_KEY = (import.meta as any).env.VITE_GEMINI_API_KEY || "";
const TOOL_MODEL = "gemini-3-flash-preview";

// ─── Tool declarations the agent can call ───

const toolAgentTools = [
    {
        name: "update_scene",
        description:
            "Draw structured diagrams on the Excalidraw canvas using JSON elements. HIGHLY RECOMMENDED for: flowcharts, mind maps, architecture diagrams, matrices, tables, step-by-step math layouts, sequence diagrams, tree structures — anything primarily composed of BOXES + ARROWS + TEXT. ⚠️ CANNOT animate — has zero animation support. Never use for motion/animation. For rich illustrations needing curves/gradients/detail, use add_svg instead.",
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
                        'JSON array string of elements. Each needs type, x, y. Shapes support label.text. Example: [{"type":"rectangle","id":"a","x":100,"y":100,"width":200,"height":80,"backgroundColor":"#a5d8ff","fillStyle":"solid","label":{"text":"Box"}}]',
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
            "Add an SVG to the canvas. Supports BOTH static AND animated content. Use for: (1) ALL animations — Excalidraw has NO animation support, only SVG can animate via SMIL/CSS. (2) Rich static illustrations where Excalidraw is too limited — science diagrams, math graphs, creative art, biology, chemistry, physics, anything with curves/gradients/organic shapes. Animated SVGs auto-render as live draggable overlay panels. Multiple can coexist.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                svg_code: {
                    type: Type.STRING,
                    description:
                        'Complete <svg> element with xmlns, viewBox. Example: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><circle cx="100" cy="100" r="80" fill="#a5d8ff"/></svg>',
                },
                x: { type: Type.STRING, description: "X position (string number, default '100')" },
                y: { type: Type.STRING, description: "Y position (string number, default '100')" },
                width: { type: Type.STRING, description: "Display width (string number)" },
                height: { type: Type.STRING, description: "Display height (string number)" },
                label: { type: Type.STRING, description: "Text label below the SVG" },
            },
            required: ["svg_code"],
        },
    },
    {
        name: "get_canvas",
        description: "Returns all elements currently on the canvas as JSON.",
        parameters: {
            type: Type.OBJECT,
            properties: {},
            required: [],
        },
    },
];

const TOOL_AGENT_SYSTEM = `You are a world-class visual canvas agent. You create stunning, highly polished educational visuals.

You have two drawing tools. Choosing the RIGHT one is critical:

## ⚠️ TOOL SELECTION — FOLLOW THIS EXACTLY

┌─────────────────────────────────────────────────────────────┐
│  QUESTION 1: Does the request involve animation or motion?  │
│  (animated, moving, orbiting, pulsing, rotating, spinning,  │
│   flowing, beating, waving, etc.)                           │
│                                                             │
│  YES → use add_svg (ONLY SVG can animate. Period.)          │
│  NO  → go to Question 2                                     │
├─────────────────────────────────────────────────────────────┤
│  QUESTION 2: Is it a structured layout?                     │
│  (flowchart, mind map, matrix, table, architecture,         │
│   tree, step-by-step math, sequence diagram, state machine) │
│                                                             │
│  YES → use update_scene (Excalidraw — HIGHLY RECOMMENDED    │
│         for boxes + arrows + text layouts)                   │
│  NO  → go to Question 3                                     │
├─────────────────────────────────────────────────────────────┤
│  QUESTION 3: Everything else — rich illustrations           │
│  (science diagrams, math graphs, creative art, biology,     │
│   chemistry, physics, curves, gradients, organic shapes,    │
│   detailed drawings, icons)                                 │
│                                                             │
│  → use add_svg (SVG handles detail, curves, gradients       │
│     far better than Excalidraw's limited shapes)            │
└─────────────────────────────────────────────────────────────┘

Summary:
- add_svg supports BOTH static AND animated SVGs
- update_scene (Excalidraw JSON) supports ONLY static structured layouts — NO animation capability whatsoever
- NEVER attempt animation with update_scene. It will silently fail.
- NEVER use update_scene for illustrations that need curves, gradients, or fine detail — Excalidraw is limited to basic geometric shapes.
- DO use update_scene when the visual is primarily boxes, arrows, and text — it excels there.
- Keep outputs simple and neat; avoid generating duplicate visuals.

## VISUAL QUALITY STANDARDS (MANDATORY)
- **Vibrant colors always.** Never black & white. Use gradients (\`<linearGradient>\`, \`<radialGradient>\`) for depth.
- **Visual polish:** drop shadows, rounded shapes, varying stroke widths, subtle transparency.
- **Layer elements:** backgrounds → mid-ground → foreground.
- **Size generously:** SVGs 400–700px. Diagrams should fill available space.
- **Color semantics:** Blue=info, Green=success, Yellow=decision, Red=danger, Purple=special.

## ANIMATION RULES (SVG ONLY)
- Use SMIL: \`<animate>\`, \`<animateTransform>\`, \`<animateMotion>\`, \`<set>\`
- Or CSS \`@keyframes\` + \`animation:\` inside \`<style>\`
- \`repeatCount="indefinite"\` for loops, \`dur="2s"\`–\`dur="4s"\` for pleasant speed
- System auto-detects animated SVGs → renders as live draggable overlay panels
- Use animation only if the user asked for it or motion is essential to explanation
- Prefer one animation overlay at a time unless user explicitly requests multiple
- Keep animation overlays away from core diagram labels/content (no clutter/overlap)

## GENERAL RULES
- **ALWAYS call get_canvas FIRST** to see existing content and avoid overlapping.
- If images or embeddable elements (YouTube videos, iframes) exist, place new content to the RIGHT with 150px+ spacing.
- **NEVER clear/remove user images OR embedded videos (YouTube, iframes).** These are user-placed content and must always be preserved.
- Embeddable elements have type "embeddable" or "iframe" — treat them identically to images when deciding placement and preservation.
- If a similar diagram already exists, do NOT redraw it; refine or append only what is missing.
- Always execute — never just describe what you would draw.
- SVGs must have \`xmlns\` and \`viewBox\`.
- Combine both tools only when truly needed; default to one clean visual path.

=== CANVAS SKILLS REFERENCE ===
${skillsDoc}
=== END SKILLS REFERENCE ===`;

// ─── Execute a drawing request via the tool agent ───

export async function executeDrawingAgent(
    request: string,
    excalidrawApi: ExcalidrawAPI
): Promise<{ success: boolean; message: string }> {
    if (!API_KEY) {
        return { success: false, message: "Missing API key" };
    }

    const ai = new GoogleGenAI({ apiKey: API_KEY });
    const animationRequested = /\b(animat(e|ed|ion)|moving|motion|orbit(ing)?|rotat(e|ing|ion)|puls(e|ing)|flow(ing)?|spin(ning)?|wave|beat(ing)?)\b/i.test(request);
    const MAX_DRAW_CALLS = 1;

    try {
        // Initial request to the tool agent
        let response = await ai.models.generateContent({
            model: TOOL_MODEL,
            contents: [{ role: "user", parts: [{ text: request }] }],
            config: {
                systemInstruction: TOOL_AGENT_SYSTEM,
                tools: [{ functionDeclarations: toolAgentTools }],
                thinkingConfig: { thinkingBudget: 0 }, // disable thinking for speed
            },
        });

        const executedTools: string[] = [];
        let iterations = 0;
        const MAX_ITERATIONS = 6;
        // Count how many drawing tool calls have been executed
        let drawingCallCount = 0;

        // Agentic loop: keep processing tool calls until the model is done
        while (iterations < MAX_ITERATIONS) {
            iterations++;

            const candidate = response.candidates?.[0];
            if (!candidate?.content?.parts) break;

            // Collect all function calls from the response
            const functionCalls = candidate.content.parts.filter(
                (p: any) => p.functionCall
            );

            if (functionCalls.length === 0) break; // No more tool calls — model is done

            // Execute each function call
            const functionResponses: any[] = [];
            for (const part of functionCalls) {
                const fc = (part as any).functionCall;
                console.log(`[Tool Agent] Executing: ${fc.name}`, fc.args);

                let result: any;
                try {
                    const isDrawingTool = fc.name === "update_scene" || fc.name === "add_svg";

                    if (isDrawingTool && drawingCallCount >= MAX_DRAW_CALLS) {
                        result = {
                            skipped: true,
                            reason: "Only one drawing operation is allowed per request to keep output clean and non-duplicative.",
                        };
                    } else if (isDrawingTool && animationRequested && fc.name !== "add_svg") {
                        result = {
                            skipped: true,
                            reason: "Animation-related request detected. Use add_svg only (update_scene cannot animate).",
                        };
                    } else {
                        result = await executeCanvasTool(fc.name, fc.args || {}, excalidrawApi);
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
                if ((fc.name === "update_scene" || fc.name === "add_svg") && !result?.skipped && !result?.error) {
                    drawingCallCount++;
                }
            }

            // If no more function calls are expected (model returns text or stops), break
            // Continue the loop to allow the model to issue more tool calls (e.g., multiple add_svg for multi-animation scenes)
            // Send tool results back and let the model decide if it needs more calls
            response = await ai.models.generateContent({
                model: TOOL_MODEL,
                contents: [
                    { role: "user", parts: [{ text: request }] },
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
                    thinkingConfig: { thinkingBudget: 0 },
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
