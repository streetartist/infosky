"use client";

import { useState } from "react";
import axios from "axios";
import Link from "next/link";
import ReviewMode from "@/components/ReviewMode";
import KnowledgeGraph from "@/components/KnowledgeGraph";
import ListView from "@/components/ListView";
import RelationView from "@/components/RelationView";
import InputBox from "@/components/InputBox";
import SettingsModal from "@/components/SettingsModal";
import NodeEditor from "@/components/NodeEditor";
import SearchBar from "@/components/SearchBar";
import ChatMode from "@/components/ChatMode";
import { Sparkles, Settings, Network, LayoutGrid, GitBranch, Trash2, BookOpen } from 'lucide-react';

export default function Home() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [showReview, setShowReview] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [viewMode, setViewMode] = useState<'graph' | 'list' | 'relation'>('graph');
  const [focusNodeId, setFocusNodeId] = useState<number | null>(null);

  const handleSearchSelect = (node: any) => {
    setViewMode('graph');
    setFocusNodeId(node.id);
  };

  const handleIngest = () => {
    setRefreshKey(prev => prev + 1);
  };

  const handleClearAll = async () => {
    if (!confirm('⚠️ 确定要清除所有节点吗？此操作无法撤销！')) return;
    try {
      await axios.delete('http://localhost:8000/api/graph/clear');
      setRefreshKey(prev => prev + 1);
    } catch (error) {
      console.error("Clear failed", error);
      alert("清除失败");
    }
  };

  return (
    <main className="relative min-h-screen bg-black text-white overflow-hidden">
      {/* Header Bar */}
      <div className="absolute top-0 left-0 w-full z-50 p-5 flex justify-between items-start pointer-events-none">
        {/* Logo */}
        <div className="pointer-events-auto">
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-600">
            InfoSky 知识星空
          </h1>
          <p className="text-sm text-gray-400">个人AI知识图谱</p>
        </div>

        {/* Controls */}
        <div className="flex gap-4 items-center pointer-events-auto">
          <SearchBar onSelectNode={handleSearchSelect} />

          {/* View Mode Toggle */}
          <div className="flex bg-gray-800/50 rounded-full p-1 border border-gray-700">
            <button
              onClick={() => setViewMode('graph')}
              className={`p-2 rounded-full transition ${viewMode === 'graph' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
              title="星空视图 (3D)"
            >
              <Network size={18} />
            </button>
            <button
              onClick={() => setViewMode('relation')}
              className={`p-2 rounded-full transition ${viewMode === 'relation' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
              title="关系视图 (2D)"
            >
              <GitBranch size={18} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-full transition ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
              title="列表视图"
            >
              <LayoutGrid size={18} />
            </button>
          </div>

          <button
            onClick={() => setShowReview(true)}
            className="flex items-center space-x-2 bg-white/10 hover:bg-white/20 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 transition text-sm h-10"
          >
            <Sparkles size={16} className="text-yellow-400" />
            <span>知识复盘</span>
          </button>

          <Link
            href="/library"
            className="flex items-center space-x-2 bg-purple-500/20 hover:bg-purple-500/40 backdrop-blur-md px-4 py-2 rounded-full border border-purple-500/30 transition text-sm h-10"
          >
            <BookOpen size={16} className="text-purple-400" />
            <span>知识库</span>
          </Link>

          <button
            onClick={handleClearAll}
            className="p-2 bg-red-500/20 hover:bg-red-500/40 backdrop-blur-md rounded-full border border-red-500/30 transition h-10 w-10 flex items-center justify-center"
            title="清空所有节点"
          >
            <Trash2 size={18} className="text-red-400" />
          </button>

          <button
            onClick={() => setShowSettings(true)}
            className="p-2 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full border border-white/10 transition h-10 w-10 flex items-center justify-center"
            title="Settings"
          >
            <Settings size={20} className="text-gray-300" />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {viewMode === 'graph' && (
        <KnowledgeGraph refreshKey={refreshKey} onNodeClick={setSelectedNode} focusNodeId={focusNodeId} onFocusComplete={() => setFocusNodeId(null)} />
      )}
      {viewMode === 'relation' && (
        <RelationView refreshKey={refreshKey} onNodeClick={setSelectedNode} onRefresh={handleIngest} />
      )}
      {viewMode === 'list' && (
        <ListView refreshKey={refreshKey} onNodeClick={setSelectedNode} />
      )}

      <InputBox onIngest={handleIngest} />
      <ChatMode />

      {showReview && <ReviewMode onClose={() => setShowReview(false)} />}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      {selectedNode && (
        <NodeEditor
          node={selectedNode}
          onClose={() => setSelectedNode(null)}
          onUpdate={handleIngest}
        />
      )}
    </main>
  );
}
