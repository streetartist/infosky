"use client";

import { useState, useEffect } from 'react';
import axios from 'axios';
import { FileText, ExternalLink, Calendar } from 'lucide-react';

interface NodeItem {
    id: number;
    label: string;
    type: string;
    content: string;
    source?: string;
    created_at?: string;
}

export default function ListView({ refreshKey, onNodeClick }: { refreshKey: number, onNodeClick: (node: NodeItem) => void }) {
    const [nodes, setNodes] = useState<NodeItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const res = await axios.get('http://localhost:8000/api/graph/');
                setNodes(res.data.nodes || []);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [refreshKey]);

    if (loading) {
        return (
            <div className="w-full h-full flex items-center justify-center">
                <div className="text-gray-500 animate-pulse">Loading...</div>
            </div>
        );
    }

    if (nodes.length === 0) {
        return (
            <div className="w-full h-screen flex items-center justify-center flex-col gap-4">
                <FileText size={64} className="text-gray-700" />
                <p className="text-xl text-gray-400 font-medium">暂无知识节点</p>
                <p className="text-gray-500 text-sm">在下方输入框添加你的第一条知识</p>
            </div>
        );
    }

    return (
        <div className="w-full h-full overflow-y-auto pt-24 pb-32 px-8">
            <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {nodes.map((node) => (
                    <div
                        key={node.id}
                        className="bg-gray-900/80 backdrop-blur border border-gray-800 rounded-xl p-4 hover:border-blue-500/50 cursor-pointer transition-all hover:shadow-lg hover:shadow-blue-500/10 group"
                        onClick={() => onNodeClick(node)}
                    >
                        <div className="flex justify-between items-start mb-2">
                            <span className="text-xs font-medium text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded">
                                {node.type}
                            </span>
                            {node.source?.startsWith('http') && (
                                <a href={node.source} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-gray-500 hover:text-blue-400">
                                    <ExternalLink size={14} />
                                </a>
                            )}
                        </div>
                        <h3 className="text-lg font-bold text-white mb-2 group-hover:text-blue-300 transition">{node.label}</h3>
                        <p className="text-gray-400 text-sm line-clamp-3">{node.content}</p>
                        {node.created_at && (
                            <div className="mt-3 flex items-center gap-1 text-xs text-gray-600">
                                <Calendar size={12} />
                                {new Date(node.created_at).toLocaleDateString()}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
