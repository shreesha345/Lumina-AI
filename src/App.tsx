import { useState, useRef, useCallback, useEffect } from 'react';
import { Excalidraw, MainMenu, WelcomeScreen, exportToSvg } from '@excalidraw/excalidraw';
import { animateSvg } from 'excalidraw-animate';
import '@excalidraw/excalidraw/index.css';
import './App.css';

import FileUpload from './components/FileUpload';
import ChatHistory from './components/ChatHistory';
import { parsePdf } from './services/pdfParser';
import { useGeminiLive } from './hooks/useGeminiLive';


function App() {
  // App mode
  const [appMode, setAppMode] = useState('live'); // 'agentic' | 'live'
  const [showPlusMenu, setShowPlusMenu] = useState(false);
  const [attachedFile, setAttachedFile] = useState(null);
  const [videoMode, setVideoMode] = useState(false);

  // Sidebar state
  const [sidebarTab, setSidebarTab] = useState('upload'); // 'upload' | 'chat'
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // PDF state
  const [paperData, setPaperData] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Chat state (separate per mode)
  const [liveMessages, setLiveMessages] = useState([]);
  const [agenticMessages, setAgenticMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  // Derive current messages based on mode
  const messages = appMode === 'live' ? liveMessages : agenticMessages;
  const setMessages = appMode === 'live' ? setLiveMessages : setAgenticMessages;

  // Excalidraw API Reference
  const excalidrawApiRef = useRef(null);

  // Live API Connection
  const {
    isConnected,
    isRecording,
    isProcessing: isAudioProcessing,
    isResponding,
    isDrawing,
    isScreenSharing,
    connect,
    disconnect,
    startRecording,
    stopRecording,
    startScreenShare,
    stopScreenShare,
  } = useGeminiLive({ excalidrawApiRef });

  // Connect when switching to Live mode
  useEffect(() => {
    if (appMode === 'live') {
      connect();
    } else {
      disconnect();
    }
  }, [appMode, connect, disconnect]);

  // Voice state
  const voiceStateRef = useRef({ mode: null as string | null }); // mode: 'click' | 'push'


  // Animation state
  const [isAnimating, setIsAnimating] = useState(false);
  const [animatedSvg, setAnimatedSvg] = useState(null);

  // Canvas SVG overlay (for AI-generated SVG animations)
  const [svgOverlay, setSvgOverlay] = useState(null);
  const svgOverlayTimerRef = useRef<any>(null);
  const svgPipRef = useRef<HTMLDivElement>(null);
  const svgPipDragRef = useRef({ dragging: false, startX: 0, startY: 0, origX: 0, origY: 0 });

  // Drag handlers for the PiP panel
  const handlePipDragStart = useCallback((e: React.MouseEvent) => {
    const panel = svgPipRef.current;
    if (!panel) return;
    e.preventDefault();
    const rect = panel.getBoundingClientRect();
    const parentRect = panel.offsetParent?.getBoundingClientRect() || { left: 0, top: 0 };
    svgPipDragRef.current = {
      dragging: true,
      startX: e.clientX,
      startY: e.clientY,
      origX: rect.left - parentRect.left,
      origY: rect.top - parentRect.top,
    };
    const onMove = (ev: MouseEvent) => {
      const d = svgPipDragRef.current;
      if (!d.dragging || !svgPipRef.current) return;
      const dx = ev.clientX - d.startX;
      const dy = ev.clientY - d.startY;
      svgPipRef.current.style.left = `${d.origX + dx}px`;
      svgPipRef.current.style.top = `${d.origY + dy}px`;
      svgPipRef.current.style.right = 'auto';
      svgPipRef.current.style.bottom = 'auto';
    };
    const onUp = () => {
      svgPipDragRef.current.dragging = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, []);

  // Listen for animated SVG events from aiTools
  useEffect(() => {
    const handler = (e: any) => {
      const { svgHtml, label } = e.detail || {};
      if (!svgHtml) return;
      // Wrap with optional label
      const html = label
        ? `${svgHtml}<div class="svg-overlay-label">${label}</div>`
        : svgHtml;
      setSvgOverlay(html);
      // Auto-dismiss after 30s (user can close earlier)
      if (svgOverlayTimerRef.current) clearTimeout(svgOverlayTimerRef.current);
      svgOverlayTimerRef.current = setTimeout(() => setSvgOverlay(null), 30000);
    };
    window.addEventListener('svg-animation-overlay', handler);
    return () => {
      window.removeEventListener('svg-animation-overlay', handler);
      if (svgOverlayTimerRef.current) clearTimeout(svgOverlayTimerRef.current);
    };
  }, []);

  // Theme state
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  // Handle PDF upload
  const handleFileUploaded = useCallback(async (file) => {
    setIsProcessing(true);
    setSidebarTab('chat');

    try {
      const parsed = await parsePdf(file);
      setPaperData(parsed);

      // Add system message
      setMessages(prev => [...prev, {
        id: Date.now(),
        role: 'assistant',
        text: `📄 **${parsed.title}** uploaded successfully!\n\n${parsed.pages} pages parsed. I'm ready to explain this paper. What would you like to know?`,
        timestamp: Date.now(),
      }]);

      // Auto-switch to chat tab
      setSidebarTab('chat');
    } catch (err) {
      console.error('PDF parsing error:', err);
      setMessages(prev => [...prev, {
        id: Date.now(),
        role: 'assistant',
        text: '❌ Failed to parse the PDF. Please try another file.',
        timestamp: Date.now(),
      }]);
    } finally {
      setIsProcessing(false);
    }
  }, [setMessages]);

  // Handle sending a message
  const handleSendMessage = useCallback(() => {
    if (!inputText.trim()) return;

    const userMsg = {
      id: Date.now(),
      role: 'user',
      text: inputText.trim(),
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsTyping(true);

    // Simulate AI response (replace with actual Gemini API call)
    setTimeout(() => {
      const aiMsg = {
        id: Date.now() + 1,
        role: 'assistant',
        text: paperData
          ? `Great question about "${paperData.title}"! This is where the Gemini 3 API would generate the explanation with animated SVGs and voice narration. Connect your API key to enable this feature.`
          : 'Please upload a research paper first, then I can answer your questions about it!',
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, aiMsg]);
      setIsTyping(false);
    }, 1500);
  }, [inputText, paperData, setMessages]);

  // Animate current drawing
  const handleAnimate = useCallback(async () => {
    const api = excalidrawApiRef.current;
    if (!api) return;

    const elements = api.getSceneElements();
    if (!elements || elements.length === 0) {
      return;
    }

    try {
      const svg = await exportToSvg({
        elements,
        appState: { ...api.getAppState(), exportBackground: true },
        files: api.getFiles(),
        exportPadding: 30,
      });
      const { finishedMs } = animateSvg(svg, elements);
      svg.style.width = '100%';
      svg.style.height = '100%';
      setAnimatedSvg({ svg, finishedMs });
      setIsAnimating(true);
    } catch (err) {
      console.error('Animation error:', err);
    }
  }, []);

  const handleStopAnimation = useCallback(() => {
    setIsAnimating(false);
    setAnimatedSvg(null);
  }, []);

  const handleReplay = useCallback(() => {
    if (animatedSvg?.svg) {
      animatedSvg.svg.setCurrentTime(0);
      animatedSvg.svg.unpauseAnimations();
    }
  }, [animatedSvg]);

  // Voice recognition (Gemini Live API)
  // Distinguish click (toggle) from long-press (push-to-talk) using a hold timer.
  // If mouse is held > 300ms before release, it's push-to-talk; otherwise it's a click toggle.
  const holdTimerRef = useRef<any>(null);
  const isHoldingRef = useRef(false);
  const justReleasedPushRef = useRef(false);

  const handleVoiceButtonClick = useCallback(() => {
    // If a push-to-talk cycle just ended on mouseup, skip the click event
    if (justReleasedPushRef.current) {
      justReleasedPushRef.current = false;
      return;
    }
    // Click-toggle: start or stop recording
    if (isRecording) {
      voiceStateRef.current.mode = null;
      stopRecording();
    } else {
      voiceStateRef.current.mode = 'click';
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  const handleVoiceButtonDown = useCallback(() => {
    // Don't activate push-to-talk if already recording via click-toggle
    if (voiceStateRef.current.mode === 'click') return;
    // Start a timer — if held long enough, enter push-to-talk mode
    isHoldingRef.current = true;
    holdTimerRef.current = setTimeout(() => {
      if (isHoldingRef.current) {
        voiceStateRef.current.mode = 'push';
        startRecording();
      }
    }, 300);
  }, [startRecording]);

  const handleVoiceButtonUp = useCallback(() => {
    isHoldingRef.current = false;
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    // Only stop if it was actually started via push-to-talk (held long enough)
    if (voiceStateRef.current.mode === 'push') {
      voiceStateRef.current.mode = null;
      justReleasedPushRef.current = true;
      stopRecording();
    }
  }, [stopRecording]);



  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.code === 'Space') {
        e.preventDefault();
        // If it's running via click mode, ignore the push-to-talk key
        if (voiceStateRef.current.mode !== 'click') {
          voiceStateRef.current.mode = 'push';
          startRecording();
        }
      }
    };

    const handleKeyUp = (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        // Only stop if it was started via push mode
        if (voiceStateRef.current.mode === 'push') {
          voiceStateRef.current.mode = null;
          stopRecording();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [startRecording, stopRecording]);

  return (
    <div className="app-layout">
      {/* Top Bar */}
      <header className="top-bar">
        <div className="top-bar-left">
          <button
            className="sidebar-toggle"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="18" height="18" x="3" y="3" rx="2" />
              <path d="M9 3v18" />
            </svg>
          </button>
          <div className="brand">
            <span className="brand-name">Lumina</span>
            <span className="brand-badge">AI</span>
          </div>
        </div>
        <div className="top-bar-center">
          <div className="mode-toggle-container">
            <button
              className={`mode-toggle-btn ${appMode === 'live' ? 'active' : ''}`}
              onClick={() => setAppMode('live')}
            >
              Live
            </button>
            <button
              className={`mode-toggle-btn ${appMode === 'agentic' ? 'active' : ''}`}
              onClick={() => setAppMode('agentic')}
            >
              Agentic
            </button>
          </div>
        </div>
        <div className="top-bar-right">
          <button
            className="theme-toggle"
            onClick={() => setIsDarkMode(!isDarkMode)}
            title={`Switch to ${isDarkMode ? 'Light' : 'Dark'} Mode`}
          >
            {isDarkMode ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>

          {appMode === 'live' && (
            <div className="voice-controls-container">
              <div
                className={`voice-btn ${isRecording ? 'active' : ''} ${isAudioProcessing ? 'processing' : ''} ${isResponding ? 'responding' : ''}`}
                onClick={handleVoiceButtonClick}
                onMouseDown={handleVoiceButtonDown}
                onMouseUp={handleVoiceButtonUp}
                onMouseLeave={handleVoiceButtonUp}
              >
                <div className="voice-tooltip">
                  {isConnected ? 'Hold to talk, release to send (or Ctrl+Space)' : 'Connecting to Gemini Live...'}
                </div>
                {isResponding ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="1" />
                    <circle cx="19" cy="12" r="1" />
                    <circle cx="5" cy="12" r="1" />
                  </svg>
                ) : isAudioProcessing ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="processing-spinner">
                    <path d="M12 2v4" />
                    <path d="M12 18v4" />
                    <path d="M4.93 4.93l2.83 2.83" />
                    <path d="M16.24 16.24l2.83 2.83" />
                    <path d="M2 12h4" />
                    <path d="M18 12h4" />
                    <path d="M4.93 19.07l2.83-2.83" />
                    <path d="M16.24 7.76l2.83-2.83" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <line x1="12" x2="12" y1="19" y2="22" />
                  </svg>
                )}
                <span>
                  {isResponding ? 'AI Speaking...' : isAudioProcessing ? 'Processing...' : isRecording ? 'Recording...' : (isConnected ? 'Hold to Talk' : 'Connecting...')}
                </span>
                {isRecording && <div className="voice-pulse"></div>}
                {isAudioProcessing && <div className="voice-pulse processing-pulse"></div>}
                {isResponding && <div className="voice-pulse responding-pulse"></div>}
              </div>

              <div
                className={`voice-btn screen-share-btn ${isScreenSharing ? 'active' : ''}`}
                onClick={isScreenSharing ? stopScreenShare : startScreenShare}
              >
                <div className="voice-tooltip">
                  {isScreenSharing ? 'Stop sharing screen' : 'Share screen'}
                </div>
                {isScreenSharing ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="18" height="18" x="3" y="3" rx="2" />
                    <path d="M9 3v18" />
                    <path d="m15 9-3 3 3 3" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="18" height="18" x="3" y="3" rx="2" />
                    <path d="M3 9h18" />
                  </svg>
                )}
                <span>
                  {isScreenSharing ? 'Sharing...' : 'Screen'}
                </span>
                {isScreenSharing && <div className="voice-pulse"></div>}
              </div>
            </div>
          )}
        </div>
      </header>

      <div className="main-content">
        {appMode === 'live' ? (
          <>
            {/* Sidebar */}
            <aside className={`sidebar ${isSidebarOpen ? 'open' : 'closed'}`}>
              {/* Sidebar Tabs */}
              <div className="sidebar-tabs">
                <button
                  className={`sidebar-tab ${sidebarTab === 'upload' ? 'active' : ''}`}
                  onClick={() => setSidebarTab('upload')}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                  Upload
                </button>
                <button
                  className={`sidebar-tab ${sidebarTab === 'chat' ? 'active' : ''}`}
                  onClick={() => setSidebarTab('chat')}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
                  </svg>
                  Chat
                  {messages.length > 0 && (
                    <span className="tab-badge">{messages.length}</span>
                  )}
                </button>
              </div>

              {/* Sidebar Content */}
              <div className="sidebar-content">
                {sidebarTab === 'upload' ? (
                  <div className="upload-tab">
                    <FileUpload
                      onFileUploaded={handleFileUploaded}
                      isProcessing={isProcessing}
                    />
                    {paperData && (
                      <div className="paper-summary">
                        <h4>Paper Loaded</h4>
                        <p className="paper-title">{paperData.title}</p>
                        <div className="paper-meta">
                          <span>{paperData.pages} pages</span>
                          <span>{(paperData.fileSize / 1024 / 1024).toFixed(1)} MB</span>
                        </div>
                        <button
                          className="explain-btn"
                          onClick={() => {
                            setSidebarTab('chat');
                            setMessages(prev => [...prev, {
                              id: Date.now(),
                              role: 'user',
                              text: 'Explain this paper step by step with animations',
                              timestamp: Date.now(),
                            }]);
                            setIsTyping(true);
                            setTimeout(() => {
                              setMessages(prev => [...prev, {
                                id: Date.now(),
                                role: 'assistant',
                                text: 'Connect the Gemini 3 API key to enable automatic paper explanation with animated visualizations. The AI will break down each section, generate diagrams, and narrate the explanation.',
                                timestamp: Date.now(),
                              }]);
                              setIsTyping(false);
                            }, 2000);
                          }}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polygon points="6 3 20 12 6 21 6 3" />
                          </svg>
                          Explain Paper
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="chat-tab">
                    {messages.length === 0 ? (
                      <div className="live-transcript-empty">
                        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                          <line x1="12" x2="12" y1="19" y2="22" />
                        </svg>
                        <p>Start talking to see your conversation here</p>
                        <span>Use the mic button or press Ctrl + Space</span>
                      </div>
                    ) : (
                      <ChatHistory messages={messages} isTyping={isTyping} />
                    )}
                  </div>
                )}
              </div>
            </aside>

            {/* Canvas Area */}
            <main className="canvas-area">
              {/* Excalidraw Editor */}
              <div style={{
                position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                display: isAnimating ? 'none' : 'block',
              }}>
                <Excalidraw
                  theme={isDarkMode ? "dark" : "light"}
                  excalidrawAPI={(api) => { excalidrawApiRef.current = api; }}
                  UIOptions={{
                    canvasActions: {
                      changeViewBackgroundColor: true,
                      clearCanvas: true,
                      export: false,
                      loadScene: false,
                      saveToActiveFile: false,
                      saveAsImage: true,
                      toggleTheme: false,
                    },
                  }}
                >
                  <MainMenu>
                    <MainMenu.DefaultItems.ClearCanvas />
                    <MainMenu.DefaultItems.SaveAsImage />
                    <MainMenu.DefaultItems.ChangeCanvasBackground />
                    <MainMenu.DefaultItems.Help />
                  </MainMenu>
                  <WelcomeScreen>
                    <WelcomeScreen.Hints.ToolbarHint />
                    <WelcomeScreen.Hints.HelpHint />
                  </WelcomeScreen>
                </Excalidraw>
              </div>

              {/* SVG Animation PiP (draggable floating panel — canvas stays interactive) */}
              {svgOverlay && (
                <div className="svg-pip-panel" ref={svgPipRef}>
                  <div className="svg-pip-header" onMouseDown={handlePipDragStart}>
                    <span className="svg-pip-title">▶ Animation</span>
                    <button
                      className="svg-pip-close"
                      onClick={() => {
                        setSvgOverlay(null);
                        if (svgOverlayTimerRef.current) clearTimeout(svgOverlayTimerRef.current);
                      }}
                      title="Close animation"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                  <div
                    className="svg-pip-content"
                    dangerouslySetInnerHTML={{ __html: svgOverlay }}
                  />
                </div>
              )}

              {/* Animation Viewer */}
              {isAnimating && animatedSvg && (
                <div className="animation-viewer">
                  <div
                    className="animation-svg-container"
                    ref={(el) => {
                      if (el && animatedSvg.svg && !el.contains(animatedSvg.svg)) {
                        el.innerHTML = '';
                        el.appendChild(animatedSvg.svg);
                      }
                    }}
                  />
                  <div className="animation-controls">
                    <button className="anim-btn anim-btn-replay" onClick={handleReplay}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                        <path d="M21 3v5h-5" />
                        <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                        <path d="M8 16H3v5" />
                      </svg>
                      Replay
                    </button>
                    <button className="anim-btn anim-btn-stop" onClick={handleStopAnimation}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="m12 19-7-7 7-7" />
                        <path d="M19 12H5" />
                      </svg>
                      Back to Editor
                    </button>
                  </div>
                </div>
              )}

              {/* AI Drawing Indicator */}
              {isDrawing && (
                <div className="ai-drawing-indicator">
                  <div className="ai-drawing-pulse" />
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                  </svg>
                  <span>Lumina is drawing...</span>
                </div>
              )}
            </main>
          </>
        ) : (
          <div className={`agentic-mode-container ${messages.length === 0 ? 'agentic-centered' : ''}`}>
            {messages.length === 0 ? (
              <div className="agentic-welcome">
                <div className="agentic-welcome-icon">
                  <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                    <path d="M6 12v5c3 3 9 3 12 0v-5" />
                  </svg>
                </div>
                <h1 className="agentic-welcome-title">What can I help you learn?</h1>
                <p className="agentic-welcome-subtitle">Upload a research paper to start the conversation</p>
                <div className="agentic-suggestions">
                  <button className="agentic-suggestion" onClick={() => { setInputText('Explain this paper in simple terms'); }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" /></svg>
                    Explain this paper
                  </button>
                  <button className="agentic-suggestion" onClick={() => { setInputText('What are the key findings?'); }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
                    Key findings
                  </button>
                  <button className="agentic-suggestion" onClick={() => { setInputText('Summarize the methodology'); }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
                    Summarize methodology
                  </button>
                  <button className="agentic-suggestion" onClick={() => { setInputText('Draw a diagram of the architecture'); }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="18" height="18" x="3" y="3" rx="2" /><path d="M3 9h18" /><path d="M9 21V9" /></svg>
                    Draw a diagram
                  </button>
                </div>
              </div>
            ) : (
              <div className="agentic-chat-messages">
                <ChatHistory messages={messages} isTyping={isTyping} />
              </div>
            )}
            <div className="agentic-chat-input-wrapper">
              <div className="agentic-chat-input-box">
                <div className="agentic-input-top-row">
                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                    placeholder="Message Lumina AI..."
                    className="agentic-input"
                  />
                  <button className="agentic-send" onClick={handleSendMessage} disabled={!inputText.trim()}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m5 12 7-7 7 7" />
                      <path d="M12 19V5" />
                    </svg>
                  </button>
                </div>
                <div className="agentic-input-bottom-row">
                  <div className="agentic-plus-wrapper">
                    <button className={`agentic-plus-btn ${showPlusMenu ? 'active' : ''}`} onClick={() => setShowPlusMenu(!showPlusMenu)}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12h14" />
                        <path d="M12 5v14" />
                      </svg>
                    </button>
                    {showPlusMenu && (
                      <>
                        <div className="agentic-plus-backdrop" onClick={() => setShowPlusMenu(false)} />
                        <div className="agentic-plus-menu">
                          <button className="agentic-plus-option" onClick={() => { document.getElementById('agentic-file-input').click(); setShowPlusMenu(false); }}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                            </svg>
                            Add photos & files
                          </button>
                          <button className="agentic-plus-option" onClick={() => { setVideoMode(true); setShowPlusMenu(false); }}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="m22 8-6 4 6 4V8Z" />
                              <rect width="14" height="12" x="2" y="6" rx="2" ry="2" />
                            </svg>
                            Generate video
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                  <input
                    id="agentic-file-input"
                    type="file"
                    accept=".pdf"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      if (e.target.files[0]) {
                        setAttachedFile(e.target.files[0]);
                      }
                    }}
                  />
                  {videoMode && (
                    <div className="agentic-file-chip agentic-video-chip">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m22 8-6 4 6 4V8Z" /><rect width="14" height="12" x="2" y="6" rx="2" ry="2" /></svg>
                      <span>Video</span>
                      <button className="agentic-file-chip-remove" onClick={() => setVideoMode(false)}>×</button>
                    </div>
                  )}
                  {attachedFile && (
                    <div className="agentic-file-chip">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" /></svg>
                      <span>{attachedFile.name}</span>
                      <button className="agentic-file-chip-remove" onClick={() => setAttachedFile(null)}>×</button>
                    </div>
                  )}
                </div>
              </div>
              <div className="agentic-disclaimer">Lumina AI can make mistakes. Consider verifying important information.</div>
            </div>
          </div>
        )}
      </div>
    </div >
  );
}

export default App;
