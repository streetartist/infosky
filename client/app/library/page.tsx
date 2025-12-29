"use client";

import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import Link from 'next/link';
import {
    ArrowLeft, Search, FileText, Link as LinkIcon, Calendar,
    Trash2, MessageSquare, Send, X, Bot, User
} from 'lucide-react';
import MarkdownRenderer from '../../components/MarkdownRenderer';

interface RawInputItem {
    id: number;
    input_type: string;
    original_input: string;
    fetched_content?: string;
    title?: string;
    created_at: string;
}

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

export default function LibraryPage() {
    const [items, setItems] = useState<RawInputItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedItem, setSelectedItem] = useState<RawInputItem | null>(null);
    const [showChat, setShowChat] = useState(false);
    const [messages, setMessages] = useState<Message[]>([
        { role: 'assistant', content: '有什么关于你知识库内容的问题？' }
    ]);
    const [chatInput, setChatInput] = useState('');
    const [chatLoading, setChatLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    const fetchItems = async (query?: string) => {
        setLoading(true);
        try {
            const endpoint = query
                ? `http://localhost:8000/api/library/search/?q=${query}`
                : 'http://localhost:8000/api/library/';
            const res = await axios.get(endpoint);
            setItems(res.data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchItems();
    }, []);

    useEffect(() => {
        const debounce = setTimeout(() => {
            if (searchQuery) {
                fetchItems(searchQuery);
            } else {
                fetchItems();
            }
        }, 300);
        return () => clearTimeout(debounce);
    }, [searchQuery]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleDelete = async (id: number) => {
        if (!confirm('确定删除这条记录吗？')) return;
        try {
            await axios.delete(`http://localhost:8000/api/library/${id}`);
            fetchItems(searchQuery);
            if (selectedItem?.id === id) setSelectedItem(null);
        } catch (error) {
            alert('删除失败');
        }
    };

    const handleChatSend = async () => {
        if (!chatInput.trim()) return;
        const msg = chatInput;
        setChatInput('');
        setMessages(prev => [...prev, { role: 'user', content: msg }]);
        setChatLoading(true);

        // Add empty assistant message that we'll stream into
        setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

        try {
            const response = await fetch('http://localhost:8000/api/library/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ message: msg }),
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
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const jsonStr = line.slice(6);
                        try {
                            const data = JSON.parse(jsonStr);
                            if (data.content) {
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
                            // Ignore parse errors
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
                    updated[lastIdx] = { role: 'assistant', content: '请求失败，请稍后再试。' };
                }
                return updated;
            });
        } finally {
            setChatLoading(false);
        }
    };

    return (
        <main className="min-h-screen bg-black text-white">
            {/* Header */}
            <div className="fixed top-0 left-0 w-full z-50 bg-black/80 backdrop-blur-lg border-b border-gray-800 p-4">
                <div className="max-w-6xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/" className="p-2 hover:bg-gray-800 rounded-full transition">
                            <ArrowLeft size={20} />
                        </Link>
                        <div>
                            <h1 className="text-xl font-bold">知识库</h1>
                            <p className="text-xs text-gray-500">所有原始输入和网页内容</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="flex items-center bg-gray-800/50 border border-gray-700 rounded-full px-4 py-2">
                            <Search size={16} className="text-gray-400 mr-2" />
                            <input
                                type="text"
                                placeholder="搜索内容..."
                                className="bg-transparent border-none outline-none text-sm w-48"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="pt-24 pb-8 px-4 max-w-6xl mx-auto">
                {loading ? (
                    <div className="flex items-center justify-center h-64">
                        <div className="animate-pulse text-gray-500">Loading...</div>
                    </div>
                ) : items.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 gap-4">
                        <FileText size={48} className="text-gray-700" />
                        <p className="text-gray-400">暂无知识库记录</p>
                        <p className="text-gray-500 text-sm">在首页输入内容后会自动保存到这里</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {items.map(item => (
                            <div
                                key={item.id}
                                className="bg-gray-900/80 border border-gray-800 rounded-xl p-4 hover:border-cyan-500/50 cursor-pointer transition group"
                                onClick={() => setSelectedItem(item)}
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <span className={`text-xs px-2 py-0.5 rounded ${item.input_type === 'url' ? 'bg-blue-500/20 text-blue-400' : 'bg-green-500/20 text-green-400'}`}>
                                        {item.input_type === 'url' ? <LinkIcon size={12} className="inline mr-1" /> : <FileText size={12} className="inline mr-1" />}
                                        {item.input_type === 'url' ? '网页' : '文本'}
                                    </span>
                                    <button
                                        onClick={e => { e.stopPropagation(); handleDelete(item.id); }}
                                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 rounded transition"
                                    >
                                        <Trash2 size={14} className="text-red-400" />
                                    </button>
                                </div>
                                <h3 className="font-bold text-white mb-2 line-clamp-1">{item.title || item.original_input.slice(0, 50)}</h3>
                                <p className="text-gray-400 text-sm line-clamp-3">{item.fetched_content || item.original_input}</p>
                                <div className="mt-3 flex items-center gap-1 text-xs text-gray-600">
                                    <Calendar size={12} />
                                    {new Date(item.created_at).toLocaleDateString()}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Detail Modal */}
            {selectedItem && (
                <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setSelectedItem(null)}>
                    <div className="bg-gray-900 border border-gray-700 rounded-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <span className={`text-xs px-2 py-0.5 rounded ${selectedItem.input_type === 'url' ? 'bg-blue-500/20 text-blue-400' : 'bg-green-500/20 text-green-400'}`}>
                                    {selectedItem.input_type === 'url' ? '网页' : '文本'}
                                </span>
                                <h2 className="text-xl font-bold mt-2">{selectedItem.title || '无标题'}</h2>
                                {selectedItem.input_type === 'url' && (
                                    <a href={selectedItem.original_input} target="_blank" rel="noopener noreferrer" className="text-blue-400 text-sm hover:underline">
                                        {selectedItem.original_input}
                                    </a>
                                )}
                            </div>
                            <button onClick={() => setSelectedItem(null)} className="p-2 hover:bg-gray-800 rounded-full">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="bg-black/30 rounded-lg p-4 text-gray-300 text-sm max-h-96 overflow-y-auto">
                            <MarkdownRenderer content={selectedItem.fetched_content || selectedItem.original_input} />
                        </div>
                    </div>
                </div>
            )}

            {/* Chat FAB */}
            {!showChat ? (
                <button
                    onClick={() => setShowChat(true)}
                    className="fixed bottom-6 right-6 bg-gradient-to-r from-cyan-500 to-blue-500 p-4 rounded-full shadow-lg hover:scale-110 transition z-40"
                >
                    <MessageSquare size={24} />
                </button>
            ) : (
                <div className="fixed bottom-6 right-6 w-80 md:w-96 bg-gray-900/95 backdrop-blur-xl border border-gray-700 rounded-2xl shadow-2xl flex flex-col h-[450px] z-40">
                    <div className="bg-gray-800/50 p-3 border-b border-gray-700 flex justify-between items-center rounded-t-2xl">
                        <span className="font-bold flex items-center gap-2"><Bot size={16} className="text-cyan-400" /> 知识库问答</span>
                        <button onClick={() => setShowChat(false)}><X size={18} /></button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3 space-y-3" ref={scrollRef}>
                        {messages.map((msg, idx) => (
                            <div key={idx} className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                                <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-blue-600' : 'bg-cyan-600'}`}>
                                    {msg.role === 'user' ? <User size={12} /> : <Bot size={12} />}
                                </div>
                                <div className={`p-2 rounded-xl text-sm max-w-[80%] ${msg.role === 'user' ? 'bg-blue-600 rounded-tr-none' : 'bg-gray-800 border border-gray-700 rounded-tl-none'}`}>
                                    {msg.role === 'assistant' && msg.content ? (
                                        <MarkdownRenderer content={msg.content} className="text-sm" />
                                    ) : (
                                        msg.content || (chatLoading && idx === messages.length - 1 ? <span className="animate-pulse">▊</span> : '')
                                    )}
                                </div>
                            </div>
                        ))}
                        {chatLoading && <div className="text-gray-500 text-sm animate-pulse">Thinking...</div>}
                    </div>
                    <div className="p-2 border-t border-gray-700">
                        <div className="flex gap-2">
                            <input
                                type="text"
                                className="flex-1 bg-gray-800 border border-gray-700 rounded-full px-3 py-2 text-sm outline-none focus:border-cyan-500"
                                placeholder="问我任何问题..."
                                value={chatInput}
                                onChange={e => setChatInput(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleChatSend()}
                            />
                            <button onClick={handleChatSend} disabled={chatLoading} className="bg-cyan-600 p-2 rounded-full disabled:opacity-50">
                                <Send size={16} />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}
