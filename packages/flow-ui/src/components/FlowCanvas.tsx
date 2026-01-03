/**
 * Flow Canvas Component
 *
 * ReactFlow-based flow visualization with drag-and-drop node placement.
 */

import {
	Background,
	BackgroundVariant,
	Controls,
	MiniMap,
	type NodeTypes,
	type OnConnect,
	type OnEdgesChange,
	type OnNodesChange,
	ReactFlow,
	type ReactFlowInstance,
} from "@xyflow/react";
import React, { type DragEvent, useCallback } from "react";
import "@xyflow/react/dist/style.css";

import type { FlowEdge, FlowNode, NodeTypeMetadata } from "../types/index.js";
import { CustomNode } from "./CustomNode.js";

export interface FlowCanvasProps {
	/** Flow nodes */
	nodes: FlowNode[];
	/** Flow edges */
	edges: FlowEdge[];
	/** Node change handler */
	onNodesChange: OnNodesChange<FlowNode>;
	/** Edge change handler */
	onEdgesChange: OnEdgesChange<FlowEdge>;
	/** Connection handler */
	onConnect: OnConnect;
	/** Callback when node is dropped from palette */
	onNodeDrop?: (nodeType: NodeTypeMetadata, position: { x: number; y: number }) => void;
}

// Register custom node types
const nodeTypes: NodeTypes = {
	custom: CustomNode,
};

export function FlowCanvas({ nodes, edges, onNodesChange, onEdgesChange, onConnect, onNodeDrop }: FlowCanvasProps) {
	// Store ReactFlow instance for coordinate conversion
	const [reactFlowInstance, setReactFlowInstance] = React.useState<ReactFlowInstance<FlowNode, FlowEdge> | null>(null);

	// Handle drag over
	const onDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
		event.preventDefault();
		event.dataTransfer.dropEffect = "move";
	}, []);

	// Handle drop from node palette
	const onDrop = useCallback(
		(event: DragEvent<HTMLDivElement>) => {
			event.preventDefault();

			if (!reactFlowInstance || !onNodeDrop) return;

			// Get node type data from drag event
			const nodeTypeData = event.dataTransfer.getData("application/reactflow");
			if (!nodeTypeData) return;

			try {
				const nodeType = JSON.parse(nodeTypeData) as NodeTypeMetadata;

				// Convert screen coordinates to flow coordinates
				const position = reactFlowInstance.screenToFlowPosition({
					x: event.clientX,
					y: event.clientY,
				});

				onNodeDrop(nodeType, position);
			} catch {
				console.error("Failed to parse dropped node data");
			}
		},
		[reactFlowInstance, onNodeDrop],
	);

	// MiniMap node color based on execution state
	const nodeColor = useCallback((node: FlowNode) => {
		switch (node.data.executionState) {
			case "running":
				return "#fbbf24";
			case "complete":
				return "#4ade80";
			case "error":
				return "#ef4444";
			case "skipped":
				return "#6b7280";
			default:
				return "#475569";
		}
	}, []);

	return (
		<div className="flow-canvas">
			<ReactFlow<FlowNode, FlowEdge>
				nodes={nodes}
				edges={edges}
				onNodesChange={onNodesChange}
				onEdgesChange={onEdgesChange}
				onConnect={onConnect}
				onInit={setReactFlowInstance}
				onDrop={onDrop}
				onDragOver={onDragOver}
				nodeTypes={nodeTypes}
				fitView
				snapToGrid
				snapGrid={[15, 15]}
				deleteKeyCode={["Backspace", "Delete"]}
				multiSelectionKeyCode="Shift"
			>
				<Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#2d3748" />
				<Controls />
				<MiniMap nodeColor={nodeColor} maskColor="rgba(0, 0, 0, 0.8)" />
			</ReactFlow>
		</div>
	);
}
