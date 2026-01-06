/**
 * Event Log Component
 *
 * Displays recent hub events for debugging and monitoring.
 */

import { useEffect, useRef } from "react";
import type { HubEvent } from "../types/index.js";

export interface EventLogProps {
	/** Recent events */
	events: HubEvent[];
	/** Whether log is expanded */
	expanded?: boolean;
	/** Toggle expanded state */
	onToggle?: () => void;
	/** Clear events */
	onClear?: () => void;
}

/** Format timestamp for display */
function formatTime(timestamp: string): string {
	const date = new Date(timestamp);
	return date.toLocaleTimeString("en-US", {
		hour12: false,
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		fractionalSecondDigits: 3,
	});
}

/** Get CSS class for event type */
function getEventClass(eventType: string): string {
	if (eventType.startsWith("node:start")) return "node-start";
	if (eventType.startsWith("node:complete")) return "node-complete";
	if (eventType.startsWith("node:error")) return "node-error";
	if (eventType.startsWith("node:skipped")) return "node-skipped";
	return "";
}

export function EventLog({ events, expanded = true, onToggle, onClear }: EventLogProps) {
	const logRef = useRef<HTMLDivElement>(null);

	// Auto-scroll to bottom on new events
	// biome-ignore lint/correctness/useExhaustiveDependencies: events.length is intentional to scroll on new events
	useEffect(() => {
		if (logRef.current && expanded) {
			logRef.current.scrollTop = logRef.current.scrollHeight;
		}
	}, [events.length, expanded]);

	if (!expanded) {
		return (
			<div className="event-log" style={{ maxHeight: 40 }}>
				<div className="event-log-header">
					<span>Event Log ({events.length})</span>
					<button
						type="button"
						onClick={onToggle}
						style={{
							background: "none",
							border: "none",
							color: "var(--text-secondary)",
							cursor: "pointer",
						}}
					>
						▲ Expand
					</button>
				</div>
			</div>
		);
	}

	return (
		<div className="event-log">
			<div className="event-log-header">
				<span>Event Log ({events.length})</span>
				<div style={{ display: "flex", gap: 8 }}>
					<button
						type="button"
						onClick={onClear}
						style={{
							background: "none",
							border: "none",
							color: "var(--text-secondary)",
							cursor: "pointer",
						}}
					>
						Clear
					</button>
					<button
						type="button"
						onClick={onToggle}
						style={{
							background: "none",
							border: "none",
							color: "var(--text-secondary)",
							cursor: "pointer",
						}}
					>
						▼ Collapse
					</button>
				</div>
			</div>
			<div className="event-log-content" ref={logRef}>
				{events.length === 0 ? (
					<div style={{ color: "var(--text-secondary)", padding: 8 }}>No events yet</div>
				) : (
					events.map((event) => {
						const { type, ...rest } = event.payload.event;
						const eventClass = getEventClass(type);

						return (
							<div key={event.payload.id} className="event-item">
								<span className="event-time">{formatTime(event.payload.timestamp)}</span>
								<span className={`event-type ${eventClass}`}>{type}</span>
								{Object.keys(rest).length > 0 && (
									<span style={{ color: "var(--text-secondary)", marginLeft: 8 }}>
										{JSON.stringify(rest).slice(0, 60)}
										{JSON.stringify(rest).length > 60 ? "..." : ""}
									</span>
								)}
							</div>
						);
					})
				)}
			</div>
		</div>
	);
}
