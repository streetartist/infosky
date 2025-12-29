"use client";

import { useState } from 'react';
import axios from 'axios';
import { Send, Loader2 } from 'lucide-react';

export default function InputBox({ onIngest }: { onIngest: () => void }) {
    const [text, setText] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!text.trim()) return;

        setLoading(true);
        try {
            await axios.post('http://localhost:8000/api/ingest/', { text });
            setText('');
            onIngest(); // Refresh graph
        } catch (error) {
            console.error("Failed to ingest", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 w-full max-w-2xl px-4 z-50">
            <form onSubmit={handleSubmit} className="relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-pink-600 to-purple-600 rounded-lg blur opacity-75 group-hover:opacity-100 transition duration-1000 group-hover:duration-200 animate-tilt"></div>
                <div className="relative flex items-center bg-gray-900 rounded-lg p-2 leading-none">
                    <input
                        type="text"
                        className="flex-1 bg-transparent text-white px-4 py-3 outline-none placeholder-gray-400"
                        placeholder="输入任何灵感、笔记或链接，构建你的知识星空..."
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        disabled={loading}
                    />
                    <button
                        type="submit"
                        disabled={loading}
                        className="bg-indigo-600 text-white p-3 rounded-md hover:bg-indigo-700 transition duration-200 disabled:opacity-50"
                    >
                        {loading ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
                    </button>
                </div>
            </form>
        </div>
    );
}
