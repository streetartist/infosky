"use client";

import { useState, useEffect } from 'react';
import axios from 'axios';
import { X, Save, Key, Globe, Bot, Database, Zap } from 'lucide-react';

interface SettingsModalProps {
    onClose: () => void;
}

export default function SettingsModal({ onClose }: SettingsModalProps) {
    const [apiKey, setApiKey] = useState('');
    const [baseUrl, setBaseUrl] = useState('https://api.deepseek.com');
    const [model, setModel] = useState('deepseek-chat');
    const [retrievalMode, setRetrievalMode] = useState<'basic' | 'rag'>('rag');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');

    useEffect(() => {
        // Load current config
        const loadConfig = async () => {
            try {
                const res = await axios.get('http://localhost:8000/api/config/');
                setBaseUrl(res.data.base_url || 'https://api.deepseek.com');
                setModel(res.data.model || 'deepseek-chat');
                setRetrievalMode(res.data.retrieval_mode || 'rag');
                // Don't show full API key for security
                if (res.data.api_key && res.data.api_key !== '...') {
                    setApiKey(res.data.api_key);
                }
            } catch (error) {
                console.error('Failed to load config:', error);
            }
        };
        loadConfig();
    }, []);

    const handleSave = async () => {
        if (!apiKey.trim()) {
            setMessage('请输入 API Key');
            return;
        }

        setLoading(true);
        setMessage('');
        try {
            await axios.post('http://localhost:8000/api/config/', {
                api_key: apiKey,
                base_url: baseUrl,
                model: model,
                retrieval_mode: retrievalMode
            });
            setMessage('✓ 保存成功！');
            setTimeout(() => onClose(), 1000);
        } catch (error) {
            setMessage('保存失败，请检查设置');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-gray-900 border border-gray-700 rounded-2xl max-w-md w-full p-6 shadow-2xl">
                {/* Header */}
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-white">设置</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition">
                        <X size={24} />
                    </button>
                </div>

                <div className="space-y-5">
                    {/* API Key */}
                    <div>
                        <label className="flex items-center gap-2 text-sm text-gray-400 mb-2">
                            <Key size={14} /> API Key
                        </label>
                        <input
                            type="password"
                            value={apiKey}
                            onChange={e => setApiKey(e.target.value)}
                            placeholder="sk-..."
                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:border-cyan-500 outline-none transition"
                        />
                    </div>

                    {/* Base URL */}
                    <div>
                        <label className="flex items-center gap-2 text-sm text-gray-400 mb-2">
                            <Globe size={14} /> API Base URL
                        </label>
                        <input
                            type="text"
                            value={baseUrl}
                            onChange={e => setBaseUrl(e.target.value)}
                            placeholder="https://api.openai.com"
                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:border-cyan-500 outline-none transition"
                        />
                    </div>

                    {/* Model */}
                    <div>
                        <label className="flex items-center gap-2 text-sm text-gray-400 mb-2">
                            <Bot size={14} /> 模型名称
                        </label>
                        <input
                            type="text"
                            value={model}
                            onChange={e => setModel(e.target.value)}
                            placeholder="gpt-4 / deepseek-chat"
                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:border-cyan-500 outline-none transition"
                        />
                    </div>

                    {/* Retrieval Mode */}
                    <div>
                        <label className="flex items-center gap-2 text-sm text-gray-400 mb-2">
                            <Database size={14} /> 检索模式
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => setRetrievalMode('rag')}
                                className={`p-3 rounded-lg border transition flex flex-col items-center gap-1 ${retrievalMode === 'rag'
                                        ? 'bg-cyan-500/20 border-cyan-500 text-cyan-400'
                                        : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'
                                    }`}
                            >
                                <Zap size={20} />
                                <span className="text-sm font-medium">RAG 模式</span>
                                <span className="text-xs opacity-70">语义向量检索</span>
                            </button>
                            <button
                                onClick={() => setRetrievalMode('basic')}
                                className={`p-3 rounded-lg border transition flex flex-col items-center gap-1 ${retrievalMode === 'basic'
                                        ? 'bg-cyan-500/20 border-cyan-500 text-cyan-400'
                                        : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'
                                    }`}
                            >
                                <Database size={20} />
                                <span className="text-sm font-medium">基础模式</span>
                                <span className="text-xs opacity-70">关键词匹配</span>
                            </button>
                        </div>
                    </div>

                    {/* Message */}
                    {message && (
                        <div className={`text-sm p-3 rounded-lg ${message.includes('✓') ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                            {message}
                        </div>
                    )}

                    {/* Save Button */}
                    <button
                        onClick={handleSave}
                        disabled={loading}
                        className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white py-3 rounded-lg font-medium flex items-center justify-center gap-2 disabled:opacity-50 transition"
                    >
                        <Save size={18} />
                        {loading ? '保存中...' : '保存设置'}
                    </button>
                </div>

                {/* Info */}
                <p className="text-xs text-gray-600 mt-4 text-center">
                    支持 OpenAI / DeepSeek / 其他兼容 API
                </p>
            </div>
        </div>
    );
}
