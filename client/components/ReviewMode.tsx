"use client";

import { useState, useEffect } from 'react';
import axios from 'axios';
import { X, RefreshCw } from 'lucide-react';
import MarkdownRenderer from './MarkdownRenderer';

interface ReviewModeProps {
    onClose: () => void;
}

interface NodeData {
    id: number;
    label: string;
    type: string;
    content: string;
    summary?: string;
}

export default function ReviewMode({ onClose }: ReviewModeProps) {
    const [node, setNode] = useState<NodeData | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchRandomNode = async () => {
        setLoading(true);
        try {
            const res = await axios.get('http://localhost:8000/api/graph/random');
            setNode(res.data);
        } catch (error) {
            console.error("Failed to fetch node", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRandomNode();
    }, []);

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-gray-900 border border-gray-700 rounded-2xl max-w-lg w-full p-8 shadow-2xl relative">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-400 hover:text-white transition"
                >
                    <X size={24} />
                </button>

                {loading ? (
                    <div className="flex justify-center py-20">
                        <RefreshCw className="animate-spin text-purple-500" size={32} />
                    </div>
                ) : node ? (
                    <div className="space-y-6">
                        <div className="space-y-2">
                            <span className="text-xs font-medium text-purple-400 uppercase tracking-wider border border-purple-500/30 px-2 py-1 rounded">
                                {node.type}
                            </span>
                            <h2 className="text-3xl font-bold text-white mt-2">{node.label}</h2>
                        </div>

                        <div className="bg-gray-800/50 p-6 rounded-xl border border-gray-700/50 max-h-64 overflow-y-auto">
                            <MarkdownRenderer content={node.content} className="text-lg" />
                        </div>

                        <div className="pt-4 flex justify-end">
                            <button
                                onClick={fetchRandomNode}
                                className="flex items-center space-x-2 bg-gradient-to-r from-pink-600 to-purple-600 px-6 py-2 rounded-lg text-white font-medium hover:opacity-90 transition"
                            >
                                <RefreshCw size={18} />
                                <span>下一个</span>
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-10 text-gray-400">
                        <p>星空空空如也，快去添加一些知识吧！</p>
                    </div>
                )}
            </div>
        </div>
    );
}
