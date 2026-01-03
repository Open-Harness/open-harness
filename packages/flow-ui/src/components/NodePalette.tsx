/**
 * Node Palette Component
 *
 * Displays available node types from the registry.
 * Nodes can be dragged onto the canvas.
 */

import { type DragEvent, useMemo } from "react";
import type { NodeTypeMetadata } from "../types/index.js";

export interface NodePaletteProps {
	/** Available node types from registry */
	nodeTypes: NodeTypeMetadata[];
}

/** Default icons for categories */
const CATEGORY_ICONS: Record<string, string> = {
	core: "⚙️",
	agents: "🤖",
	tools: "🔧",
	flow: "🔀",
	io: "📡",
	default: "📦",
};

/** Default icons for node types */
const TYPE_ICONS: Record<string, string> = {
	prompt: "💬",
	agent: "🤖",
	tool: "🔧",
	condition: "🔀",
	input: "📥",
	output: "📤",
	transform: "⚡",
};

interface PaletteNodeItemProps {
	nodeType: NodeTypeMetadata;
}

function PaletteNodeItem({ nodeType }: PaletteNodeItemProps) {
	const { type, metadata } = nodeType;

	const displayName = metadata?.displayName || type;
	const description = metadata?.description || `Add a ${type} node`;
	const icon = metadata?.icon || TYPE_ICONS[type] || "📦";

	// Handle drag start
	const onDragStart = (event: DragEvent<HTMLDivElement>) => {
		event.dataTransfer.setData("application/reactflow", JSON.stringify(nodeType));
		event.dataTransfer.effectAllowed = "move";
	};

	return (
		<div className="palette-node" draggable onDragStart={onDragStart}>
			<div className="palette-node-name">
				<span style={{ marginRight: 8 }}>{icon}</span>
				{displayName}
			</div>
			<div className="palette-node-description">{description}</div>
		</div>
	);
}

export function NodePalette({ nodeTypes }: NodePaletteProps) {
	// Group nodes by category
	const categorizedNodes = useMemo(() => {
		const categories = new Map<string, NodeTypeMetadata[]>();

		for (const nodeType of nodeTypes) {
			const category = nodeType.metadata?.category || "other";
			const existing = categories.get(category) || [];
			existing.push(nodeType);
			categories.set(category, existing);
		}

		// Sort categories
		return Array.from(categories.entries()).sort(([a], [b]) => a.localeCompare(b));
	}, [nodeTypes]);

	// If no node types, show placeholder
	if (nodeTypes.length === 0) {
		return (
			<div className="node-palette">
				<div className="palette-empty">
					<p>No node types available</p>
					<p style={{ fontSize: 12, color: "var(--text-secondary)" }}>Connect to a hub to load node types</p>
				</div>
			</div>
		);
	}

	return (
		<div className="node-palette">
			{categorizedNodes.map(([category, nodes]) => (
				<div key={category} className="palette-category">
					<div className="palette-category-title">
						<span style={{ marginRight: 6 }}>{CATEGORY_ICONS[category] || CATEGORY_ICONS.default}</span>
						{category}
					</div>
					{nodes.map((nodeType) => (
						<PaletteNodeItem key={nodeType.type} nodeType={nodeType} />
					))}
				</div>
			))}
		</div>
	);
}
