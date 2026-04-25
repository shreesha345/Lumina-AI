import { useRef, useState, useCallback } from "react";
import { GoogleGenAI, Modality } from "@google/genai";
import {
    canvasToolDeclarations,
    executeCanvasTool,
    type ExcalidrawAPI,
} from "../services/aiTools";
import { geminiLiveSystemInstruction } from "../prompts";

const API_KEY = (import.meta as any).env.VITE_GEMINI_API_KEY || "";

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

    // Screen sharing refs
    const screenStreamRef = useRef<MediaStream | null>(null);
    const screenTimerRef = useRef<any>(null);

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

    // ─── Process a single tool call message ───
    const processToolCall = useCallback(
        async (toolCallMessage: any) => {
            const session = sessionRef.current;
            if (!session || !toolCallMessage.toolCall?.functionCalls) return;

            setIsDrawing(true);
            console.log("[Gemini Live] Tool call received:", toolCallMessage.toolCall.functionCalls);

            const functionResponses: any[] = [];

            for (const fc of toolCallMessage.toolCall.functionCalls) {
                console.log(`[Gemini Live] Executing tool: ${fc.name}`, fc.args);

                let result: any;
                try {
                    const api = excalidrawApiRef.current;
                    if (api) {
                        result = await executeCanvasTool(fc.name, fc.args || {}, api);
                    } else {
                        result = { error: "Canvas API not available" };
                    }
                } catch (err: any) {
                    console.error(`[Gemini Live] Tool execution error:`, err);
                    result = { error: err.message || "Tool execution failed" };
                }

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

            setIsDrawing(false);
        },
        [excalidrawApiRef]
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
        if (sessionRef.current) return;

        if (!API_KEY) {
            console.error("Missing VITE_GEMINI_API_KEY in .env");
            alert("Missing VITE_GEMINI_API_KEY in environment variables (.env)");
            return;
        }

        try {
            const ai = new GoogleGenAI({ apiKey: API_KEY });

            const session = await ai.live.connect({
                model: "gemini-2.5-flash-native-audio-preview-12-2025",
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

                        // Clean up mic and screen share
                        teardownMicPipeline();

                        if (screenTimerRef.current) {
                            clearInterval(screenTimerRef.current);
                            screenTimerRef.current = null;
                        }
                        if (screenStreamRef.current) {
                            screenStreamRef.current.getTracks().forEach((t) => t.stop());
                            screenStreamRef.current = null;
                        }

                        stopPlaybackEngine();
                        setIsRecording(false);
                        setIsScreenSharing(false);

                        // Auto-reconnect on transient server errors
                        const closeCode = e?.code || e;
                        const isTransientError = closeCode === 1008 || closeCode === 1011;
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
                    media: {
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
            // (reopens the audio stream if audioStreamEnd was sent previously)
            micLiveRef.current = true;

            setIsRecording(true);
        } catch (err) {
            console.error("Error accessing microphone", err);
        }
    }, [isConnected, startPlaybackEngine, ensureMicPipeline]);

    // ─── Stop recording (push-to-talk release) ───
    const stopRecording = useCallback(() => {
        // Stop sending audio but keep the pipeline alive
        micLiveRef.current = false;

        // Signal that the audio stream has ended — Gemini's automatic VAD
        // will finalize the user turn and start generating a response
        try {
            const session = sessionRef.current;
            if (session && isSocketOpen(session)) {
                session.sendRealtimeInput({ audioStreamEnd: true });
                console.log("[Gemini Live] audioStreamEnd sent — waiting for response");
            }
        } catch (err: any) {
            console.warn("[Gemini Live] Failed to send audioStreamEnd:", err?.message || err);
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
    const stopScreenShare = useCallback(() => {
        if (screenTimerRef.current) {
            clearInterval(screenTimerRef.current);
            screenTimerRef.current = null;
        }
        if (screenStreamRef.current) {
            screenStreamRef.current.getTracks().forEach((t) => t.stop());
            screenStreamRef.current = null;
        }
        setIsScreenSharing(false);
    }, []);

    const startScreenShare = useCallback(async () => {
        if (!sessionRef.current || !isConnected) {
            console.warn("Cannot start screenshare: not connected to Gemini Live");
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: { frameRate: 1 },
                audio: false
            });
            screenStreamRef.current = stream;

            const videoElement = document.createElement("video");
            videoElement.srcObject = stream;
            videoElement.muted = true;
            await videoElement.play();

            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");

            // Extract frames at a controlled rate to stop websocket 1011 overflow
            screenTimerRef.current = setInterval(() => {
                if (!sessionRef.current || !videoElement.videoWidth) return;
                // Skip sending frames while a tool call is being processed
                if (sendingPausedRef.current) return;

                // Scale down slightly to preserve tokens & latency (512px as recommended for realtime)
                const ratio = Math.min(512 / videoElement.videoWidth, 512 / videoElement.videoHeight);
                canvas.width = videoElement.videoWidth * ratio;
                canvas.height = videoElement.videoHeight * ratio;

                ctx?.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
                const base64Data = canvas.toDataURL("image/jpeg", 0.45).split(",")[1];

                try {
                    if (isSocketOpen(sessionRef.current)) {
                        sessionRef.current.sendRealtimeInput({
                            media: {
                                mimeType: "image/jpeg",
                                data: base64Data
                            }
                        });
                    }
                } catch (err: any) {
                    // Suppress WebSocket closed errors
                    if (err?.message?.includes?.('CLOS')) return;
                    console.error("sendRealtimeInput (screenshare) error:", err);
                }
            }, 3000);

            // Handle user dragging 'stop sharing' via native browser button
            stream.getVideoTracks()[0].onended = () => {
                stopScreenShare();
            };

            setIsScreenSharing(true);
        } catch (err: any) {
            if (err.name === 'NotAllowedError') {
                console.log("Screenshare cancelled by user.");
            } else {
                console.error("Error accessing screen sharing", err);
            }
            setIsScreenSharing(false);
        }
    }, [isConnected, stopScreenShare]);

    const toggleScreenShare = useCallback(() => {
        if (isScreenSharing) stopScreenShare();
        else startScreenShare();
    }, [isScreenSharing, startScreenShare, stopScreenShare]);

    // Disconnect cleanup needs screen-share stop as well
    const disconnect = useCallback(() => {
        if (sessionRef.current) {
            try {
                sessionRef.current.close();
            } catch (e) {
                console.warn(e);
            }
            sessionRef.current = null;
        }
        setIsConnected(false);
        teardownMicPipeline();
        setIsRecording(false);
        stopPlaybackEngine();
        stopScreenShare();
    }, [teardownMicPipeline, stopPlaybackEngine, stopScreenShare]);

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
        toggleScreenShare,
    };
}
