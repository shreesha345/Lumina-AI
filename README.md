# Lumina AI - Interactive AI Tutor

Lumina is an AI-powered interactive tutor that combines **real-time voice conversation** with a **live whiteboard canvas**. Upload research papers (PDFs), ask questions by voice, and watch as Lumina draws diagrams, flowcharts, and illustrations to explain concepts — all in real time.

![React](https://img.shields.io/badge/React-19.2-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)
![Vite](https://img.shields.io/badge/Vite-7.3-purple)
![Gemini](https://img.shields.io/badge/Gemini_AI-Live_API-orange)

---

## Features

- **Real-time voice interaction** — Talk to Lumina using your microphone. Supports push-to-talk (hold click or `Ctrl+Space`) and toggle mode.
- **Interactive whiteboard** — Full Excalidraw canvas with shapes, arrows, text, freehand drawing, and image upload.
- **AI-driven diagram generation** — Lumina draws flowcharts, mind maps, architecture diagrams, waveforms, SVG illustrations, and educational visuals directly on the canvas.
- **Canvas awareness** — The AI can view (screenshot) and inspect (structured data) everything on the canvas, including user-uploaded images. New drawings are automatically placed beside existing content to avoid overlap.
- **PDF paper upload** — Drag-and-drop research papers; full text is extracted and provided as context for the AI.
- **Animated drawing playback** — Replay AI-drawn diagrams as step-by-step animations.
- **Two modes** — *Live mode* (voice + canvas) and *Agentic mode* (text-based chat).
- **Dark / Light theme** — Follows your system preference with manual toggle.

---

## Architecture

Lumina uses a **manager-agent pattern**:

| Component | Model | Role |
|---|---|---|
| **Voice Manager** | `gemini-2.5-flash-native-audio` | Real-time voice conversation, decides when to draw, delegates to canvas agent |
| **Canvas Agent** | `gemini-3-flash-preview` | Generates Excalidraw JSON / SVG from natural language drawing requests |

The voice manager has three tools:
- `draw_on_canvas` — delegates a drawing request to the canvas agent
- `view_canvas` — captures a PNG screenshot of the whiteboard
- `inspect_canvas` — returns structured element data (positions, types, dimensions)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 19 + TypeScript |
| Build | Vite |
| Canvas | [@excalidraw/excalidraw](https://github.com/excalidraw/excalidraw) |
| Animation | excalidraw-animate |
| AI | [@google/genai](https://www.npmjs.com/package/@google/genai) (Gemini Live API + standard API) |
| PDF Parsing | pdfjs-dist |
| Audio | Web Audio API + AudioWorklet (24 kHz) |

---

## Getting Started

### Prerequisites

- **Node.js** 18+
- A **Google Gemini API key** with access to the Live API

### Installation

```bash
git clone https://github.com/shreesha345/Lumina.git
cd Lumina
npm install
```

### Environment Variables

Create a `.env` file in the project root:

```env
VITE_GEMINI_API_KEY=your_gemini_api_key_here
VITE_GEMINI_LIVE_MODEL=gemini-2.5-flash-native-audio-preview-12-2025
VITE_GEMINI_TOOL_MODEL=gemini-3.1-flash-lite-preview
VITE_GEMINI_VISION_MODEL=gemini-2.5-flash
VITE_GEMINI_TOOL_THINKING_BUDGET=0
```

### Running

```bash
npm run dev
```

Open [http://127.0.0.1:5173](http://127.0.0.1:5173) in your browser.

### Build

```bash
npm run build
npm run preview
```

### Remotion (Docker)

Render a sample Remotion video into `Sandbox/out/hello-remotion.mp4` using Docker:

```bash
docker compose -f Sandbox/docker-compose.remotion.yml up --build
```

Or with plain Docker:

```bash
docker build -f Sandbox/Dockerfile.remotion -t ai-tutor-gemini-remotion .
docker run --rm -v ${PWD}/Sandbox/out:/app/Sandbox/out ai-tutor-gemini-remotion
```

Local (non-Docker) Remotion commands:

```bash
npm run remotion:studio
npm run remotion:render
```

---

## Project Structure

```
src/
  App.tsx                  # Main app layout (canvas + sidebar)
  prompts.ts               # System prompts for the AI persona
  skills.md                # Canvas drawing skills reference (injected into agent prompt)
  components/
    ChatHistory.tsx         # Chat UI for agentic mode
    FileUpload.tsx          # PDF drag-and-drop uploader
  hooks/
    useGeminiLive.ts        # Gemini Live API connection, audio, tool execution
    useCanvasSync.js        # WebSocket canvas sync (optional)
  services/
    aiTools.ts              # Tool declarations + Excalidraw element conversion
    canvasAgent.ts          # Gemini Flash canvas drawing agent
    pdfParser.ts            # PDF text extraction via pdf.js
public/
  mic-processor.js          # AudioWorklet for mic capture
  playback-processor.js     # AudioWorklet for audio playback
skills/                     # Excalidraw diagram skill files
```

---

## Usage

1. **Connect** — Click the mic button to connect to Gemini Live.
2. **Upload a PDF** (optional) — Drag a research paper onto the sidebar. Lumina will use it as context.
3. **Talk** — Hold the mic button (or press `Ctrl+Space`) and ask Lumina to explain something or draw a diagram.
4. **Draw on the canvas** — You can also draw directly on the whiteboard. Lumina can see what you draw via the `view_canvas` tool.
5. **Upload images** — Drop images onto the canvas. Lumina will place new drawings beside them without overlapping.
6. **Open PDF on canvas** — After upload, click **Open PDF On Canvas**. You can zoom, switch pages, and drag to mark a region.
7. **Ask about marked region** — Say or type: "Explain this marked section". Lumina uses the PDF selection to read text/equations/figures, then explains and can draw supporting visuals.

---

## License

This project is for educational and personal use.
