"use client";

import { useState, useEffect } from 'react';
import axios from 'axios';
import { X, Plus, Link2 } from 'lucide-react';

interface NodeOption {
    id: number;
    label: string;
}

interface NodeCreatorProps {
    onClose: () => void;
    onCreated: () => void;
    nodes?: NodeOption[];  // For edge creation
    mode?: 'node' | 'edge';
    defaultSourceId?: number;  // Pre-select source node
}

export default function NodeCreator({ onClose, onCreated, nodes = [], mode = 'node', defaultSourceId }: NodeCreatorProps) {
    const [label, setLabel] = useState('');
    const [type, setType] = useState('概念');
    const [content, setContent] = useState('');

    const [sourceId, setSourceId] = useState<number | ''>('');
    const [targetId, setTargetId] = useState<number | ''>('');
    const [relationType, setRelationType] = useState('相关');

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (defaultSourceId) {
            setSourceId(defaultSourceId);
        }
    }, [defaultSourceId]);

    const handleCreateNode = async () => {
        if (!label.trim()) {
            setError('请输入节点名称');
            return;
        }

        setLoading(true);
        setError('');
        try {
            await axios.post('http://localhost:8000/api/graph/nodes', {
                label: label.trim(),
                type,
                content
            });
            onCreated();
            onClose();
        } catch (err) {
            setError('创建失败');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateEdge = async () => {
        if (!sourceId || !targetId) {
            setError('请选择两个节点');
            return;
        }
        if (sourceId === targetId) {
            setError('不能连接到自身');
            return;
        }

        setLoading(true);
        setError('');
        try {
            await axios.post('http://localhost:8000/api/graph/edges', {
                source_id: Number(sourceId),
                target_id: Number(targetId),
                relation_type: relationType
            });
            onCreated();
            onClose();
        } catch (err: any) {
            setError(err.response?.data?.detail || '创建失败');
        } finally {
            setLoading(false);
        }
    };

    const nodeTypes = ['概念', '理论', '工具', '人物', '事件', '方法', '案例', '领域'];
    const relationTypes = ['相关', '属于', '包含', '导致', '影响', '依赖', '类似', '对比', '定义为'];

    return (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
            <div className="bg-gray-900 border border-gray-700 rounded-xl max-w-md w-full p-6 shadow-2xl">
                {/* Header */}
                <div className="flex justify-between items-center mb-5">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        {mode === 'node' ? (
                            <><Plus size={20} className="text-cyan-400" /> 新建节点</>
                        ) : (
                            <><Link2 size={20} className="text-purple-400" /> 新建连接</>
                        )}
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white">
                        <X size={20} />
                    </button>
                </div>

                {mode === 'node' ? (
                    <div className="space-y-4">
                        {/* Label */}
                        <div>
                            <label className="text-xs text-gray-400 uppercase mb-1 block">名称 *</label>
                            <input
                                type="text"
                                value={label}
                                onChange={e => setLabel(e.target.value)}
                                placeholder="概念名称"
                                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:border-cyan-500 outline-none"
                                autoFocus
                            />
                        </div>

                        {/* Type */}
                        <div>
                            <label className="text-xs text-gray-400 uppercase mb-1 block">类型</label>
                            <select
                                value={type}
                                onChange={e => setType(e.target.value)}
                                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:border-cyan-500 outline-none"
                            >
                                {nodeTypes.map(t => (
                                    <option key={t} value={t}>{t}</option>
                                ))}
                            </select>
                        </div>

                        {/* Content */}
                        <div>
                            <label className="text-xs text-gray-400 uppercase mb-1 block">内容描述</label>
                            <textarea
                                value={content}
                                onChange={e => setContent(e.target.value)}
                                placeholder="详细描述（可选）"
                                rows={4}
                                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:border-cyan-500 outline-none resize-none"
                            />
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {/* Source Node */}
                        <div>
                            <label className="text-xs text-gray-400 uppercase mb-1 block">源节点</label>
                            <select
                                value={sourceId}
                                onChange={e => setSourceId(Number(e.target.value) || '')}
                                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:border-purple-500 outline-none"
                            >
                                <option value="">选择节点...</option>
                                {nodes.map(n => (
                                    <option key={n.id} value={n.id}>{n.label}</option>
                                ))}
                            </select>
                        </div>

                        {/* Relation Type */}
                        <div>
                            <label className="text-xs text-gray-400 uppercase mb-1 block">关系类型</label>
                            <select
                                value={relationType}
                                onChange={e => setRelationType(e.target.value)}
                                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:border-purple-500 outline-none"
                            >
                                {relationTypes.map(r => (
                                    <option key={r} value={r}>{r}</option>
                                ))}
                            </select>
                        </div>

                        {/* Target Node */}
                        <div>
                            <label className="text-xs text-gray-400 uppercase mb-1 block">目标节点</label>
                            <select
                                value={targetId}
                                onChange={e => setTargetId(Number(e.target.value) || '')}
                                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:border-purple-500 outline-none"
                            >
                                <option value="">选择节点...</option>
                                {nodes.map(n => (
                                    <option key={n.id} value={n.id}>{n.label}</option>
                                ))}
                            </select>
                        </div>

                        {/* Preview */}
                        {sourceId && targetId && (
                            <div className="bg-gray-800/50 rounded-lg p-3 text-center text-sm">
                                <span className="text-cyan-400">{nodes.find(n => n.id === sourceId)?.label}</span>
                                <span className="text-purple-400 mx-2">→ {relationType} →</span>
                                <span className="text-cyan-400">{nodes.find(n => n.id === targetId)?.label}</span>
                            </div>
                        )}
                    </div>
                )}

                {/* Error */}
                {error && (
                    <div className="bg-red-500/20 text-red-400 text-sm p-2 rounded-lg mt-4">
                        {error}
                    </div>
                )}

                {/* Actions */}
                <div className="flex gap-3 mt-5">
                    <button
                        onClick={onClose}
                        className="flex-1 py-2.5 rounded-lg border border-gray-700 text-gray-400 hover:text-white hover:border-gray-600 transition"
                    >
                        取消
                    </button>
                    <button
                        onClick={mode === 'node' ? handleCreateNode : handleCreateEdge}
                        disabled={loading}
                        className={`flex-1 py-2.5 rounded-lg font-medium flex items-center justify-center gap-2 transition disabled:opacity-50 ${mode === 'node'
                                ? 'bg-cyan-600 hover:bg-cyan-500 text-white'
                                : 'bg-purple-600 hover:bg-purple-500 text-white'
                            }`}
                    >
                        {loading ? '创建中...' : '创建'}
                    </button>
                </div>
            </div>
        </div>
    );
}
