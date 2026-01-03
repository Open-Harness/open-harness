/**
 * Flow Editor Application
 *
 * Main React application for visual flow editing and execution monitoring.
 */

import { ReactFlowProvider } from "@xyflow/react";
import React, { useCallback, useState } from "react";
import { createRoot } from "react-dom/client";

import { ConnectionStatus, EventLog, FlowCanvas, NodePalette, Toolbar } from "./components/index.js";
import { useFlowState, useWebSocket } from "./hooks/index.js";
import type { FlowDefinition, NodeTypeMetadata } from "./types/index.js";

// Demo node types (in production, these would come from the registry via API)
const DEMO_NODE_TYPES: NodeTypeMetadata[] = [
	{
		type: "prompt",
		metadata: {
			displayName: "Prompt",
			description: "Send a prompt to an LLM",
			category: "core",
			icon: "💬",
		},
	},
	{
		type: "agent",
		metadata: {
			displayName: "Agent",
			description: "Run an autonomous agent",
			category: "agents",
			icon: "🤖",
		},
	},
	{
		type: "tool",
		metadata: {
			displayName: "Tool Call",
			description: "Execute a tool",
			category: "tools",
			icon: "🔧",
		},
	},
	{
		type: "condition",
		metadata: {
			displayName: "Condition",
			description: "Branch based on condition",
			category: "flow",
			icon: "🔀",
		},
	},
	{
		type: "input",
		metadata: {
			displayName: "Input",
			description: "Flow input node",
			category: "io",
			icon: "📥",
		},
	},
	{
		type: "output",
		metadata: {
			displayName: "Output",
			description: "Flow output node",
			category: "io",
			icon: "📤",
		},
	},
];

