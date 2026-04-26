import { useRef, useState, useCallback } from "react";
import { GoogleGenAI, Modality } from "@google/genai";
import { exportToBlob } from "@excalidraw/excalidraw";
import {
    canvasToolDeclarations,
    executeCanvasTool,
    type ExcalidrawAPI,
} from "../services/aiTools";
import { executeDrawingAgent } from "../services/canvasAgent";
import { geminiLiveSystemInstruction } from "../prompts";

const API_KEY = (import.meta as any).env.VITE_GEMINI_API_KEY || "";
const MODEL = "gemini-2.5-flash-native-audio-preview-12-2025";

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
}

export function useGeminiLive({ excalidrawApiRef }: UseGeminiLiveOptions) {
    const [isConnected, setIsConnected] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false); // true between send & first AI response
    const [isResponding, setIsResponding] = useState(false);
    const [isDrawing, setIsDrawing] = useState(false); // true when AI is calling canvas tools
    const [isScreenSharing, setIsScreenSharing] = useState(false);

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

    // Continuous frame streaming interval
    const frameIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

    // ─── Continuous frame streaming (runs at ~1fps) ───
    const startFrameStreaming = useCallback(() => {
        if (frameIntervalRef.current) return; // already running
        frameIntervalRef.current = setInterval(() => {
            if (sendingPausedRef.current) return;
            const session = sessionRef.current;
            if (!session || !isSocketOpen(session)) return;

            // Use screen share video
            const video = videoRef.current;
            if (!video) return;

            const base64Data = captureFrameFromVideo(video);
            if (!base64Data) return;

            try {
                session.sendRealtimeInput({
                    video: {
                        mimeType: "image/jpeg",
                        data: base64Data,
                    },
                });
            } catch (err: any) {
                if (err?.message?.includes?.("CLOS")) return;
                console.warn("[Gemini Live] Frame send error:", err?.message || err);
            }
        }, 1000); // 1 frame per second
        console.log("[Gemini Live] Continuous frame streaming started (1fps)");
    }, [captureFrameFromVideo]);

    const stopFrameStreaming = useCallback(() => {
        if (frameIntervalRef.current) {
            clearInterval(frameIntervalRef.current);
            frameIntervalRef.current = null;
            console.log("[Gemini Live] Continuous frame streaming stopped");
        }
    }, []);

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
            startFrameStreaming();

            stream.getVideoTracks()[0].onended = () => {
                screenStreamRef.current = null;
                if (videoRef.current) {
                    videoRef.current.pause();
                    videoRef.current.srcObject = null;
                    videoRef.current = null;
                }
                setIsScreenSharing(false);
                stopFrameStreaming();
            };
        } catch (err) {
            console.error("[Gemini Live] Error accessing screen share:", err);
            setIsScreenSharing(false);
        }
    }, [startFrameStreaming, stopFrameStreaming]);

    const stopScreenShare = useCallback(() => {
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
        stopFrameStreaming();
    }, [stopFrameStreaming]);

    const captureScreenSnapshot = useCallback(async (): Promise<any> => {
        const session = sessionRef.current;
        if (!session || !isSocketOpen(session)) {
            return { error: "Session is not connected." };
        }

        const video = videoRef.current;
        if (!video || !screenStreamRef.current) {
            return { error: "Screen sharing is not active. The user needs to share their screen first." };
        }

        try {
            if (video.videoWidth === 0 || video.videoHeight === 0) {
                console.warn("[Gemini Live] Video dimensions are 0, snapshot might be empty. Trying to force play...");
                await video.play().catch(e => console.warn("Play failed:", e));
            }

            const canvas = document.createElement("canvas");
            // Fallback dimensions just in case videoWidth is still 0
            canvas.width = video.videoWidth || 1280;
            canvas.height = video.videoHeight || 720;
            const ctx = canvas.getContext("2d");
            if (!ctx) return { error: "Failed to get canvas context" };
            
            // Fill with white background in case of transparency/errors
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // If the video actually has dimensions, draw it
            if (video.videoWidth > 0 && video.videoHeight > 0) {
                 ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            } else {
                 console.warn("[Gemini Live] Drawing blank fallback frame because video dimensions are 0");
                 // Draw some text so the AI knows it's broken rather than hallucinating
                 ctx.fillStyle = "#000000";
                 ctx.font = "24px Arial";
                 ctx.fillText("Screen sharing feed is temporarily unavailable or loading.", 50, 50);
            }
            
            // Get base64 string directly from canvas
            const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
            const base64Data = dataUrl.split(",")[1];

            // Send the screen image to the model
            session.sendRealtimeInput({
                video: {
                    mimeType: "image/jpeg",
                    data: base64Data,
                },
            });

            console.log(`[Gemini Live] Screen snapshot sent`);

            // Small delay so the frame is ingested before tool response
            await new Promise((r) => setTimeout(r, 500));

            return {
                success: true,
                message: `Screen image has been sent. Describe what you see on the user's screen.`,
            };
        } catch (err: any) {
            console.error("[Gemini Live] Screen capture error:", err);
            return { error: "Failed to capture screen: " + (err?.message || err) };
        }
    }, []);

    // ─── Capture the Excalidraw canvas as an image for the view_canvas tool ───
    const captureCanvasSnapshot = useCallback(async (): Promise<any> => {
        const api = excalidrawApiRef.current;
        if (!api) {
            return { error: "Canvas API not available." };
        }

        const session = sessionRef.current;
        if (!session || !isSocketOpen(session)) {
            return { error: "Session is not connected." };
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

            // Send the canvas image to the model
            session.sendRealtimeInput({
                video: {
                    mimeType: "image/png",
                    data: base64Data,
                },
            });

            console.log(`[Gemini Live] Canvas snapshot sent (${elements.length} elements)`);

            // Small delay so the frame is ingested before tool response
            await new Promise((r) => setTimeout(r, 500));

            return {
                success: true,
                message: `Canvas image with ${elements.length} elements has been sent. Describe what you see on the canvas.`,
            };
        } catch (err: any) {
            console.error("[Gemini Live] Canvas export error:", err);
            return { error: "Failed to export canvas: " + (err?.message || err) };
        }
    }, [excalidrawApiRef]);

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
        [excalidrawApiRef, captureCanvasSnapshot]
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

        if (!API_KEY) {
            console.error("Missing VITE_GEMINI_API_KEY in .env");
            alert("Missing VITE_GEMINI_API_KEY in environment variables (.env)");
            return;
        }

        try {
            const ai = new GoogleGenAI({ apiKey: API_KEY });
            console.log("[Gemini Live] Connecting via Gemini API");

            const session = await ai.live.connect({
                model: MODEL,
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
                            disabled: true,
                        },
                    },
                    tools: [
                        {
                            functionDeclarations: canvasToolDeclarations,
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

                        // Stop frame streaming
                        stopFrameStreaming();

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
            connectingRef.current = false;
        }
    }, [handleToolCall, stopPlaybackEngine, stopFrameStreaming]);



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

            // Signal activity start to Gemini (manual VAD)
            const session = sessionRef.current;
            if (session && isSocketOpen(session)) {
                try {
                    session.sendRealtimeInput({ activityStart: {} });
                    console.log("[Gemini Live] Sent activityStart");
                } catch (err: any) {
                    console.warn("[Gemini Live] Failed to send activityStart:", err?.message || err);
                }
            }

            // Enable sending — audio data will start flowing to Gemini
            micLiveRef.current = true;

            setIsRecording(true);
        } catch (err) {
            console.error("Error accessing microphone", err);
        }
    }, [isConnected, startPlaybackEngine, ensureMicPipeline]);

    // ─── Stop recording (push-to-talk release) ───
    const stopRecording = useCallback(() => {
        // Stop sending audio but keep the pipeline alive.
        micLiveRef.current = false;

        // Signal activity end to Gemini (manual VAD)
        const session = sessionRef.current;
        if (session && isSocketOpen(session)) {
            try {
                session.sendRealtimeInput({ activityEnd: {} });
                console.log("[Gemini Live] Sent activityEnd");
            } catch (err: any) {
                console.warn("[Gemini Live] Failed to send activityEnd:", err?.message || err);
            }
        }

        setIsRecording(false);
        setIsProcessing(true);
    }, []);

    const toggleRecording = useCallback(() => {
        if (isRecording) {
            stopRecording();
        } else {
            startRecording();
        }
    }, [isRecording, startRecording, stopRecording]);

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

        // Stop frame streaming
        stopFrameStreaming();

        // Clean up screen share
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
    }, [teardownMicPipeline, stopPlaybackEngine, stopFrameStreaming]);

    return {
        isConnected,
        isRecording,
        isProcessing,
        isResponding,
        isDrawing,
        isScreenSharing,
        connect,
        disconnect,
        startRecording,
        stopRecording,
        toggleRecording,
        startScreenShare,
        stopScreenShare,
    };
}
