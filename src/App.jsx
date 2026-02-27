import { useState, useRef, useCallback, useEffect } from 'react';
import { Excalidraw, MainMenu, WelcomeScreen, exportToSvg } from '@excalidraw/excalidraw';
import { animateSvg } from 'excalidraw-animate';
import '@excalidraw/excalidraw/index.css';
import './App.css';

import FileUpload from './components/FileUpload';
import ChatHistory from './components/ChatHistory';
import { parsePdf } from './services/pdfParser';

function App() {
  // Sidebar state
  const [sidebarTab, setSidebarTab] = useState('upload'); // 'upload' | 'chat'
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // PDF state
  const [paperData, setPaperData] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Chat state
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  // Voice state
  const [isListening, setIsListening] = useState(false);
  const [voiceText, setVoiceText] = useState('');
  const recognitionRef = useRef(null);
  const voiceStateRef = useRef({ isListening: false, text: '', mode: null }); // mode: 'click' | 'push'

  // Excalidraw
  const excalidrawApiRef = useRef(null);

  // Animation state
  const [isAnimating, setIsAnimating] = useState(false);
  const [animatedSvg, setAnimatedSvg] = useState(null);

  // Canvas SVG overlay (for AI-generated SVG animations)
  const [svgOverlay, setSvgOverlay] = useState(null);

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
  }, []);

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
  }, [inputText, paperData]);

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

  // Voice recognition
  const startListening = useCallback((mode = 'push') => {
    if (voiceStateRef.current.isListening) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech recognition not supported. Use Chrome or Edge.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onstart = () => {
      setIsListening(true);
      voiceStateRef.current.isListening = true;
      voiceStateRef.current.mode = mode;
      setVoiceText('Listening...');
      voiceStateRef.current.text = '';
    };

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map(r => r[0].transcript)
        .join('');
      setVoiceText(transcript);
      voiceStateRef.current.text = transcript;
    };

    recognition.onerror = () => {
      setIsListening(false);
      voiceStateRef.current.isListening = false;
      voiceStateRef.current.mode = null;
      setVoiceText('');
      voiceStateRef.current.text = '';
    };

    recognition.onend = () => {
      setIsListening(false);
      voiceStateRef.current.isListening = false;
      voiceStateRef.current.mode = null;
    };

    recognition.start();
  }, [setIsListening, setVoiceText]);

  const stopListening = useCallback((triggeredByMode) => {
    if (!voiceStateRef.current.isListening) return;

    // Only stop if the event triggering the stop matches the mode that started it
    // i.e., letting go of space bar only stops it if it was started via space bar
    if (triggeredByMode && triggeredByMode !== voiceStateRef.current.mode) return;

    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }

    setIsListening(false);
    voiceStateRef.current.isListening = false;
    voiceStateRef.current.mode = null;

    const transcript = voiceStateRef.current.text.trim();
    setVoiceText('');
    voiceStateRef.current.text = '';

    if (transcript && transcript !== 'Listening...') {
      // Add as user message
      setMessages(prev => [...prev, {
        id: Date.now(),
        role: 'user',
        text: transcript,
        timestamp: Date.now(),
      }]);
      setIsTyping(true);

      // Simulate AI response
      setTimeout(() => {
        setMessages(prev => [...prev, {
          id: Date.now(),
          role: 'assistant',
          text: `I heard: "${transcript}". Connect Gemini 3 API to get real answers about your paper!`,
          timestamp: Date.now(),
        }]);
        setIsTyping(false);
      }, 1500);
    }
  }, [setIsListening, setVoiceText, setMessages, setIsTyping]);

  const handleVoiceButtonClick = useCallback((e) => {
    // If it's already listening, clicking it toggles it off
    if (voiceStateRef.current.isListening) {
      stopListening('click');
    } else {
      // It wasn't listening, so clicking toggles it on permanently (until clicked again)
      startListening('click');
    }
  }, [startListening, stopListening]);

  const handleVoiceButtonDown = useCallback((e) => {
    // Only trigger push-to-talk on mouse down if it's not already running in click mode
    if (voiceStateRef.current.mode !== 'click') {
      startListening('push');
    }
  }, [startListening]);

  const handleVoiceButtonUp = useCallback((e) => {
    // Only trigger stop on mouse release if it was started via push-to-talk
    if (voiceStateRef.current.mode === 'push') {
      stopListening('push');
    }
  }, [stopListening]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.code === 'Space') {
        e.preventDefault();
        // If it's running via click mode, ignore the push-to-talk key
        if (voiceStateRef.current.mode !== 'click') {
          startListening('push');
        }
      }
    };

    const handleKeyUp = (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        // Only stop if it was started via push mode
        if (voiceStateRef.current.mode === 'push') {
          stopListening('push');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [startListening, stopListening]);

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
            <div className="brand-icon">
              {/* College Graduation Cap / Brain combo icon */}
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                <path d="M6 12v5c3 3 9 3 12 0v-5" />
              </svg>
            </div>
            <span className="brand-name">CampusMind</span>
            <span className="brand-badge">AI</span>
          </div>
        </div>
        <div className="top-bar-center">
          {paperData && (
            <div className="paper-indicator">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              <span>{paperData.title.substring(0, 60)}{paperData.title.length > 60 ? '...' : ''}</span>
            </div>
          )}
        </div>
        <div className="top-bar-right">
          <div
            className={`voice-btn ${isListening ? 'active' : ''}`}
            onClick={handleVoiceButtonClick}
            onMouseDown={handleVoiceButtonDown}
            onMouseUp={handleVoiceButtonUp}
            onMouseLeave={handleVoiceButtonUp}
            title="Click to toggle or hold Ctrl + Space"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" x2="12" y1="19" y2="22" />
            </svg>
            <span>{isListening ? voiceText || 'Listening...' : 'Gemini Live'}</span>
            {isListening && <div className="voice-pulse"></div>}
          </div>
        </div>
      </header>

      <div className="main-content">
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
                <ChatHistory messages={messages} isTyping={isTyping} />
                <div className="chat-input-bar">
                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                    placeholder={paperData ? 'Ask about the paper...' : 'Upload a paper first...'}
                    className="chat-input"
                  />
                  <button className="chat-send" onClick={handleSendMessage} disabled={!inputText.trim()}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m5 12 7-7 7 7" />
                      <path d="M12 19V5" />
                    </svg>
                  </button>
                </div>
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
              theme="light"
              excalidrawAPI={(api) => { excalidrawApiRef.current = api; }}
              UIOptions={{
                canvasActions: {
                  changeViewBackgroundColor: true,
                  clearCanvas: true,
                  export: false,
                  loadScene: false,
                  saveToActiveFile: false,
                  saveAsImage: true,
                  theme: false,
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

          {/* SVG Overlay (for AI-generated SVG animations) */}
          {svgOverlay && (
            <div
              className="svg-animation-overlay"
              dangerouslySetInnerHTML={{ __html: svgOverlay }}
            />
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

          {/* Animate Button */}
          {!isAnimating && (
            <button className="animate-btn" onClick={handleAnimate} title="Animate your drawing">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="6 3 20 12 6 21 6 3" />
              </svg>
              Animate
            </button>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
