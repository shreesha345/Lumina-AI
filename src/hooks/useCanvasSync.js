/**
 * useCanvasSync — React hook for syncing Excalidraw state over WebSocket.
 * 
 * - Sends scene updates to the server whenever elements change.
 * - Receives scene updates from the server (e.g., when AI adds elements).
 * - Reconnects automatically on disconnection.
 */

import { useRef, useEffect, useCallback } from 'react';

const WS_URL = 'ws://localhost:3002';
const RECONNECT_DELAY = 2000;
const DEBOUNCE_MS = 300;

export function useCanvasSync(excalidrawApiRef) {
    const wsRef = useRef(null);
    const reconnectTimer = useRef(null);
    const sendTimer = useRef(null);
    const lastSentHash = useRef('');
    const isReceivingUpdate = useRef(false);

    // Connect to WebSocket
    const connect = useCallback(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) return;

        const ws = new WebSocket(WS_URL);

        ws.onopen = () => {
            console.log('[Canvas Sync] Connected to server');
            if (reconnectTimer.current) {
                clearTimeout(reconnectTimer.current);
                reconnectTimer.current = null;
            }
        };

        ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);

                if (msg.type === 'scene-update' && excalidrawApiRef.current) {
                    isReceivingUpdate.current = true;
                    excalidrawApiRef.current.updateScene({
                        elements: msg.elements,
                    });
                    // Reset after a tick so we don't re-send what we just received
                    setTimeout(() => { isReceivingUpdate.current = false; }, 100);
                }
            } catch (err) {
                console.error('[Canvas Sync] Failed to parse message:', err);
            }
        };

        ws.onclose = () => {
            console.log('[Canvas Sync] Disconnected, reconnecting...');
            wsRef.current = null;
            reconnectTimer.current = setTimeout(connect, RECONNECT_DELAY);
        };

        ws.onerror = (err) => {
            console.error('[Canvas Sync] WebSocket error:', err);
            ws.close();
        };

        wsRef.current = ws;
    }, [excalidrawApiRef]);

    // Send scene update (debounced)
    const sendSceneUpdate = useCallback((elements, appState) => {
        // Don't send if we're processing an incoming update
        if (isReceivingUpdate.current) return;

        if (sendTimer.current) clearTimeout(sendTimer.current);

        sendTimer.current = setTimeout(() => {
            if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

            // Simple dedup: hash element IDs + versions
            const hash = elements.map(e => `${e.id}:${e.version}`).join(',');
            if (hash === lastSentHash.current) return;
            lastSentHash.current = hash;

            wsRef.current.send(JSON.stringify({
                type: 'scene-update',
                elements: elements,
                appState: {
                    viewBackgroundColor: appState?.viewBackgroundColor,
                },
            }));
        }, DEBOUNCE_MS);
    }, []);

    // Connect on mount, cleanup on unmount
    useEffect(() => {
        connect();

        return () => {
            if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
            if (sendTimer.current) clearTimeout(sendTimer.current);
            if (wsRef.current) wsRef.current.close();
        };
    }, [connect]);

    return { sendSceneUpdate };
}