function App() {
	// WebSocket connection
	const {
		status: connectionStatus,
		sendCommand,
		connect,
		events,
	} = useWebSocket({
		url: "ws://localhost:3001/ws",
		onEvent: (event) => {
			// Process events for execution visualization
			processEvent(event);
		},
		onError: (error) => {
			console.error("WebSocket error:", error);
		},
	});

	// Flow state
	const {
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
	} = useFlowState();

	// Event log state
	const [eventLogExpanded, setEventLogExpanded] = useState(true);
	const [recentEvents, setRecentEvents] = useState<typeof events>([]);

	// Keep recent events in sync
	React.useEffect(() => {
		setRecentEvents(events);
	}, [events]);

	// Handle save
	const handleSave = useCallback(() => {
		const flow = exportFlow();
		const yaml = flowToYaml(flow);

		// Create download
		const blob = new Blob([yaml], { type: "text/yaml" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `${flow.name || "flow"}.yaml`;
		a.click();
		URL.revokeObjectURL(url);
	}, [exportFlow]);

	// Handle load
	const handleLoad = useCallback(() => {
		const input = document.createElement("input");
		input.type = "file";
		input.accept = ".yaml,.yml";
		input.onchange = async (e) => {
			const file = (e.target as HTMLInputElement).files?.[0];
			if (!file) return;

			const text = await file.text();
			const flow = yamlToFlow(text);
			if (flow) {
				loadFlow(flow);
			}
		};
		input.click();
	}, [loadFlow]);

	// Handle run (placeholder - would send flow to executor)
	const handleRun = useCallback(() => {
		// In production, this would:
		// 1. Export flow to YAML
		// 2. Send to executor via hub
		// For now, just reset states
		resetExecutionStates();
		console.log("Run flow:", exportFlow());
	}, [exportFlow, resetExecutionStates]);

	return (
		<div className="app-container">
			{/* Sidebar */}
			<div className="sidebar">
				<div className="sidebar-header">
					<h1>Flow Editor</h1>
				</div>
				<ConnectionStatus status={connectionStatus} onReconnect={connect} />
				<NodePalette nodeTypes={DEMO_NODE_TYPES} />
			</div>

			{/* Main content */}
			<div className="main-content">
				<Toolbar
					connectionStatus={connectionStatus}
					onSave={handleSave}
					onLoad={handleLoad}
					onRun={handleRun}
					onReset={resetExecutionStates}
					onDelete={removeSelectedNodes}
					canRun={nodes.length > 0}
				/>

				<ReactFlowProvider>
					<FlowCanvas
						nodes={nodes}
						edges={edges}
						onNodesChange={onNodesChange}
						onEdgesChange={onEdgesChange}
						onConnect={onConnect}
						onNodeDrop={addNode}
					/>
				</ReactFlowProvider>

				<EventLog
					events={recentEvents}
					expanded={eventLogExpanded}
					onToggle={() => setEventLogExpanded(!eventLogExpanded)}
					onClear={() => setRecentEvents([])}
				/>
			</div>
		</div>
	);
}

/**
 * Convert flow definition to YAML string.
 * Simple implementation - in production use a proper YAML library.
 */
function flowToYaml(flow: FlowDefinition): string {
	const lines: string[] = [];

	lines.push(`name: ${flow.name}`);
	if (flow.description) {
		lines.push(`description: ${flow.description}`);
	}
	lines.push("");

	lines.push("nodes:");
	for (const node of flow.nodes) {
		lines.push(`  - id: ${node.id}`);
		lines.push(`    type: ${node.type}`);
		if (node.position) {
			lines.push("    position:");
			lines.push(`      x: ${node.position.x}`);
			lines.push(`      y: ${node.position.y}`);
		}
		if (node.config && Object.keys(node.config).length > 0) {
			lines.push("    config:");
			for (const [key, value] of Object.entries(node.config)) {
				lines.push(`      ${key}: ${JSON.stringify(value)}`);
			}
		}
	}
	lines.push("");

	lines.push("edges:");
	for (const edge of flow.edges) {
		lines.push(`  - from: ${edge.from}`);
		lines.push(`    to: ${edge.to}`);
		if (edge.filter) {
			lines.push(`    filter: ${edge.filter}`);
		}
	}

	return lines.join("\n");
}

/**
 * Parse YAML string to flow definition.
 * Simple implementation - in production use a proper YAML library.
 */
function yamlToFlow(yaml: string): FlowDefinition | null {
	try {
		// Very basic YAML parsing - just for demo
		// In production, use js-yaml or yaml package
		const lines = yaml.split("\n");
		const flow: FlowDefinition = {
			name: "flow",
			nodes: [],
			edges: [],
		};

		let currentSection = "";
		let currentItem: Record<string, unknown> | null = null;
		let currentSubItem: Record<string, unknown> | null = null;

		for (const line of lines) {
			const trimmed = line.trim();
			if (!trimmed || trimmed.startsWith("#")) continue;

			// Section headers
			if (trimmed === "nodes:") {
				currentSection = "nodes";
				continue;
			}
			if (trimmed === "edges:") {
				currentSection = "edges";
				continue;
			}

			// Top-level properties
			if (!line.startsWith(" ")) {
				const [key, ...valueParts] = trimmed.split(":");
				const value = valueParts.join(":").trim();
				if (key === "name") flow.name = value;
				if (key === "description") flow.description = value;
				continue;
			}

			// List item start
			if (trimmed.startsWith("- ")) {
				if (currentItem) {
					if (currentSection === "nodes") {
						flow.nodes.push(currentItem as FlowDefinition["nodes"][0]);
					} else if (currentSection === "edges") {
						flow.edges.push(currentItem as FlowDefinition["edges"][0]);
					}
				}
				currentItem = {};
				currentSubItem = null;
				const [key, ...valueParts] = trimmed.slice(2).split(":");
				const value = valueParts.join(":").trim();
				if (value) {
					currentItem[key] = value;
				}
				continue;
			}

			// Sub-item properties
			if (currentItem && trimmed.includes(":")) {
				const [key, ...valueParts] = trimmed.split(":");
				const value = valueParts.join(":").trim();

				if (key === "position" && !value) {
					currentSubItem = {};
					currentItem.position = currentSubItem;
				} else if (key === "config" && !value) {
					currentSubItem = {};
					currentItem.config = currentSubItem;
				} else if (currentSubItem && line.startsWith("      ")) {
					currentSubItem[key] = Number.isNaN(Number(value)) ? value : Number(value);
				} else if (value) {
					currentItem[key] = value;
				}
			}
		}

		// Add last item
		if (currentItem) {
			if (currentSection === "nodes") {
				flow.nodes.push(currentItem as FlowDefinition["nodes"][0]);
			} else if (currentSection === "edges") {
				flow.edges.push(currentItem as FlowDefinition["edges"][0]);
			}
		}

		return flow;
	} catch (err) {
		console.error("Failed to parse YAML:", err);
		return null;
	}
}

// Mount the app
const container = document.getElementById("root");
if (container) {
	const root = createRoot(container);
	root.render(<App />);
}

export default App;
