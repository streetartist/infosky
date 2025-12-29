"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import dynamic from 'next/dynamic';
import { Edit3, X, Plus, Link2, Trash2 } from 'lucide-react';

const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false });

interface GraphNode {
    id: string;
    label: string;
    type: string;
    content?: string;
    color?: string;
    x?: number;
    y?: number;
}

interface GraphLink {
    source: string | GraphNode;
    target: string | GraphNode;
    label?: string;
    id?: number;
}

interface RelationViewProps {
    refreshKey: number;
    onNodeClick: (node: any) => void;
    editMode?: boolean;
    onEditModeChange?: (mode: boolean) => void;
    onRefresh?: () => void;
}

export default function RelationView({ refreshKey, onNodeClick, editMode: externalEditMode, onEditModeChange, onRefresh }: RelationViewProps) {
    const [data, setData] = useState<{ nodes: GraphNode[], links: GraphLink[] }>({ nodes: [], links: [] });
    const [internalEditMode, setInternalEditMode] = useState(false);
    const [selectedNodeForLink, setSelectedNodeForLink] = useState<GraphNode | null>(null);
    const [showNodeCreator, setShowNodeCreator] = useState(false);
    const [newNodeLabel, setNewNodeLabel] = useState('');
    const [newNodeType, setNewNodeType] = useState('概念');
    const [message, setMessage] = useState('');
    const [contextMenu, setContextMenu] = useState<{ node: GraphNode; x: number; y: number } | null>(null);
    const [pendingEdge, setPendingEdge] = useState<{ source: GraphNode; target: GraphNode } | null>(null);
    const [edgeRelationType, setEdgeRelationType] = useState('相关');
    const graphRef = useRef<any>(null);

    const editMode = externalEditMode !== undefined ? externalEditMode : internalEditMode;
    const setEditMode = onEditModeChange || setInternalEditMode;

    const fetchData = useCallback(async () => {
        try {
            const res = await axios.get('http://localhost:8000/api/graph/');
            const nodes = (res.data.nodes || []).map((n: any) => ({
                ...n,
                id: n.id.toString(),
                color: getNodeColor(n.type)
            }));
            const links = (res.data.edges || []).map((e: any) => ({
                source: e.source_id.toString(),
                target: e.target_id.toString(),
                label: e.relation_type,
                id: e.id
            }));
            setData({ nodes, links });
        } catch (err) {
            console.error(err);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [refreshKey, fetchData]);

    const getNodeColor = (type: string) => {
        const colors: Record<string, string> = {
            '核心概念': '#3b82f6',
            '概念': '#6366f1',
            '人物': '#f59e0b',
            '工具': '#10b981',
            '理论': '#8b5cf6',
            '事件': '#ef4444',
            'concept': '#6366f1',
            'Error': '#dc2626',
            'System': '#64748b',
        };
        return colors[type] || '#6366f1';
    };

    const showMessage = (msg: string) => {
        setMessage(msg);
        setTimeout(() => setMessage(''), 2000);
    };

    const handleNodeClickInEditMode = async (node: GraphNode) => {
        if (!editMode) {
            onNodeClick(node);
            return;
        }

        if (selectedNodeForLink) {
            // Second node clicked - show edge type selector
            if (selectedNodeForLink.id === node.id) {
                showMessage('不能连接到自身');
                setSelectedNodeForLink(null);
                return;
            }

            // Show modal to select relation type
            setPendingEdge({ source: selectedNodeForLink, target: node });
            setSelectedNodeForLink(null);
        } else {
            // First node clicked - select for linking
            setSelectedNodeForLink(node);
            showMessage(`已选择: ${node.label}，点击另一个节点建立连接`);
        }
    };

    const handleCreateEdge = async () => {
        if (!pendingEdge) return;

        try {
            await axios.post('http://localhost:8000/api/graph/edges', {
                source_id: Number(pendingEdge.source.id),
                target_id: Number(pendingEdge.target.id),
                relation_type: edgeRelationType
            });
            showMessage(`✓ 已连接: ${pendingEdge.source.label} → ${edgeRelationType} → ${pendingEdge.target.label}`);
            fetchData();
            onRefresh?.();
        } catch (err: any) {
            showMessage(err.response?.data?.detail || '连接失败');
        }
        setPendingEdge(null);
        setEdgeRelationType('相关');
    };

    const handleLinkClick = async (link: GraphLink) => {
        if (!editMode) return;

        const linkId = (link as any).id;
        if (!linkId) {
            showMessage('无法删除此连接');
            return;
        }

        const sourceName = typeof link.source === 'object' ? link.source.label : link.source;
        const targetName = typeof link.target === 'object' ? link.target.label : link.target;

        if (!confirm(`确定删除连接: ${sourceName} → ${targetName}？`)) return;

        try {
            await axios.delete(`http://localhost:8000/api/graph/edges/${linkId}`);
            showMessage('✓ 连接已删除');
            fetchData();
            onRefresh?.();
        } catch (err) {
            showMessage('删除失败');
        }
    };

    const handleNodeRightClick = (node: GraphNode, event: MouseEvent) => {
        event.preventDefault();
        setContextMenu({ node, x: event.clientX, y: event.clientY });
    };

    const handleDeleteNode = async () => {
        if (!contextMenu) return;

        const node = contextMenu.node;
        if (!confirm(`确定删除节点: ${node.label}？`)) {
            setContextMenu(null);
            return;
        }

        try {
            await axios.delete(`http://localhost:8000/api/graph/nodes/${node.id}`);
            showMessage(`✓ 已删除节点: ${node.label}`);
            setContextMenu(null);
            fetchData();
            onRefresh?.();
        } catch (err) {
            showMessage('删除失败');
        }
    };

    const handleBackgroundClick = (event: MouseEvent) => {
        // Close context menu on background click
        if (contextMenu) {
            setContextMenu(null);
            return;
        }

        if (!editMode) return;

        // Clear selected node
        if (selectedNodeForLink) {
            setSelectedNodeForLink(null);
            showMessage('取消选择');
            return;
        }

        // Show node creator
        setShowNodeCreator(true);
    };

    const handleCreateNode = async () => {
        if (!newNodeLabel.trim()) {
            showMessage('请输入节点名称');
            return;
        }

        try {
            await axios.post('http://localhost:8000/api/graph/nodes', {
                label: newNodeLabel.trim(),
                type: newNodeType,
                content: ''
            });
            showMessage(`✓ 已创建节点: ${newNodeLabel}`);
            setNewNodeLabel('');
            setShowNodeCreator(false);
            fetchData();
            onRefresh?.();
        } catch (err) {
            showMessage('创建失败');
        }
    };

    const toggleEditMode = () => {
        setEditMode(!editMode);
        setSelectedNodeForLink(null);
        if (!editMode) {
            showMessage('进入编辑模式：点击节点连接，点击空白创建，点击连线删除');
        }
    };

    // Show empty state
    if (data.nodes.length === 0 && !editMode) {
        return (
            <div className="w-full h-screen bg-black flex items-center justify-center flex-col gap-4">
                <div className="text-6xl">🔗</div>
                <p className="text-xl text-gray-400 font-medium">暂无知识节点</p>
                <p className="text-gray-500 text-sm">在下方输入框添加你的第一条知识</p>
            </div>
        );
    }

    const nodeTypes = ['概念', '理论', '工具', '人物', '事件', '方法', '案例', '领域'];

    return (
        <div className="w-full h-full pt-20 relative">
            {/* Edit Mode Toggle Button */}
            <button
                onClick={toggleEditMode}
                className={`absolute top-24 left-5 z-20 flex items-center gap-2 px-4 py-2 rounded-full border transition ${editMode
                    ? 'bg-orange-500/20 border-orange-500 text-orange-400'
                    : 'bg-gray-800/50 border-gray-700 text-gray-400 hover:text-white'
                    }`}
            >
                {editMode ? <X size={18} /> : <Edit3 size={18} />}
                {editMode ? '退出编辑' : '编辑模式'}
            </button>

            {/* Edit Mode Instructions */}
            {editMode && (
                <div className="absolute top-24 left-1/2 -translate-x-1/2 z-20 bg-orange-500/20 border border-orange-500/50 text-orange-300 px-4 py-2 rounded-full text-sm flex items-center gap-3">
                    <span className="flex items-center gap-1"><Plus size={14} /> 点空白创建节点</span>
                    <span className="text-orange-500">|</span>
                    <span className="flex items-center gap-1"><Link2 size={14} /> 点两个节点连接</span>
                    <span className="text-orange-500">|</span>
                    <span className="flex items-center gap-1"><Trash2 size={14} /> 点连线删除</span>
                </div>
            )}

            {/* Selected Node Indicator */}
            {selectedNodeForLink && (
                <div className="absolute top-36 left-1/2 -translate-x-1/2 z-20 bg-cyan-500/20 border border-cyan-500 text-cyan-300 px-4 py-2 rounded-full text-sm">
                    已选择: <strong>{selectedNodeForLink.label}</strong> - 点击另一个节点建立连接
                </div>
            )}

            {/* Message Toast */}
            {message && (
                <div className={`absolute bottom-32 left-1/2 -translate-x-1/2 z-20 px-4 py-2 rounded-full text-sm ${message.includes('✓') ? 'bg-green-500/20 border border-green-500 text-green-300' : 'bg-gray-800 border border-gray-700 text-gray-300'
                    }`}>
                    {message}
                </div>
            )}

            {/* Quick Node Creator Modal */}
            {showNodeCreator && (
                <div className="absolute inset-0 bg-black/50 z-30 flex items-center justify-center" onClick={() => setShowNodeCreator(false)}>
                    <div className="bg-gray-900 border border-gray-700 rounded-xl p-5 w-80" onClick={e => e.stopPropagation()}>
                        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                            <Plus size={20} className="text-cyan-400" /> 快速创建节点
                        </h3>
                        <input
                            type="text"
                            value={newNodeLabel}
                            onChange={e => setNewNodeLabel(e.target.value)}
                            placeholder="节点名称"
                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 mb-3 text-white outline-none focus:border-cyan-500"
                            autoFocus
                            onKeyDown={e => e.key === 'Enter' && handleCreateNode()}
                        />
                        <select
                            value={newNodeType}
                            onChange={e => setNewNodeType(e.target.value)}
                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 mb-4 text-white outline-none"
                        >
                            {nodeTypes.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setShowNodeCreator(false)}
                                className="flex-1 py-2 rounded-lg border border-gray-700 text-gray-400"
                            >
                                取消
                            </button>
                            <button
                                onClick={handleCreateNode}
                                className="flex-1 py-2 rounded-lg bg-cyan-600 text-white"
                            >
                                创建
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Right-click Context Menu */}
            {contextMenu && (
                <div
                    className="fixed z-50 bg-gray-900 border border-gray-700 rounded-lg shadow-xl py-1 min-w-[120px]"
                    style={{ left: contextMenu.x, top: contextMenu.y }}
                >
                    <button
                        onClick={handleDeleteNode}
                        className="w-full px-4 py-2 text-left text-red-400 hover:bg-red-500/20 flex items-center gap-2 text-sm"
                    >
                        <Trash2 size={14} /> 删除节点
                    </button>
                </div>
            )}

            {/* Edge Type Selector Modal */}
            {pendingEdge && (
                <div className="absolute inset-0 bg-black/50 z-30 flex items-center justify-center" onClick={() => setPendingEdge(null)}>
                    <div className="bg-gray-900 border border-gray-700 rounded-xl p-5 w-80" onClick={e => e.stopPropagation()}>
                        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                            <Link2 size={20} className="text-purple-400" /> 选择关系类型
                        </h3>

                        {/* Preview */}
                        <div className="bg-gray-800/50 rounded-lg p-3 text-center text-sm mb-4">
                            <span className="text-cyan-400">{pendingEdge.source.label}</span>
                            <span className="text-purple-400 mx-2">→</span>
                            <span className="text-cyan-400">{pendingEdge.target.label}</span>
                        </div>

                        {/* Relation Type Grid */}
                        <div className="grid grid-cols-3 gap-2 mb-4">
                            {['相关', '属于', '包含', '导致', '影响', '依赖', '类似', '对比', '定义为'].map(type => (
                                <button
                                    key={type}
                                    onClick={() => setEdgeRelationType(type)}
                                    className={`py-2 px-3 rounded-lg text-sm transition ${edgeRelationType === type
                                            ? 'bg-purple-500 text-white'
                                            : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                                        }`}
                                >
                                    {type}
                                </button>
                            ))}
                        </div>

                        <div className="flex gap-2">
                            <button
                                onClick={() => setPendingEdge(null)}
                                className="flex-1 py-2 rounded-lg border border-gray-700 text-gray-400"
                            >
                                取消
                            </button>
                            <button
                                onClick={handleCreateEdge}
                                className="flex-1 py-2 rounded-lg bg-purple-600 text-white"
                            >
                                创建连接
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <ForceGraph2D
                ref={graphRef}
                graphData={data}
                nodeId="id"
                nodeLabel="label"
                nodeColor={(node: any) => {
                    if (editMode && selectedNodeForLink?.id === node.id) {
                        return '#f59e0b'; // Highlight selected node
                    }
                    return node.color || '#6366f1';
                }}
                nodeRelSize={8}
                linkLabel="label"
                linkColor={() => 'rgba(100, 116, 139, 0.5)'}
                linkWidth={(link: any) => editMode ? 3 : 1.5}
                linkDirectionalArrowLength={4}
                linkDirectionalArrowRelPos={1}
                linkCurvature={0.1}
                onNodeClick={(node: any) => handleNodeClickInEditMode(node)}
                onNodeRightClick={(node: any, event: MouseEvent) => handleNodeRightClick(node, event)}
                onLinkClick={(link: any) => handleLinkClick(link)}
                onBackgroundClick={handleBackgroundClick}
                nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
                    const label = node.label;
                    const fontSize = 12 / globalScale;
                    ctx.font = `${fontSize}px Sans-Serif`;
                    const textWidth = ctx.measureText(label).width;
                    const bckgDimensions = [textWidth, fontSize].map(n => n + fontSize * 0.4);

                    // Node circle - larger in edit mode
                    const radius = editMode ? 8 : 6;
                    ctx.beginPath();
                    ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);

                    // Highlight selected node
                    if (editMode && selectedNodeForLink?.id === node.id) {
                        ctx.fillStyle = '#f59e0b';
                        ctx.strokeStyle = '#fff';
                        ctx.lineWidth = 2 / globalScale;
                        ctx.stroke();
                    } else {
                        ctx.fillStyle = node.color || '#6366f1';
                    }
                    ctx.fill();

                    // Label background
                    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
                    ctx.fillRect(node.x - bckgDimensions[0] / 2, node.y + 10, bckgDimensions[0], bckgDimensions[1]);

                    // Label text
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'top';
                    ctx.fillStyle = '#fff';
                    ctx.fillText(label, node.x, node.y + 12);
                }}
                backgroundColor="#000"
                width={typeof window !== 'undefined' ? window.innerWidth : 800}
                height={typeof window !== 'undefined' ? window.innerHeight - 100 : 600}
            />
        </div>
    );
}
