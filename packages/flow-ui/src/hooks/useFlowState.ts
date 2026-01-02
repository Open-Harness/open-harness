/**
 * Flow State Hook
 *
 * Manages ReactFlow nodes/edges and execution state.
 * Updates node states based on hub events.
 */

import {
	type Connection,
	type OnConnect,
	type OnEdgesChange,
	type OnNodesChange,
	addEdge,
	useEdgesState,
	useNodesState,
} from "@xyflow/react";
import { useCallback } from "react";
import type {
	FlowDefinition,
	FlowEdge,
	FlowNode,
	FlowNodeData,
	HubEvent,
	NodeExecutionState,
	NodeTypeMetadata,
} from "../types/index.js";

export interface UseFlowStateReturn {
	/** ReactFlow nodes */
	nodes: FlowNode[];
	/** ReactFlow edges */
	edges: FlowEdge[];
	/** Node change handler for ReactFlow */
	onNodesChange: OnNodesChange<FlowNode>;
	/** Edge change handler for ReactFlow */
	onEdgesChange: OnEdgesChange<FlowEdge>;
	/** Connection handler for ReactFlow */
	onConnect: OnConnect;
	/** Process a hub event to update execution states */
	processEvent: (event: HubEvent) => void;
	/** Add a new node */
	addNode: (nodeType: NodeTypeMetadata, position: { x: number; y: number }) => void;
	/** Remove selected nodes */
	removeSelectedNodes: () => void;
	/** Load a flow definition */
	loadFlow: (flow: FlowDefinition) => void;
	/** Export current flow as definition */
	exportFlow: () => FlowDefinition;
	/** Reset all execution states to idle */
	resetExecutionStates: () => void;
}

let nodeIdCounter = 0;

/**
 * Hook for managing flow state with execution visualization.
 */
export function useFlowState(): UseFlowStateReturn {
	const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>([]);
	const [edges, setEdges, onEdgesChange] = useEdgesState<FlowEdge>([]);

	// Handle new connections
	const onConnect: OnConnect = useCallback(
		(connection: Connection) => {
			setEdges((eds) => addEdge(connection, eds));
		},
		[setEdges],
	);

	// Update node execution state
	const updateNodeState = useCallback(
		(nodeId: string, state: NodeExecutionState, extra?: Partial<FlowNodeData>) => {
			setNodes((nds) =>
				nds.map((node) => {
					if (node.id === nodeId) {
						return {
							...node,
							data: {
								...node.data,
								executionState: state,
								...extra,
							},
						};
					}
					return node;
				}),
			);
		},
		[setNodes],
	);

	// Process hub events for execution visualization
	const processEvent = useCallback(
		(event: HubEvent) => {
			const { type, ...rest } = event.payload.event;

			switch (type) {
				case "node:start": {
					const { nodeId } = rest as { nodeId: string };
					updateNodeState(nodeId, "running");
					break;
				}

				case "node:complete": {
					const { nodeId, output, durationMs } = rest as {
						nodeId: string;
						output: unknown;
						durationMs: number;
					};
					updateNodeState(nodeId, "complete", { lastOutput: output, durationMs });
					break;
				}

				case "node:error": {
					const { nodeId, error } = rest as { nodeId: string; error: string };
					updateNodeState(nodeId, "error", { lastError: error });
					break;
				}

				case "node:skipped": {
					const { nodeId } = rest as { nodeId: string };
					updateNodeState(nodeId, "skipped");
					break;
				}

				// Reset all nodes on task start
				case "task:start": {
					setNodes((nds) =>
						nds.map((node) => ({
							...node,
							data: {
								...node.data,
								executionState: "idle" as NodeExecutionState,
								lastOutput: undefined,
								lastError: undefined,
								durationMs: undefined,
							},
						})),
					);
					break;
				}
			}
		},
		[updateNodeState, setNodes],
	);

	// Add a new node from palette
	const addNode = useCallback(
		(nodeType: NodeTypeMetadata, position: { x: number; y: number }) => {
			const id = `node_${++nodeIdCounter}`;
			const metadata = nodeType.metadata;

			const newNode: FlowNode = {
				id,
				type: "custom",
				position,
				data: {
					nodeType: nodeType.type,
					label: metadata?.displayName || nodeType.type,
					executionState: "idle",
					icon: metadata?.icon,
					color: metadata?.color,
				},
			};

			setNodes((nds) => [...nds, newNode]);
		},
		[setNodes],
	);

	// Remove selected nodes
	const removeSelectedNodes = useCallback(() => {
		setNodes((nds) => nds.filter((node) => !node.selected));
		// Also remove edges connected to removed nodes
		setEdges((eds) =>
			eds.filter((edge) => {
				const sourceExists = nodes.find((n) => n.id === edge.source && !n.selected);
				const targetExists = nodes.find((n) => n.id === edge.target && !n.selected);
				return sourceExists && targetExists;
			}),
		);
	}, [nodes, setNodes, setEdges]);

	// Load flow from definition
	const loadFlow = useCallback(
		(flow: FlowDefinition) => {
			// Convert flow nodes to ReactFlow nodes
			const flowNodes: FlowNode[] = flow.nodes.map((node, index) => ({
				id: node.id,
				type: "custom",
				position: node.position || { x: 100 + index * 200, y: 100 },
				data: {
					nodeType: node.type,
					label: node.type,
					config: node.config,
					executionState: "idle" as NodeExecutionState,
				},
			}));

			// Convert flow edges to ReactFlow edges
			const flowEdges: FlowEdge[] = flow.edges.map((edge, index) => ({
				id: `edge_${index}`,
				source: edge.from,
				target: edge.to,
				filter: edge.filter,
			}));

			setNodes(flowNodes);
			setEdges(flowEdges);

			// Update node ID counter
			const maxId = flow.nodes.reduce((max, node) => {
				const match = node.id.match(/node_(\d+)/);
				return match ? Math.max(max, Number.parseInt(match[1], 10)) : max;
			}, 0);
			nodeIdCounter = maxId;
		},
		[setNodes, setEdges],
	);

	// Export current flow as definition
	const exportFlow = useCallback((): FlowDefinition => {
		return {
			name: "flow",
			nodes: nodes.map((node) => ({
				id: node.id,
				type: node.data.nodeType,
				config: node.data.config,
				position: node.position,
			})),
			edges: edges.map((edge) => ({
				from: edge.source,
				to: edge.target,
				filter: edge.filter,
			})),
		};
	}, [nodes, edges]);

	// Reset all execution states
	const resetExecutionStates = useCallback(() => {
		setNodes((nds) =>
			nds.map((node) => ({
				...node,
				data: {
					...node.data,
					executionState: "idle" as NodeExecutionState,
					lastOutput: undefined,
					lastError: undefined,
					durationMs: undefined,
				},
			})),
		);
	}, [setNodes]);

	return {
		nodes,
		edges,
		onNodesChange,
		onEdgesChange,
		onConnect,
		processEvent,
		addNode,
		removeSelectedNodes,
		loadFlow,
		exportFlow,
		resetExecutionStates,
	};
}
