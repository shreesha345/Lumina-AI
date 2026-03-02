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
            "Draw on the Excalidraw canvas. elements_json is a JSON array string of elements. clear_first: 'yes' to clear canvas first, 'no' to append, 'pointer' to show a laser pointer at pointer_x/pointer_y, 'clear_pointer' to remove pointer, 'clear_all' to clear everything.",
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
            "Add an SVG illustration to the canvas. Use for creative drawings, icons, science diagrams, math notation, or anything needing curves/paths/gradients.",
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

const TOOL_AGENT_SYSTEM = `You are a canvas drawing agent. You receive drawing/diagram requests and execute them using your tools.

You have these tools:
- update_scene: Draw shapes, arrows, text, diagrams on the Excalidraw canvas
- add_svg: Add SVG illustrations (hearts, stars, animals, creative art, science diagrams, etc.)
- get_canvas: Check what's currently on the canvas

IMPORTANT RULES:
- **ALWAYS call get_canvas FIRST** before drawing anything. This lets you see existing content (especially user-uploaded images) and avoid overlapping them.
- If the canvas has **images**, you MUST place your new content to the RIGHT of them with at least 150px spacing. Use the imageBounds.rightEdge value from get_canvas to calculate your starting x position. For example, if rightEdge is 600, start your content at x >= 750.
- **NEVER clear or remove images.** When using clear_first: 'yes', images are automatically preserved — but you still need to position your content beside them.
- Always execute the drawing. Never just describe what you would draw — actually call the tools.
- Use vibrant colors. Never default to black and white.
- For creative/artistic requests (hearts, stars, flowers, animals, etc.) → use add_svg
- For diagrams, flowcharts, concept maps → use update_scene
- You can call multiple tools in sequence if needed
- Keep SVGs clean with xmlns and viewBox attributes

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
        const MAX_ITERATIONS = 3; // reduced — drawing should complete in 1-2 iterations
        // Track whether a drawing tool has been executed (update_scene or add_svg)
        let drawingDone = false;

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
                    result = await executeCanvasTool(fc.name, fc.args || {}, excalidrawApi);
                } catch (err: any) {
                    console.error(`[Tool Agent] Error executing ${fc.name}:`, err);
                    result = { error: err.message || "Tool execution failed" };
                }

                executedTools.push(fc.name);
                functionResponses.push({
                    name: fc.name,
                    response: result,
                });

                // If a drawing tool was executed, mark done
                if (fc.name === "update_scene" || fc.name === "add_svg") {
                    drawingDone = true;
                }
            }

            // If we already drew something, return immediately — no need for another round-trip
            if (drawingDone) {
                console.log(`[Tool Agent] Drawing complete after ${iterations} iteration(s), skipping further rounds.`);
                break;
            }

            // Only loop back for read-only tool calls (e.g., get_canvas)
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
