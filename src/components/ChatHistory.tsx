import { useRef, useEffect } from 'react';

export default function ChatHistory({ messages, isTyping }) {
    const endRef = useRef(null);

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isTyping]);

    return (
        <div className="chat-history">
            {messages.length === 0 ? (
                <div className="chat-empty">
                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.3">
                        <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
                    </svg>
                    <p>Upload a paper to start the conversation</p>
                </div>
            ) : (
                messages.map((msg) => (
                    <div key={msg.id} className={`chat-msg ${msg.role}`}>
                        {msg.role === 'assistant' && (
                            <div className="chat-msg-avatar">
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M12 8V4H8" />
                                    <rect width="16" height="12" x="4" y="8" rx="2" />
                                    <path d="M2 14h2" />
                                    <path d="M20 14h2" />
                                    <path d="M15 13v2" />
                                    <path d="M9 13v2" />
                                </svg>
                            </div>
                        )}
                        <div className="chat-msg-content">
                            {msg.type === 'svg' ? (
                                <div
                                    className="chat-svg-preview"
                                    dangerouslySetInnerHTML={{ __html: msg.text }}
                                />
                            ) : (
                                <p>{msg.text}</p>
                            )}
                            {msg.timestamp && (
                                <span className="chat-msg-time">
                                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            )}
                        </div>
                    </div>
                ))
            )}
            {isTyping && (
                <div className="chat-msg assistant">
                    <div className="chat-msg-avatar">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M12 8V4H8" />
                            <rect width="16" height="12" x="4" y="8" rx="2" />
                            <path d="M2 14h2" />
                            <path d="M20 14h2" />
                            <path d="M15 13v2" />
                            <path d="M9 13v2" />
                        </svg>
                    </div>
                    <div className="chat-msg-content">
                        <div className="typing-indicator">
                            <span></span><span></span><span></span>
                        </div>
                    </div>
                </div>
            )}
            <div ref={endRef} />
        </div>
    );
}
