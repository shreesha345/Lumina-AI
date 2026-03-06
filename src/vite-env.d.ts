/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GEMINI_API_KEY: string;
  readonly VITE_VERTEX_API_KEY?: string;
  readonly VITE_GOOGLE_CLOUD_PROJECT?: string;
  readonly VITE_GOOGLE_CLOUD_LOCATION?: string;
  readonly VITE_GOOGLE_GENAI_USE_VERTEXAI?: string;
  readonly VITE_GEMINI_LIVE_MODEL?: string;
  readonly VITE_GEMINI_TOOL_MODEL?: string;
  readonly VITE_GEMINI_VISION_MODEL?: string;
  readonly VITE_GEMINI_TOOL_THINKING_BUDGET?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module '*.md?raw' {
  const content: string;
  export default content;
}
