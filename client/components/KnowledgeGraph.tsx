"use client";

import { useEffect, useState, useRef } from 'react';
import dynamic from 'next/dynamic';
import axios from 'axios';

const ForceGraph3D = dynamic(() => import('react-force-graph-3d'), { ssr: false });

interface KnowledgeGraphProps {
    refreshKey: number;
    onNodeClick: (node: any) => void;
    focusNodeId?: number | null;
    onFocusComplete?: () => void;
}

export default function KnowledgeGraph({ refreshKey, onNodeClick, focusNodeId, onFocusComplete }: KnowledgeGraphProps) {
    const [data, setData] = useState<{ nodes: any[], links: any[] }>({ nodes: [], links: [] });
    const graphRef = useRef<any>(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await axios.get('http://localhost:8000/api/graph/');
                // Transform edges to links format for force-graph
                const graphData = {
                    nodes: res.data.nodes || [],
                    links: (res.data.edges || []).map((e: any) => ({
                        source: e.source_id,
                        target: e.target_id,
                    }))
                };
                setData(graphData);
            } catch (error) {
                console.error("Failed to fetch graph", error);
            }
        };
        fetchData();
    }, [refreshKey]);

    // Zoom to focused node when focusNodeId changes
    useEffect(() => {
        if (focusNodeId && graphRef.current && data.nodes.length > 0) {
            const node = data.nodes.find((n: any) => n.id === focusNodeId);
            if (node) {
                // Zoom to the node with animation
                graphRef.current.cameraPosition(
                    { x: node.x, y: node.y, z: 200 }, // Target position
                    node, // Look-at position
                    1000 // Animation duration
                );
                if (onFocusComplete) {
                    setTimeout(onFocusComplete, 1100);
                }
            }
        }
    }, [focusNodeId, data.nodes, onFocusComplete]);

    // Show empty state
    if (data.nodes.length === 0) {
        return (
            <div className="w-full h-screen bg-black flex items-center justify-center flex-col gap-4">
                <div className="text-6xl">🌌</div>
                <p className="text-xl text-gray-400 font-medium">暂无知识节点</p>
                <p className="text-gray-500 text-sm">在下方输入框添加你的第一条知识</p>
            </div>
        );
    }

    return (
        <div className="w-full h-screen bg-black">
            <ForceGraph3D
                ref={graphRef}
                graphData={data}
                nodeLabel="label"
                nodeAutoColorBy="type"
                linkDirectionalArrowLength={3.5}
                linkDirectionalArrowRelPos={1}
                backgroundColor="#000000"
                nodeRelSize={6}
                linkOpacity={0.5}
                nodeOpacity={0.9}
                // Custom node rendering for aesthetic "star" look
                nodeThreeObjectExtend={true}
                onNodeClick={onNodeClick}
            />
        </div>
    );
}

