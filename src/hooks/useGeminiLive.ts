import { useRef, useState, useCallback, useEffect } from "react";
import { GoogleGenAI, Modality, StartSensitivity, EndSensitivity } from "@google/genai";
import { exportToBlob } from "@excalidraw/excalidraw";
import {
    canvasToolDeclarations,
    executeCanvasTool,
    type ExcalidrawAPI,
} from "../services/aiTools";
import { executeDrawingAgent } from "../services/canvasAgent";
import { geminiLiveSystemInstruction } from "../prompts";

const API_KEY = (import.meta as any).env.VITE_GEMINI_API_KEY || "";
const VERTEX_API_KEY = (import.meta as any).env.VITE_VERTEX_API_KEY || "";
const GOOGLE_CLOUD_PROJECT = (import.meta as any).env.VITE_GOOGLE_CLOUD_PROJECT || "";
const GOOGLE_CLOUD_LOCATION_LIVE = (import.meta as any).env.VITE_GOOGLE_CLOUD_LOCATION_LIVE || (import.meta as any).env.VITE_GOOGLE_CLOUD_LOCATION || "global";
const GOOGLE_CLOUD_LOCATION_TOOLS = (import.meta as any).env.VITE_GOOGLE_CLOUD_LOCATION_TOOLS || (import.meta as any).env.VITE_GOOGLE_CLOUD_LOCATION || "global";
const USE_VERTEX_AI =
    ((import.meta as any).env.VITE_GOOGLE_GENAI_USE_VERTEXAI || "").toLowerCase() === "true";
const MODEL = (import.meta as any).env.VITE_GEMINI_LIVE_MODEL || "gemini-live-2.5-flash-native-audio";
const VISION_MODEL = (import.meta as any).env.VITE_GEMINI_VISION_MODEL || "gemini-2.5-flash"; // REST fallback model for image analysis if direct live image send is unavailable
const SCREEN_FRAME_INTERVAL_MS = 1200;
const liveFunctionDeclarations = canvasToolDeclarations.filter((d: any) => d.name !== "view_screen");

function createGenAIClient() {
    if (USE_VERTEX_AI) {
        const baseUrl = GOOGLE_CLOUD_LOCATION_TOOLS && GOOGLE_CLOUD_LOCATION_TOOLS !== "global"
            ? `https://${GOOGLE_CLOUD_LOCATION_TOOLS}-aiplatform.googleapis.com/`
            : `https://aiplatform.googleapis.com/`;
        return new GoogleGenAI({
            vertexai: true,
            apiKey: VERTEX_API_KEY || API_KEY,
            httpOptions: { baseUrl },
        });
    }

    return new GoogleGenAI({ apiKey: API_KEY });
}

