"use client";

import { useState, useRef, useEffect } from 'react';
import { MessageSquare, Send, X, Bot, User } from 'lucide-react';
import MarkdownRenderer from './MarkdownRenderer';

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

export default function ChatMode() {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([
        { role: 'assistant', content: '你好！我是你的知识助手。有关你的笔记，随时问我。' }
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isOpen]);

    const handleSend = async () => {
        if (!input.trim()) return;

        const userMsg = input;
        setInput('');
        setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
        setLoading(true);

        // Add empty assistant message that we'll stream into
        setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

        try {
            const response = await fetch('http://localhost:8000/api/chat/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ message: userMsg }),
            });

            if (!response.ok) {
                throw new Error('Network response was not ok');
            }

            const reader = response.body?.getReader();
            const decoder = new TextDecoder();

            if (!reader) {
                throw new Error('No reader available');
            }

            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });

                // Process complete SSE events
                const lines = buffer.split('\n');
                buffer = lines.pop() || ''; // Keep incomplete line in buffer

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const jsonStr = line.slice(6);
                        try {
                            const data = JSON.parse(jsonStr);
                            if (data.content) {
                                // Append to the last message
                                setMessages(prev => {
                                    const updated = [...prev];
                                    const lastIdx = updated.length - 1;
                                    if (updated[lastIdx].role === 'assistant') {
                                        updated[lastIdx] = {
                                            ...updated[lastIdx],
                                            content: updated[lastIdx].content + data.content
                                        };
                                    }
                                    return updated;
                                });
                            }
                        } catch {
                            // Ignore parse errors for incomplete JSON
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Chat error:', error);
            setMessages(prev => {
                const updated = [...prev];
                const lastIdx = updated.length - 1;
                if (updated[lastIdx].role === 'assistant' && updated[lastIdx].content === '') {
                    updated[lastIdx] = { role: 'assistant', content: '抱歉，我现在有点累（连接错误）。' };
                }
                return updated;
            });
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-24 right-5 z-50 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white p-4 rounded-full shadow-lg transition-all hover:scale-110"
            >
                <MessageSquare size={24} />
            </button>
        );
    }

    return (
        <div className="fixed bottom-24 right-5 z-50 w-80 md:w-96 bg-gray-900/95 backdrop-blur-xl border border-gray-700 rounded-2xl shadow-2xl flex flex-col h-[500px] overflow-hidden">
            {/* Header */}
            <div className="bg-gray-800/50 p-4 border-b border-gray-700 flex justify-between items-center">
                <h3 className="font-bold text-white flex items-center gap-2">
                    <Bot size={18} className="text-cyan-400" /> 星空对话
                </h3>
                <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-white">
                    <X size={18} />
                </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 text-sm" ref={scrollRef}>
                {messages.map((msg, idx) => (
                    <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-blue-600' : 'bg-cyan-600'}`}>
                            {msg.role === 'user' ? <User size={14} /> : <Bot size={14} />}
                        </div>
                        <div className={`p-3 rounded-2xl max-w-[80%] ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-gray-800 text-gray-200 rounded-tl-none border border-gray-700'}`}>
                            {msg.role === 'assistant' && msg.content ? (
                                <MarkdownRenderer content={msg.content} className="text-sm" />
                            ) : (
                                msg.content || (loading && idx === messages.length - 1 ? <span className="animate-pulse">▊</span> : '')
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Input */}
            <div className="p-3 border-t border-gray-700 bg-gray-800/30">
                <div className="flex gap-2">
                    <input
                        type="text"
                        className="flex-1 bg-gray-900 border border-gray-700 rounded-full px-4 py-2 text-white text-sm outline-none focus:border-cyan-500"
                        placeholder="Ask me anything..."
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSend()}
                    />
                    <button
                        onClick={handleSend}
                        disabled={loading || !input.trim()}
                        className="bg-cyan-600 hover:bg-cyan-500 text-white p-2 rounded-full disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Send size={18} />
                    </button>
                </div>
            </div>
        </div>
    );
}
