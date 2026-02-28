import WebSocket from 'ws';

const WS_URL = 'ws://localhost:3002';
console.log('🔌 Connecting to Lumina Canvas...');
const ws = new WebSocket(WS_URL);

ws.on('open', () => {
    console.log('✅ Connected! Drawing the Lumina Architecture Diagram on your screen...\n');

    // Helper to generate elements
    const createBox = (id, text, x, y, width, height, bgColor, fontColor = '#1e1e1e') => {
        const id_num = Date.now() + Math.floor(Math.random() * 100000);
        return [
            {
                id: `${id}_box_${id_num}`, type: 'rectangle', x, y, width, height,
                strokeColor: '#1e1e1e', backgroundColor: bgColor, fillStyle: 'solid',
                strokeWidth: 2, roughness: 1, roundness: { type: 3 },
                version: 1, versionNonce: Math.random(), isDeleted: false,
                groupIds: [`group_${id}`]
            },
            {
                id: `${id}_txt_${id_num}`, type: 'text', x: x + 15, y: y + 20, width: width - 30, height: 25,
                strokeColor: fontColor, backgroundColor: 'transparent',
                fontSize: 20, fontFamily: 1, textAlign: 'center', verticalAlign: 'middle',
                text: text, originalText: text, lineHeight: 1.25, autoResize: true,
                version: 1, versionNonce: Math.random(), isDeleted: false,
                groupIds: [`group_${id}`]
            }
        ];
    };

    const createArrow = (id, x, y, w, h) => {
        return {
            id: `arrow_${id}_${Date.now()}`, type: 'arrow', x, y, width: Math.abs(w), height: Math.abs(h),
            strokeColor: '#1e1e1e', strokeWidth: 2, roughness: 1,
            points: [[0, 0], [w, h]], endArrowhead: 'arrow',
            version: 1, versionNonce: Math.random(), isDeleted: false
        };
    };

    const scene = {
        type: 'scene-update',
        elements: [
            // Title
            ...createBox('title', 'Lumina App Architecture (Drawn by AI)', 250, 50, 450, 60, '#fcc419'),

            // User / Browser Layer
            ...createBox('frontend', 'React Frontend (Vite)', 350, 200, 250, 70, '#a5d8ff'),
            ...createBox('excalidraw', 'Excalidraw Board', 250, 320, 200, 60, '#d0ebff'),
            ...createBox('voice', 'Voice Interface', 500, 320, 200, 60, '#d0ebff'),

            // Backend / MCP Layer
            ...createBox('ws_server', 'WebSocket Sync (Port 3002)', 250, 480, 280, 70, '#b2f2bb'),
            ...createBox('mcp_server', 'MCP Server (Node.js)', 500, 580, 250, 70, '#ffc9c9'),

            // AI Agent Layer
            ...createBox('ai_agent', 'Lumina / AI Agent', 500, 700, 250, 70, '#eebefa'),

            // Connections
            createArrow('f_to_e', 450, 270, -100, 50),
            createArrow('f_to_v', 500, 270, 100, 50),

            createArrow('e_to_ws', 350, 380, 0, 100),
            createArrow('ws_to_e', 360, 480, 0, -100), // Bidirectional sync

            createArrow('ws_to_mcp', 450, 550, 100, 30),
            createArrow('mcp_to_ai', 625, 650, 0, 50),
            createArrow('ai_to_mcp', 635, 700, 0, -50),
        ],
        appState: { viewBackgroundColor: '#f8f9fa' }
    };

    setTimeout(() => {
        ws.send(JSON.stringify(scene));
        console.log('🎨 Diagram generated successfully! Look at your browser.\n');

        setTimeout(() => process.exit(0), 1000);
    }, 1000);
});

ws.on('error', (err) => console.error('Error:', err.message));
