import { useRef, useState, useCallback } from "react";
import { GoogleGenAI, Modality } from "@google/genai";

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

export function useGeminiLive() {
    const [isConnected, setIsConnected] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [isResponding, setIsResponding] = useState(false);

    // Mic capture refs
    const micContextRef = useRef<AudioContext | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const micWorkletRef = useRef<AudioWorkletNode | null>(null);

    // Playback refs
    const playContextRef = useRef<AudioContext | null>(null);
    const playWorkletRef = useRef<AudioWorkletNode | null>(null);

    // GenAI session
    const sessionRef = useRef<any>(null);

    // ─── Playback engine using AudioWorklet ───
    const startPlaybackEngine = useCallback(async () => {
        if (playContextRef.current && playContextRef.current.state !== "closed") return;

        const ctx = new AudioContext({ sampleRate: 24000 });
        playContextRef.current = ctx;

        await ctx.audioWorklet.addModule("/playback-processor.js");
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
                    systemInstruction: "You are a helpful and friendly AI assistant.",
                    speechConfig: {
                        voiceConfig: {
                            prebuiltVoiceConfig: {
                                voiceName: "Aoede",
                            },
                        },
                    },
                },
                callbacks: {
                    onopen: () => {
                        console.log("Connected to Gemini Live API");
                        setIsConnected(true);
                    },
                    onmessage: (message: any) => {
                        // Handle interruption — clear playback buffer
                        if (message.serverContent?.interrupted) {
                            setIsResponding(false);
                            if (playWorkletRef.current) {
                                playWorkletRef.current.port.postMessage("clear");
                            }
                            return;
                        }

                        // Turn complete — model finished responding
                        if (message.serverContent?.turnComplete) {
                            setIsResponding(false);
                            return;
                        }

                        if (message.serverContent?.modelTurn?.parts) {
                            setIsResponding(true);
                            for (const part of message.serverContent.modelTurn.parts) {
                                if (part.inlineData?.data) {
                                    const arrayBuffer = base64ToArrayBuffer(part.inlineData.data);
                                    // Send PCM16 buffer directly to playback worklet
                                    if (playWorkletRef.current) {
                                        playWorkletRef.current.port.postMessage(arrayBuffer, [arrayBuffer]);
                                    }
                                }
                            }
                        }
                    },
                    onerror: (e: any) => console.error("Gemini Live error:", e?.message || e),
                    onclose: (e: any) => {
                        console.log("Gemini Live closed:", e);
                        setIsConnected(false);
                        sessionRef.current = null;
                    },
                },
            });

            sessionRef.current = session;
        } catch (e) {
            console.error("Error connecting to Gemini", e);
        }
    }, []);

    // ─── Disconnect ───
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
        stopRecording();
    }, []);

    // ─── Start recording mic → stream to Gemini ───
    const startRecording = useCallback(async () => {
        if (!isConnected || !sessionRef.current) return;

        try {
            // Start playback engine on user gesture so browser allows audio output
            await startPlaybackEngine();

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
            micContextRef.current = audioCtx;

            // Load mic worklet
            await audioCtx.audioWorklet.addModule("/mic-processor.js");

            const source = audioCtx.createMediaStreamSource(stream);
            const micWorklet = new AudioWorkletNode(audioCtx, "mic-processor");
            micWorkletRef.current = micWorklet;

            // Receive PCM16 from worklet, base64 encode, send to Gemini
            micWorklet.port.onmessage = (e) => {
                if (sessionRef.current) {
                    const base64Audio = arrayBufferToBase64(e.data);
                    try {
                        sessionRef.current.sendRealtimeInput({
                            audio: {
                                data: base64Audio,
                                mimeType: "audio/pcm;rate=16000",
                            },
                        });
                    } catch (err) {
                        console.error("sendRealtimeInput error:", err);
                    }
                }
            };

            source.connect(micWorklet);
            // Connect to a silent output to keep the worklet alive
            const silentGain = audioCtx.createGain();
            silentGain.gain.value = 0;
            silentGain.connect(audioCtx.destination);
            micWorklet.connect(silentGain);

            setIsRecording(true);
        } catch (err) {
            console.error("Error accessing microphone", err);
        }
    }, [isConnected, startPlaybackEngine]);

    // ─── Stop recording ───
    const stopRecording = useCallback(() => {
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

        stopPlaybackEngine();
        setIsRecording(false);
    }, [stopPlaybackEngine]);

    const toggleRecording = useCallback(() => {
        if (isRecording) {
            stopRecording();
        } else {
            startRecording();
        }
    }, [isRecording, startRecording, stopRecording]);

    return {
        isConnected,
        isRecording,
        isResponding,
        connect,
        disconnect,
        startRecording,
        stopRecording,
        toggleRecording,
    };
}
