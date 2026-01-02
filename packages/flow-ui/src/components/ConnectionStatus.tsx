import type { ConnectionStatus as StatusType } from "../types/index.js";

export interface ConnectionStatusProps {
	/** Current connection status */
	status: StatusType;
	/** Callback to reconnect */
	onReconnect?: () => void;
}

const STATUS_TEXT: Record<StatusType, string> = {
	connected: "Connected",
	connecting: "Connecting...",
	disconnected: "Disconnected",
};

export function ConnectionStatus({ status, onReconnect }: ConnectionStatusProps) {
	return (
		<div className="connection-status">
			<span className={`status-dot ${status}`} />
			<span>{STATUS_TEXT[status]}</span>
			{status === "disconnected" && onReconnect && (
				<button
					type="button"
					onClick={onReconnect}
					style={{
						background: "none",
						border: "none",
						color: "var(--accent)",
						cursor: "pointer",
						marginLeft: 8,
						fontSize: 12,
					}}
				>
					Reconnect
				</button>
			)}
		</div>
	);
}
