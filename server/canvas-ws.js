/**
 * Canvas WebSocket Server
 * 
 * Receives Excalidraw scene state from the frontend in real-time.
 * Stores the latest scene in memory so the MCP server can access it.
 * Also allows the MCP server to push scene updates back to the frontend.
 */

import { WebSocketServer } from 'ws';

// Shared canvas state — exported so the MCP server can read/write it
export const canvasState = {
    elements: [],
    appState: {},
    files: {},
    lastUpdated: null,
    clients: new Set(),
};

export function startCanvasWebSocket(port = 3002) {
    const wss = new WebSocketServer({ port });

    wss.on('connection', (ws) => {
        console.log('[WS] Client connected');
        canvasState.clients.add(ws);

        // Send current state to newly connected client
        if (canvasState.elements.length > 0) {
            ws.send(JSON.stringify({
                type: 'scene-update',
                elements: canvasState.elements,
                appState: canvasState.appState,
            }));
        }

        ws.on('message', (data) => {
            try {
                const msg = JSON.parse(data.toString());

                if (msg.type === 'scene-update') {
                    canvasState.elements = msg.elements || [];
                    canvasState.appState = msg.appState || {};
                    canvasState.files = msg.files || {};
                    canvasState.lastUpdated = new Date().toISOString();

                    // Broadcast to all OTHER connected clients
                    const outgoing = JSON.stringify({
                        type: 'scene-update',
                        elements: canvasState.elements,
                        appState: canvasState.appState,
                    });
                    for (const client of canvasState.clients) {
                        if (client !== ws && client.readyState === 1) {
                            client.send(outgoing);
                        }
                    }
                }
            } catch (err) {
                console.error('[WS] Failed to parse message:', err.message);
            }
        });

        ws.on('close', () => {
            console.log('[WS] Client disconnected');
            canvasState.clients.delete(ws);
        });

        ws.on('error', (err) => {
            console.error('[WS] Error:', err.message);
            canvasState.clients.delete(ws);
        });
    });

    console.log(`[WS] Canvas WebSocket server listening on ws://localhost:${port}`);
    return wss;
}

/**
 * Broadcast a scene update to all connected frontend clients.
 * Used by the MCP server when AI wants to draw on the canvas.
 */
export function broadcastScene(elements, appState = {}) {
    const message = JSON.stringify({
        type: 'scene-update',
        elements,
        appState,
    });

    for (const client of canvasState.clients) {
        if (client.readyState === 1) { // WebSocket.OPEN
            client.send(message);
        }
    }
}
