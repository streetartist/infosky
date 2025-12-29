"use client";

import { useState } from 'react';
import axios from 'axios';
import { X, Trash2, Save, Edit2 } from 'lucide-react';
import MarkdownRenderer from './MarkdownRenderer';

interface NodeData {
    id: number;
    label: string;
    type: string;
    content: string;
    source?: string;
}

interface NodeEditorProps {
    node: NodeData;
    onClose: () => void;
    onUpdate: () => void;
}

export default function NodeEditor({ node, onClose, onUpdate }: NodeEditorProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState({ ...node });
    const [loading, setLoading] = useState(false);

    const handleDelete = async () => {
        if (!confirm('确定要删除这个节点吗？此操作无法撤销。')) return;

        setLoading(true);
        try {
            await axios.delete(`http://localhost:8000/api/graph/nodes/${node.id}`);
            onUpdate();
            onClose();
        } catch (error) {
            console.error("Delete failed", error);
            alert("删除失败");
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            await axios.put(`http://localhost:8000/api/graph/nodes/${node.id}`, formData);
            onUpdate();
            setIsEditing(false);
        } catch (error) {
            console.error("Update failed", error);
            alert("更新失败");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 pointer-events-auto">
            <div className="bg-gray-900 border border-gray-700 rounded-xl max-w-lg w-full p-6 shadow-2xl relative">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-400 hover:text-white transition"
                >
                    <X size={20} />
                </button>

                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold text-white flex gap-2 items-center">
                        {isEditing ? '编辑节点' : '节点详情'}
                    </h2>
                    {!isEditing && (
                        <div className="flex gap-2">
                            <button
                                onClick={() => setIsEditing(true)}
                                className="p-2 text-blue-400 hover:bg-blue-500/10 rounded transition"
                                title="Edit"
                            >
                                <Edit2 size={18} />
                            </button>
                            <button
                                onClick={handleDelete}
                                className="p-2 text-red-400 hover:bg-red-500/10 rounded transition"
                                title="Delete"
                            >
                                <Trash2 size={18} />
                            </button>
                        </div>
                    )}
                </div>

                {isEditing ? (
                    <div className="space-y-4">
                        <div>
                            <label className="text-gray-400 text-xs uppercase">Label</label>
                            <input
                                type="text"
                                value={formData.label}
                                onChange={e => setFormData({ ...formData, label: e.target.value })}
                                className="w-full bg-gray-800 text-white p-2 rounded border border-gray-700 mt-1"
                            />
                        </div>
                        <div>
                            <label className="text-gray-400 text-xs uppercase">Type</label>
                            <input
                                type="text"
                                value={formData.type}
                                onChange={e => setFormData({ ...formData, type: e.target.value })}
                                className="w-full bg-gray-800 text-white p-2 rounded border border-gray-700 mt-1"
                            />
                        </div>
                        <div>
                            <label className="text-gray-400 text-xs uppercase">Content</label>
                            <textarea
                                value={formData.content}
                                onChange={e => setFormData({ ...formData, content: e.target.value })}
                                className="w-full bg-gray-800 text-white p-2 rounded border border-gray-700 mt-1 h-32"
                            />
                        </div>
                        <div className="flex gap-2 justify-end pt-2">
                            <button
                                onClick={() => setIsEditing(false)}
                                className="px-4 py-2 text-gray-400 hover:text-white"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={loading}
                                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded flex items-center gap-2"
                            >
                                <Save size={16} /> Save
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div>
                            <span className="text-xs font-medium text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded">
                                {node.type}
                            </span>
                            <h3 className="text-2xl font-bold text-white mt-2">{node.label}</h3>
                            {node.source && (
                                <div className="mt-1 text-xs text-gray-500 flex items-center gap-1">
                                    <span>Source:</span>
                                    {node.source.startsWith('http') ? (
                                        <a href={node.source} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline truncate max-w-[300px]">
                                            {node.source}
                                        </a>
                                    ) : (
                                        <span>{node.source}</span>
                                    )}
                                </div>
                            )}
                        </div>
                        <div className="text-gray-300 leading-relaxed bg-black/20 p-4 rounded-lg max-h-64 overflow-y-auto">
                            <MarkdownRenderer content={node.content} />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