// ─── Vertex AI Live browser workaround ───
// The browser WebSocket constructor cannot send custom headers.
// The SDK sets the API key via headers, so it never reaches the Vertex endpoint → 1008 close.
// Workaround: temporarily patch globalThis.WebSocket to append the API key as a URL query
// parameter (same pattern the SDK uses for the Gemini API path).
// The patch is removed immediately after the connection is established.
function patchWebSocketForVertexAuth(): (() => void) | null {
    if (!USE_VERTEX_AI) return null;
    const apiKey = VERTEX_API_KEY || API_KEY;
    if (!apiKey) return null;

    // Determine the correct regional WebSocket host
    const wsHost = GOOGLE_CLOUD_LOCATION_LIVE && GOOGLE_CLOUD_LOCATION_LIVE !== "global"
        ? `${GOOGLE_CLOUD_LOCATION_LIVE}-aiplatform.googleapis.com`
        : `aiplatform.googleapis.com`;

    const OriginalWebSocket = globalThis.WebSocket;
    const PatchedWebSocket = function (this: WebSocket, url: string | URL, protocols?: string | string[]) {
        let urlStr = typeof url === "string" ? url : url.toString();
        // Fix double-slash from SDK base URL trailing slash + /ws path
        urlStr = urlStr.replace("://aiplatform.googleapis.com//", "://aiplatform.googleapis.com/");
        // Rewrite global endpoint to regional if needed
        if (wsHost !== "aiplatform.googleapis.com") {
            urlStr = urlStr.replace("://aiplatform.googleapis.com/", `://${wsHost}/`);
        }
        if (urlStr.includes("aiplatform.googleapis.com") && !urlStr.includes("key=")) {
            urlStr += (urlStr.includes("?") ? "&" : "?") + "key=" + encodeURIComponent(apiKey);
        }
        return new OriginalWebSocket(urlStr, protocols);
    } as unknown as typeof WebSocket;
    // Preserve static members so instanceof / readyState constants still work
    Object.defineProperty(PatchedWebSocket, "prototype", { value: OriginalWebSocket.prototype, writable: false });
    Object.defineProperty(PatchedWebSocket, "CONNECTING", { value: OriginalWebSocket.CONNECTING, writable: false });
    Object.defineProperty(PatchedWebSocket, "OPEN", { value: OriginalWebSocket.OPEN, writable: false });
    Object.defineProperty(PatchedWebSocket, "CLOSING", { value: OriginalWebSocket.CLOSING, writable: false });
    Object.defineProperty(PatchedWebSocket, "CLOSED", { value: OriginalWebSocket.CLOSED, writable: false });

    globalThis.WebSocket = PatchedWebSocket;
    return () => { globalThis.WebSocket = OriginalWebSocket; };
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
    let binary = "";
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

function base64ToArrayBuffer(base64: string) {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
}

interface UseGeminiLiveOptions {
    excalidrawApiRef: React.RefObject<ExcalidrawAPI | null>;
    getPdfSelectionContext?: () => any;
}

export function useGeminiLive({ excalidrawApiRef, getPdfSelectionContext }: UseGeminiLiveOptions) {
    const [isConnected, setIsConnected] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false); // true between send & first AI response
    const [isResponding, setIsResponding] = useState(false);
    const [isDrawing, setIsDrawing] = useState(false); // true when AI is calling canvas tools
    const [isScreenSharing, setIsScreenSharing] = useState(false);
    const [isHandsFreeMode, setIsHandsFreeMode] = useState(false);

    // Mic capture refs
    const micContextRef = useRef<AudioContext | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const micWorkletRef = useRef<AudioWorkletNode | null>(null);

    // Playback refs
    const playContextRef = useRef<AudioContext | null>(null);
    const playWorkletRef = useRef<AudioWorkletNode | null>(null);

    // Screen Share refs
    const screenStreamRef = useRef<MediaStream | null>(null);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const screenFrameTimerRef = useRef<number | null>(null);
    const lastScreenFrameSentAtRef = useRef(0);

    // GenAI session
    const sessionRef = useRef<any>(null);

    // Tool call processing lock — prevents overlapping tool calls
    const toolCallInProgressRef = useRef(false);
    const toolCallQueueRef = useRef<any[]>([]);

    // Mute audio/screen sending during tool call processing to prevent 1011 errors
    const sendingPausedRef = useRef(false);

    // Whether the mic is "live" (sending audio to Gemini) — toggled by PTT
    const micLiveRef = useRef(false);

    // Auto-reconnect counter for 1008 server errors
    const reconnectAttemptsRef = useRef(0);
    const MAX_RECONNECT_ATTEMPTS = 3;

    // Prevent double-connect from React StrictMode
    const connectingRef = useRef(false);

    // ─── Playback engine using AudioWorklet ───
    const startPlaybackEngine = useCallback(async () => {
        if (playContextRef.current) {
            if (playContextRef.current.state === "suspended") {
                try { await playContextRef.current.resume(); } catch (e) { }
            }
            if (playContextRef.current.state === "running") {
                return;
            }
        }

        const ctx = new AudioContext({ sampleRate: 24000 });
        if (ctx.state === "suspended") {
            await ctx.resume();
        }
        playContextRef.current = ctx;

        try { await ctx.audioWorklet.addModule("/playback-processor.js"); } catch (e) { return; }
        if (ctx.state === "closed") return;

        const playNode = new AudioWorkletNode(ctx, "playback-processor");
        playWorkletRef.current = playNode;
        playNode.connect(ctx.destination);
    }, []);

    const stopPlaybackEngine = useCallback(() => {
        if (playWorkletRef.current) {
            playWorkletRef.current.disconnect();
            playWorkletRef.current = null;
        }
        if (playContextRef.current && playContextRef.current.state !== "closed") {
            playContextRef.current.close();
        }
        playContextRef.current = null;
    }, []);

    const isSocketOpen = (s: any) => {
        if (!s) return false;
        // SDK structure: session.conn (wrapper) → conn.ws (native WebSocket)
        const ws = s.conn?.ws || s.conn;
        if (ws && typeof ws.readyState === "number") return ws.readyState === WebSocket.OPEN;
        // If we can't inspect the socket, assume open (sends are wrapped in try-catch)
        return true;
    };

    const sendAudioStreamEndSignal = useCallback(() => {
        const session = sessionRef.current;
        if (!session || !isSocketOpen(session)) return;

        try {
            session.sendRealtimeInput({ audioStreamEnd: true });
            console.log("[Gemini Live] Sent audioStreamEnd");
        } catch (err: any) {
            console.warn("[Gemini Live] Failed to send audioStreamEnd:", err?.message || err);
        }
    }, []);

    // ─── Manual activity signals (required when automaticActivityDetection is disabled) ───
    const sendActivityStart = useCallback(() => {
        const session = sessionRef.current;
        if (!session || !isSocketOpen(session)) return;
        try {
            session.sendRealtimeInput({ activityStart: {} });
            console.log("[Gemini Live] Sent activityStart");
        } catch (err: any) {
            console.warn("[Gemini Live] Failed to send activityStart:", err?.message || err);
        }
    }, []);

    const sendActivityEnd = useCallback(() => {
        const session = sessionRef.current;
        if (!session || !isSocketOpen(session)) return;
        try {
            session.sendRealtimeInput({ activityEnd: {} });
            console.log("[Gemini Live] Sent activityEnd");
        } catch (err: any) {
            console.warn("[Gemini Live] Failed to send activityEnd:", err?.message || err);
        }
    }, []);

    // ─── Analyze an image via Gemini REST API (since native audio model can't receive images) ───
    const analyzeImageViaRest = useCallback(async (base64Data: string, mimeType: string, prompt: string): Promise<string> => {
        try {
            const ai = createGenAIClient();
            const response = await ai.models.generateContent({
                model: VISION_MODEL,
                contents: [{
                    role: "user",
                    parts: [
                        {
                            inlineData: {
                                mimeType,
                                data: base64Data,
                            },
                        },
                        { text: prompt },
                    ],
                }],
            });
            return response?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("") || "Could not analyze the image.";
        } catch (err: any) {
            console.error("[Gemini Live] REST image analysis error:", err);
            return "Failed to analyze image: " + (err?.message || err);
        }
    }, []);

    // ─── Capture a frame from a <video> element as base64 JPEG ───
    const captureFrameFromVideo = useCallback((video: HTMLVideoElement): string | null => {
        if (!video || video.videoWidth === 0 || video.videoHeight === 0) return null;
        const canvas = document.createElement("canvas");
        // Scale down to max 1024 on longest side (like the Python script)
        const scale = Math.min(1, 1024 / Math.max(video.videoWidth, video.videoHeight));
        canvas.width = Math.round(video.videoWidth * scale);
        canvas.height = Math.round(video.videoHeight * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) return null;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
        return dataUrl.split(",")[1];
    }, []);

    // ─── Send one image frame directly to Gemini Live session ───
    const sendImageFrameToLiveSession = useCallback((base64Data: string, mimeType: string): boolean => {
        const session = sessionRef.current;
        if (!session || !isSocketOpen(session)) return false;
        try {
            session.sendRealtimeInput({
                media: {
                    data: base64Data,
                    mimeType,
                },
            });
            return true;
        } catch (err: any) {
            console.warn("[Gemini Live] Failed to send image frame to live session:", err?.message || err);
            return false;
        }
    }, []);

    const stopScreenFrameStream = useCallback(() => {
        if (screenFrameTimerRef.current != null) {
            window.clearInterval(screenFrameTimerRef.current);
            screenFrameTimerRef.current = null;
        }
    }, []);

    const startScreenFrameStream = useCallback(() => {
        stopScreenFrameStream();
        screenFrameTimerRef.current = window.setInterval(() => {
            if (sendingPausedRef.current) return;
            const video = videoRef.current;
            if (!video || video.videoWidth === 0 || video.videoHeight === 0) return;

            const now = Date.now();
            if (now - lastScreenFrameSentAtRef.current < SCREEN_FRAME_INTERVAL_MS - 100) return;

            const base64Data = captureFrameFromVideo(video);
            if (!base64Data) return;

            const sent = sendImageFrameToLiveSession(base64Data, "image/jpeg");
            if (sent) {
                lastScreenFrameSentAtRef.current = now;
            }
        }, SCREEN_FRAME_INTERVAL_MS);
    }, [captureFrameFromVideo, sendImageFrameToLiveSession, stopScreenFrameStream]);

    // ─── Screen Sharing ───
    const startScreenShare = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    displaySurface: "browser",
                },
                audio: false,
                // @ts-ignore
                preferCurrentTab: true,
            });
            screenStreamRef.current = stream;

            const video = document.createElement("video");
            video.autoplay = true;
            video.playsInline = true;
            video.muted = true;
            video.srcObject = stream;

            await new Promise<void>((resolve) => {
                video.onloadedmetadata = () => {
                    video.play().then(() => resolve()).catch(() => resolve());
                };
            });

            videoRef.current = video;
            setIsScreenSharing(true);
            // Stream frames directly to Gemini Live so it can see the screen natively.
            startScreenFrameStream();
            console.log("[Gemini Live] Screen share started (direct live frame streaming)");

            stream.getVideoTracks()[0].onended = () => {
                stopScreenFrameStream();
                screenStreamRef.current = null;
                if (videoRef.current) {
                    videoRef.current.pause();
                    videoRef.current.srcObject = null;
                    videoRef.current = null;
                }
                setIsScreenSharing(false);
            };
        } catch (err) {
            console.error("[Gemini Live] Error accessing screen share:", err);
            setIsScreenSharing(false);
        }
    }, [startScreenFrameStream, stopScreenFrameStream]);

    const stopScreenShare = useCallback(() => {
        stopScreenFrameStream();
        if (screenStreamRef.current) {
            screenStreamRef.current.getTracks().forEach((t) => t.stop());
            screenStreamRef.current = null;
        }
        if (videoRef.current) {
            videoRef.current.pause();
            videoRef.current.srcObject = null;
            videoRef.current = null;
        }
        setIsScreenSharing(false);
    }, [stopScreenFrameStream]);

    const captureScreenSnapshot = useCallback(async (): Promise<any> => {
        const video = videoRef.current;
        if (!video || !screenStreamRef.current) {
            return { error: "Screen sharing is not active. The user needs to share their screen first." };
        }

        try {
            if (video.videoWidth === 0 || video.videoHeight === 0) {
                await video.play().catch(e => console.warn("Play failed:", e));
            }

            const base64Data = captureFrameFromVideo(video);
            if (!base64Data) {
                return { error: "Failed to capture screen frame — video feed may not be ready." };
            }

            // Prefer direct frame delivery to the live session so Gemini sees the image natively.
            const sentDirectly = sendImageFrameToLiveSession(base64Data, "image/jpeg");
            if (sentDirectly) {
                console.log("[Gemini Live] Screen snapshot sent directly to live session");
                return {
                    success: true,
                    message: "A fresh screen image has been sent directly to you. Analyze it and answer the user based on what you see.",
                };
            }

            // Fallback: REST analysis when direct live image send is unavailable.
            console.log("[Gemini Live] Direct image send unavailable — analyzing screen snapshot via REST API...");
            const description = await analyzeImageViaRest(
                base64Data,
                "image/jpeg",
                "Describe what you see on this screen in detail. Include any text, UI elements, video content, diagrams, code, or other visible information. Be thorough but concise."
            );

            console.log("[Gemini Live] Screen snapshot analyzed (REST fallback)");
            return {
                success: true,
                message: `Here is what's on the user's screen:\n\n${description}`,
            };
        } catch (err: any) {
            console.error("[Gemini Live] Screen capture error:", err);
            return { error: "Failed to capture screen: " + (err?.message || err) };
        }
    }, [captureFrameFromVideo, analyzeImageViaRest, sendImageFrameToLiveSession]);

    // ─── Capture the Excalidraw canvas as an image for the view_canvas tool ───
    const captureCanvasSnapshot = useCallback(async (): Promise<any> => {
        const api = excalidrawApiRef.current;
        if (!api) {
            return { error: "Canvas API not available." };
        }

        const elements = api.getSceneElements().filter((e: any) => !e.isDeleted);
        if (elements.length === 0) {
            return { success: true, message: "The canvas is empty — nothing to see." };
        }

        try {
            const blob = await exportToBlob({
                elements,
                appState: {
                    ...api.getAppState(),
                    exportWithDarkMode: false,
                    exportBackground: true,
                },
                files: api.getFiles(),
                maxWidthOrHeight: 1024,
            });

            // Convert blob to base64
            const arrayBuffer = await blob.arrayBuffer();
            const bytes = new Uint8Array(arrayBuffer);
            let binary = "";
            for (let i = 0; i < bytes.byteLength; i++) {
                binary += String.fromCharCode(bytes[i]);
            }
            const base64Data = btoa(binary);

            // Analyze the canvas image via Gemini REST API (native audio model can't receive images)
            console.log(`[Gemini Live] Analyzing canvas snapshot via REST API (${elements.length} elements)...`);
            const description = await analyzeImageViaRest(
                base64Data,
                "image/png",
                "Describe what you see on this whiteboard/canvas in detail. Include all diagrams, shapes, text, arrows, colors, layout, and any other visual elements. Be thorough so someone could understand the full content without seeing the image."
            );

            console.log(`[Gemini Live] Canvas snapshot analyzed (${elements.length} elements)`);
            return {
                success: true,
                message: `Canvas has ${elements.length} elements. Here is what's drawn:\n\n${description}`,
            };
        } catch (err: any) {
            console.error("[Gemini Live] Canvas export error:", err);
            return { error: "Failed to export canvas: " + (err?.message || err) };
        }
    }, [excalidrawApiRef, analyzeImageViaRest]);

    // ─── Return the current marked PDF region/page for explanation ───
    const capturePdfSelection = useCallback(async (): Promise<any> => {
        const ctx = getPdfSelectionContext ? getPdfSelectionContext() : null;
        if (!ctx || !ctx.imageBase64) {
            return {
                error: "No marked PDF selection is available. Ask the user to open the PDF panel, mark a region (or keep full page), then try again.",
            };
        }

        try {
            const selectionInfo = ctx.hasSelection && ctx.selectionRect
                ? `Marked region x=${ctx.selectionRect.x}, y=${ctx.selectionRect.y}, w=${ctx.selectionRect.width}, h=${ctx.selectionRect.height}`
                : "No region marked; using full visible PDF page";

            // Prefer direct live frame delivery first.
            const sentDirectly = sendImageFrameToLiveSession(ctx.imageBase64, ctx.mimeType || "image/png");
            if (sentDirectly) {
                return {
                    success: true,
                    message: `PDF snapshot sent directly. File: ${ctx.fileName}, page ${ctx.pageNumber}/${ctx.totalPages}, zoom ${Math.round((ctx.zoom || 1) * 100)}%. ${selectionInfo}. Analyze and explain this content.`
                };
            }

            // Fallback: run REST vision analysis and send textual result.
            const description = await analyzeImageViaRest(
                ctx.imageBase64,
                ctx.mimeType || "image/png",
                "You are reading a marked area from a PDF. Extract and explain what is visible: text, equations, diagrams, axes, labels, tables, and symbols. If the image is partial, infer local context only and mention uncertainty when needed."
            );

            return {
                success: true,
                message: `PDF context (${ctx.fileName}, page ${ctx.pageNumber}/${ctx.totalPages}, zoom ${Math.round((ctx.zoom || 1) * 100)}%): ${selectionInfo}.\n\nExtracted content:\n${description}`,
            };
        } catch (err: any) {
            return { error: "Failed to analyze PDF selection: " + (err?.message || err) };
        }
    }, [analyzeImageViaRest, getPdfSelectionContext, sendImageFrameToLiveSession]);

    // ─── Process a single tool call message ───
    const processToolCall = useCallback(
        async (toolCallMessage: any) => {
            const session = sessionRef.current;
            if (!session || !toolCallMessage.toolCall?.functionCalls) return;

            setIsDrawing(true);
            // Pause mic/screen sending during tool execution to avoid overwhelming the session
            sendingPausedRef.current = true;
            console.log("[Gemini Live] Tool call received:", toolCallMessage.toolCall.functionCalls);

            const functionResponses: any[] = [];

            for (const fc of toolCallMessage.toolCall.functionCalls) {
                console.log(`[Gemini Live] Executing tool: ${fc.name}`, fc.args);

                let result: any;
                try {
                    // Handle view_canvas locally — it needs access to excalidraw API & session
                    if (fc.name === "view_canvas") {
                        result = await captureCanvasSnapshot();
                    } else if (fc.name === "view_pdf_selection") {
                        result = await capturePdfSelection();
                    } else if (fc.name === "view_screen") {
                        result = await captureScreenSnapshot();
                    } else if (fc.name === "inspect_canvas") {
                        // Return structured canvas data (element types, positions, image bounds)
                        const api = excalidrawApiRef.current;
                        if (api) {
                            result = await executeCanvasTool("inspect_canvas", {}, api);
                        } else {
                            result = { error: "Canvas API not available" };
                        }
                    } else if (fc.name === "draw_on_canvas") {
                        // Delegate to the Gemini 2.0 Flash canvas agent
                        const api = excalidrawApiRef.current;
                        if (api) {
                            const request = fc.args?.request || "";
                            console.log(`[Gemini Live] Delegating to canvas agent: "${request}"`);
                            result = await executeDrawingAgent(request, api);
                        } else {
                            result = { error: "Canvas API not available" };
                        }
                    } else {
                        const api = excalidrawApiRef.current;
                        if (api) {
                            result = await executeCanvasTool(fc.name, fc.args || {}, api);
                        } else {
                            result = { error: "Canvas API not available" };
                        }
                    }
                } catch (err: any) {
                    console.error(`[Gemini Live] Tool execution error:`, err);
                    result = { error: err.message || "Tool execution failed" };
                }

                // For view_screen the result is already final (no _screenCapture indirection)

                console.log(`[Gemini Live] Tool result for ${fc.name}:`, result);

                functionResponses.push({
                    id: fc.id,
                    name: fc.name,
                    response: result,
                });
            }

            // Send tool response back to the model
            try {
                if (isSocketOpen(session)) {
                    session.sendToolResponse({ functionResponses });
                    console.log("[Gemini Live] Tool response sent successfully");
                } else {
                    console.warn("[Gemini Live] Session closed before tool response could be sent");
                }
            } catch (err: any) {
                console.error("[Gemini Live] Failed to send tool response:", err?.message || err);
            }

            sendingPausedRef.current = false;
            setIsDrawing(false);
        },
        [captureCanvasSnapshot, capturePdfSelection, captureScreenSnapshot, excalidrawApiRef]
    );

    // ─── Handle tool calls with queue to prevent overlapping ───
    const handleToolCall = useCallback(
        async (toolCallMessage: any) => {
            // If a tool call is already in progress, queue it
            if (toolCallInProgressRef.current) {
                console.log("[Gemini Live] Queuing tool call (another in progress)");
                toolCallQueueRef.current.push(toolCallMessage);
                return;
            }

            toolCallInProgressRef.current = true;

            try {
                await processToolCall(toolCallMessage);
            } finally {
                toolCallInProgressRef.current = false;

                // Process any queued tool calls
                if (toolCallQueueRef.current.length > 0) {
                    const next = toolCallQueueRef.current.shift()!;
                    // Use setTimeout to avoid deep async recursion in the message handler
                    setTimeout(() => handleToolCall(next), 0);
                }
            }
        },
        [processToolCall]
    );

    // ─── Connect to Gemini Live ───
    const connect = useCallback(async () => {
        if (sessionRef.current || connectingRef.current) return;
        connectingRef.current = true;

        const effectiveKey = USE_VERTEX_AI ? (VERTEX_API_KEY || API_KEY) : API_KEY;
        if (!effectiveKey) {
            const missing = USE_VERTEX_AI ? "VITE_VERTEX_API_KEY" : "VITE_GEMINI_API_KEY";
            console.error(`Missing ${missing} in .env`);
            alert(`Missing ${missing} in environment variables (.env)`);
            connectingRef.current = false;
            return;
        }

        // Patch WebSocket so the API key is sent as a URL query param (browser limitation workaround)
        const restoreWebSocket = patchWebSocketForVertexAuth();

        try {
            const ai = createGenAIClient();
            console.log(USE_VERTEX_AI ? "[Gemini Live] Connecting via Vertex AI" : "[Gemini Live] Connecting via Gemini API");

            // Vertex AI needs the fully-qualified model resource path;
            // the browser SDK can't build it (no project/location on client).
            const liveModel = USE_VERTEX_AI
                ? `projects/${GOOGLE_CLOUD_PROJECT}/locations/${GOOGLE_CLOUD_LOCATION_LIVE}/publishers/google/models/${MODEL}`
                : MODEL;

            const session = await ai.live.connect({
                model: liveModel,
                config: {
                    responseModalities: [Modality.AUDIO],
                    systemInstruction: geminiLiveSystemInstruction,
                    speechConfig: {
                        voiceConfig: {
                            prebuiltVoiceConfig: {
                                voiceName: "Aoede",
                            },
                        },
                    },
                    realtimeInputConfig: {
                        automaticActivityDetection: {
                            disabled: true, // Disable automatic VAD - user controls when to send via button
                        },
                    },
                    tools: [
                        {
                            functionDeclarations: liveFunctionDeclarations,
                        },
                    ],
                },
                callbacks: {
                    onopen: () => {
                        console.log("Connected to Gemini Live API with canvas tools");
                        setIsConnected(true);
                        reconnectAttemptsRef.current = 0;  // Reset on successful connect
                    },
                    onmessage: (message: any) => {
                        // ── Handle tool call cancellation ──
                        if (message.toolCallCancellation) {
                            console.log("[Gemini Live] Tool call cancelled:", message.toolCallCancellation.ids);
                            // Clear queued tool calls that were cancelled
                            toolCallQueueRef.current = [];
                            toolCallInProgressRef.current = false;
                            sendingPausedRef.current = false;
                            setIsDrawing(false);
                            return;
                        }

                        // ── Handle tool calls ──
                        if (message.toolCall) {
                            // handleToolCall is async but we intentionally don't await here
                            // because onmessage is a sync callback. The queue system ensures
                            // tool calls are processed sequentially.
                            handleToolCall(message);
                            return;
                        }

                        // ── Handle interruption — clear playback buffer ──
                        if (message.serverContent?.interrupted) {
                            setIsProcessing(false);
                            setIsResponding(false);
                            if (playWorkletRef.current) {
                                playWorkletRef.current.port.postMessage("clear");
                            }
                            return;
                        }

                        // ── Turn complete — model finished responding ──
                        if (message.serverContent?.turnComplete) {
                            // Don't clear responding state if a tool call is in progress
                            // — the AI will resume speaking after the tool result comes back
                            if (!toolCallInProgressRef.current && toolCallQueueRef.current.length === 0) {
                                setIsProcessing(false);
                                setIsResponding(false);
                            }
                            return;
                        }

                        // ── Audio response ──
                        if (message.serverContent?.modelTurn?.parts) {
                            setIsProcessing(false);
                            setIsResponding(true);
                            for (const part of message.serverContent.modelTurn.parts) {
                                if (part.inlineData?.data) {
                                    const arrayBuffer = base64ToArrayBuffer(part.inlineData.data);
                                    if (playWorkletRef.current) {
                                        playWorkletRef.current.port.postMessage(arrayBuffer, [
                                            arrayBuffer,
                                        ]);
                                    }
                                }
                            }
                        }
                    },
                    onerror: (e: any) => {
                        console.error("Gemini Live error:", e?.message || e);
                    },
                    onclose: (e: any) => {
                        console.log("Gemini Live closed:", e);
                        setIsConnected(false);
                        setIsProcessing(false);
                        setIsResponding(false);
                        setIsDrawing(false);
                        sessionRef.current = null;

                        // Clear any pending tool calls
                        toolCallQueueRef.current = [];
                        toolCallInProgressRef.current = false;
                        sendingPausedRef.current = false;

                        // Clean up mic
                        teardownMicPipeline();

                        stopPlaybackEngine();
                        setIsRecording(false);

                        // Auto-reconnect only on transient server errors (1011 = internal error)
                        // 1008 = "not supported" — not transient, don't retry
                        const closeCode = e?.code || e;
                        const isTransientError = closeCode === 1011;
                        if (isTransientError && reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
                            reconnectAttemptsRef.current++;
                            const delay = 2000 * reconnectAttemptsRef.current; // exponential-ish backoff
                            console.log(`[Gemini Live] ${closeCode} server error — auto-reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})...`);
                            setTimeout(() => {
                                connect();
                            }, delay);
                        } else if (isTransientError) {
                            console.warn("[Gemini Live] Max reconnect attempts reached. Please try again manually.");
                            reconnectAttemptsRef.current = 0;
                        }
                    },
                },
            });

            sessionRef.current = session;
        } catch (e) {
            console.error("Error connecting to Gemini", e);
        } finally {
            // Restore original WebSocket constructor after connection is established
            restoreWebSocket?.();
            connectingRef.current = false;
        }
    }, [handleToolCall, stopPlaybackEngine]);



    // ─── Ensure mic pipeline is set up (idempotent — only runs once) ───
    const ensureMicPipeline = useCallback(async () => {
        // Already set up
        if (micWorkletRef.current && micContextRef.current?.state !== "closed") return;

        const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
                sampleRate: 16000,
                channelCount: 1,
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
            },
        });
        mediaStreamRef.current = stream;

        const audioCtx = new AudioContext({ sampleRate: 16000 });
        if (audioCtx.state === "suspended") {
            try { await audioCtx.resume(); } catch (e) { }
        }
        micContextRef.current = audioCtx;

        try { await audioCtx.audioWorklet.addModule("/mic-processor.js"); } catch (e) { return; }
        if (audioCtx.state === "closed") return;

        const source = audioCtx.createMediaStreamSource(stream);
        const micWorklet = new AudioWorkletNode(audioCtx, "mic-processor");
        micWorkletRef.current = micWorklet;

        // Receive buffered PCM16 from worklet, base64 encode, send to Gemini
        micWorklet.port.onmessage = (e) => {
            // Only send when mic is live AND not paused for tool calls
            if (!micLiveRef.current) return;
            if (sendingPausedRef.current) return;

            const session = sessionRef.current;
            if (!session) return;
            if (!isSocketOpen(session)) return;

            const base64Audio = arrayBufferToBase64(e.data);
            try {
                session.sendRealtimeInput({
                    audio: {
                        data: base64Audio,
                        mimeType: "audio/pcm;rate=16000",
                    },
                });
            } catch (err: any) {
                if (err?.message?.includes?.('CLOS')) return;
                console.warn("[Gemini Live] sendRealtimeInput error:", err?.message || err);
            }
        };

        source.connect(micWorklet);
        const silentGain = audioCtx.createGain();
        silentGain.gain.value = 0;
        silentGain.connect(audioCtx.destination);
        micWorklet.connect(silentGain);

        console.log("[Gemini Live] Mic pipeline ready (persistent)");
    }, []);

    // ─── Tear down mic pipeline (only on disconnect / session close) ───
    const teardownMicPipeline = useCallback(() => {
        micLiveRef.current = false;
        if (micWorkletRef.current) {
            micWorkletRef.current.disconnect();
            micWorkletRef.current = null;
        }
        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach((t) => t.stop());
            mediaStreamRef.current = null;
        }
        if (micContextRef.current?.state !== "closed") {
            micContextRef.current?.close();
        }
        micContextRef.current = null;
    }, []);

    // ─── Start recording (push-to-talk press) ───
    const startRecording = useCallback(async () => {
        if (!isConnected || !sessionRef.current) return;

        try {
            // Start playback engine on user gesture so browser allows audio output
            await startPlaybackEngine();

            // Set up mic pipeline if not already done
            await ensureMicPipeline();

            // Enable sending — audio data will start flowing to Gemini
            micLiveRef.current = true;

            // Tell the model the user started speaking (required with manual VAD)
            sendActivityStart();

            setIsRecording(true);
        } catch (err) {
            console.error("Error accessing microphone", err);
        }
    }, [isConnected, startPlaybackEngine, ensureMicPipeline, sendActivityStart]);

    // ─── Stop recording (push-to-talk release) ───
    const stopRecording = useCallback(() => {
        // Stop sending audio but keep the pipeline alive.
        micLiveRef.current = false;
        // Signal that the user stopped speaking so the model responds (required with manual VAD)
        sendActivityEnd();
        // Also flush the audio stream.
        sendAudioStreamEndSignal();

        setIsRecording(false);
        if (!isHandsFreeMode) {
            setIsProcessing(true);
        }
    }, [isHandsFreeMode, sendActivityEnd, sendAudioStreamEndSignal]);

    const toggleRecording = useCallback(() => {
        if (isRecording) {
            stopRecording();
        } else {
            startRecording();
        }
    }, [isRecording, startRecording, stopRecording]);

    const enableHandsFreeMode = useCallback(async () => {
        setIsHandsFreeMode(true);
        if (!isConnected || !sessionRef.current) return;

        try {
            await startPlaybackEngine();
            await ensureMicPipeline();
            micLiveRef.current = true;
            setIsRecording(true);
            setIsProcessing(false);
        } catch (err) {
            console.error("[Gemini Live] Failed to enable hands-free mode", err);
        }
    }, [isConnected, startPlaybackEngine, ensureMicPipeline]);

    const disableHandsFreeMode = useCallback(() => {
        setIsHandsFreeMode(false);
        micLiveRef.current = false;
        sendAudioStreamEndSignal();
        setIsRecording(false);
        setIsProcessing(false);
    }, [sendAudioStreamEndSignal]);

    const toggleHandsFreeMode = useCallback(() => {
        if (isHandsFreeMode) {
            disableHandsFreeMode();
        } else {
            enableHandsFreeMode();
        }
    }, [isHandsFreeMode, disableHandsFreeMode, enableHandsFreeMode]);

    useEffect(() => {
        if (isHandsFreeMode && isConnected && sessionRef.current) {
            enableHandsFreeMode();
        }
    }, [isHandsFreeMode, isConnected, enableHandsFreeMode]);

    // ─── Screen Sharing: Send video frames to Gemini ───
    // Disconnect cleanup
    const disconnect = useCallback(() => {
        if (sessionRef.current) {
            try {
                sessionRef.current.close();
            } catch (e) {
                console.warn(e);
            }
            sessionRef.current = null;
        }

        // Clean up screen share
        stopScreenFrameStream();
        if (screenStreamRef.current) {
            screenStreamRef.current.getTracks().forEach((t) => t.stop());
            screenStreamRef.current = null;
        }
        if (videoRef.current) {
            videoRef.current.pause();
            videoRef.current.srcObject = null;
            videoRef.current = null;
        }

        setIsConnected(false);
        teardownMicPipeline();
        setIsRecording(false);
        stopPlaybackEngine();
    }, [teardownMicPipeline, stopPlaybackEngine, stopScreenFrameStream]);

    return {
        isConnected,
        isRecording,
        isProcessing,
        isResponding,
        isDrawing,
        isScreenSharing,
        isHandsFreeMode,
        connect,
        disconnect,
        startRecording,
        stopRecording,
        toggleRecording,
        enableHandsFreeMode,
        disableHandsFreeMode,
        toggleHandsFreeMode,
        startScreenShare,
        stopScreenShare,
    };
}
