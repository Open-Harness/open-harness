/**
 * Custom Node Component
 *
 * Displays a flow node with execution state visualization.
 * Changes appearance based on idle/running/complete/error/skipped states.
 */

import { Handle, Position } from "@xyflow/react";
import { memo } from "react";
import type { FlowNodeData } from "../types/index.js";

/** Default icons for common node types */
const DEFAULT_ICONS: Record<string, string> = {
	prompt: "💬",
	agent: "🤖",
	tool: "🔧",
	condition: "🔀",
	input: "📥",
	output: "📤",
	transform: "⚡",
	default: "📦",
};

interface CustomNodeProps {
	data: FlowNodeData;
	selected?: boolean;
}

function CustomNodeComponent({ data, selected }: CustomNodeProps) {
	const { label, nodeType, executionState, lastError, durationMs, icon } = data;

	// Get icon
	const displayIcon = icon || DEFAULT_ICONS[nodeType] || DEFAULT_ICONS.default;

	// Build class name based on state
	const className = ["custom-node", `state-${executionState}`, selected ? "selected" : ""]
		.filter(Boolean)
		.join(" ");

	return (
		<div className={className}>
			{/* Input handle */}
			<Handle type="target" position={Position.Top} />

			{/* Header */}
			<div className="custom-node-header">
				<span className="custom-node-icon">{displayIcon}</span>
				<span className="custom-node-title">{label}</span>
			</div>

			{/* Body - shows different content based on state */}
			<div className="custom-node-body">
				{executionState === "idle" && <span>{nodeType}</span>}

				{executionState === "running" && <span>Running...</span>}

				{executionState === "complete" && durationMs !== undefined && (
					<span>Completed in {durationMs}ms</span>
				)}

				{executionState === "error" && (
					<span className="error-text" title={lastError}>
						{lastError?.slice(0, 40)}
						{(lastError?.length ?? 0) > 40 ? "..." : ""}
					</span>
				)}

				{executionState === "skipped" && <span>Skipped</span>}
			</div>

			{/* Output handle */}
			<Handle type="source" position={Position.Bottom} />
		</div>
	);
}

// Memoize to prevent unnecessary re-renders
export const CustomNode = memo(CustomNodeComponent);
