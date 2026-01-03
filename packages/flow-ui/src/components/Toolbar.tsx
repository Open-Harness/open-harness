import type { ConnectionStatus } from "../types/index.js";

export interface ToolbarProps {
	/** Current connection status */
	connectionStatus: ConnectionStatus;
	/** Callback when save is clicked */
	onSave?: () => void;
	/** Callback when load is clicked */
	onLoad?: () => void;
	/** Callback when run is clicked */
	onRun?: () => void;
	/** Callback when reset is clicked */
	onReset?: () => void;
	/** Callback when delete is clicked */
	onDelete?: () => void;
	/** Whether flow can be run (has nodes) */
	canRun?: boolean;
}

export function Toolbar({ connectionStatus, onSave, onLoad, onRun, onReset, onDelete, canRun = false }: ToolbarProps) {
	const isConnected = connectionStatus === "connected";

	return (
		<div className="toolbar">
			{/* File operations */}
			<button type="button" className="toolbar-button" onClick={onLoad} title="Load flow from YAML">
				📂 Load
			</button>
			<button type="button" className="toolbar-button" onClick={onSave} title="Save flow to YAML">
				💾 Save
			</button>

			<div className="toolbar-spacer" />

			{/* Edit operations */}
			<button type="button" className="toolbar-button" onClick={onDelete} title="Delete selected nodes">
				🗑️ Delete
			</button>
			<button type="button" className="toolbar-button" onClick={onReset} title="Reset execution states">
				🔄 Reset
			</button>

			<div className="toolbar-spacer" />

			{/* Run */}
			<button
				type="button"
				className="toolbar-button primary"
				onClick={onRun}
				disabled={!isConnected || !canRun}
				title={!isConnected ? "Not connected to hub" : !canRun ? "Add nodes to run" : "Run flow"}
			>
				▶️ Run
			</button>
		</div>
	);
}
