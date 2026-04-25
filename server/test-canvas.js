/**
 * Quick test script for the Lumina Canvas WebSocket + MCP system.
 * 
 * Usage: node server/test-canvas.js
 * 
 * This will:
 *  1. Connect to the WebSocket server
 *  2. Listen for canvas updates (draw something in the browser!)
 *  3. Send a test element (a rectangle) to the canvas
 */

import WebSocket from 'ws';

const WS_URL = 'ws://localhost:3002';

console.log('🔌 Connecting to canvas WebSocket...');
const ws = new WebSocket(WS_URL);

ws.on('open', () => {
    console.log('✅ Connected to WebSocket server!\n');
    console.log('📡 Listening for canvas updates — draw something in your browser...\n');

    // After 3 seconds, send a test element
    setTimeout(() => {
        console.log('🎨 Sending a test rectangle to the canvas...\n');

        const testElement = {
            type: 'scene-update',
            elements: [
                {
                    id: `test_${Date.now()}`,
                    type: 'rectangle',
                    x: 100,
                    y: 100,
                    width: 200,
                    height: 150,
                    angle: 0,
                    strokeColor: '#e03131',
                    backgroundColor: '#ffc9c9',
                    fillStyle: 'solid',
                    strokeWidth: 2,
                    roughness: 1,
                    opacity: 100,
                    groupIds: [],
                    roundness: { type: 3 },
                    seed: Math.floor(Math.random() * 1000000),
                    version: 1,
                    versionNonce: Math.floor(Math.random() * 1000000),
                    isDeleted: false,
                    boundElements: null,
                    updated: Date.now(),
                    link: null,
                    locked: false,
                },
                {
                    id: `test_text_${Date.now()}`,
                    type: 'text',
                    x: 130,
                    y: 150,
                    width: 155,
                    height: 25,
                    angle: 0,
                    strokeColor: '#1e1e1e',
                    backgroundColor: 'transparent',
                    fillStyle: 'solid',
                    strokeWidth: 1,
                    roughness: 0,
                    opacity: 100,
                    groupIds: [],
                    roundness: null,
                    seed: Math.floor(Math.random() * 1000000),
                    version: 1,
                    versionNonce: Math.floor(Math.random() * 1000000),
                    isDeleted: false,
                    boundElements: null,
                    updated: Date.now(),
                    link: null,
                    locked: false,
                    text: 'Hello from MCP!',
                    fontSize: 20,
                    fontFamily: 1,
                    textAlign: 'left',
                    verticalAlign: 'top',
                    containerId: null,
                    originalText: 'Hello from MCP!',
                    lineHeight: 1.25,
                    autoResize: true,
                },
            ],
            appState: {},
        };

        ws.send(JSON.stringify(testElement));
        console.log('✅ Test elements sent! Check your browser — you should see a red rectangle with "Hello from MCP!" text.\n');
    }, 3000);
});

ws.on('message', (data) => {
    try {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'scene-update') {
            const count = msg.elements?.length || 0;

            // Summarize element types
            const types = {};
            (msg.elements || []).forEach(el => {
                types[el.type] = (types[el.type] || 0) + 1;
            });
            const summary = Object.entries(types).map(([t, c]) => `${c} ${t}`).join(', ');

            console.log(`📋 Canvas update received: ${count} elements (${summary})`);
        }
    } catch (err) {
        // ignore
    }
});

ws.on('error', (err) => {
    console.error('❌ WebSocket error:', err.message);
    console.log('\n💡 Make sure the MCP server is running: npm run mcp');
    process.exit(1);
});

ws.on('close', () => {
    console.log('\n🔌 Disconnected from WebSocket');
});

// Keep alive for 15 seconds then exit
setTimeout(() => {
    console.log('\n⏱️  Test complete! Closing connection.');
    ws.close();
    process.exit(0);
}, 15000);
