"use client";

import { useMemo, useState, useEffect } from "react";
import type { Edge, Node } from "reactflow";
import ReactFlow, { Background, Controls, MiniMap } from "reactflow";
import "reactflow/dist/style.css";
import { JetBrains_Mono, Space_Grotesk } from "next/font/google";

const spaceGrotesk = Space_Grotesk({
	subsets: ["latin"],
	weight: ["400", "500", "600", "700"],
});

const jetBrainsMono = JetBrains_Mono({
	subsets: ["latin"],
	weight: ["400", "500", "600"],
});

type WorkflowEvent = {
	type: string;
	at: string;
	phase?: "Planning" | "Working";
	node?: "planner" | "coder" | "reviewer";
	message?: string;
};

const baseNodes: Node[] = [
	{
		id: "planner",
		type: "workflow",
		position: { x: 120, y: 120 },
		data: {
			title: "Planner",
			role: "Breaks the goal into steps",
			phase: "Planning",
		},
	},
	{
		id: "coder",
		type: "workflow",
		position: { x: 520, y: 80 },
		data: {
			title: "Coder",
			role: "Implements the plan",
			phase: "Working",
		},
	},
	{
		id: "reviewer",
		type: "workflow",
		position: { x: 520, y: 240 },
		data: {
			title: "Reviewer",
			role: "Checks quality + risks",
			phase: "Working",
		},
	},
];

const edges: Edge[] = [
	{ id: "planner-coder", source: "planner", target: "coder", animated: true },
	{ id: "coder-reviewer", source: "coder", target: "reviewer", animated: true },
];

const timeline: WorkflowEvent[] = [
	{
		type: "harness:start",
		at: "00:00.0",
		message: "demo-workflow",
	},
	{ type: "phase:start", at: "00:00.2", phase: "Planning" },
	{ type: "task:start", at: "00:00.3", node: "planner" },
	{
		type: "agent:thinking",
		at: "00:00.5",
		node: "planner",
		message: "Planning for CLI TODO app",
	},
	{ type: "task:complete", at: "00:02.1", node: "planner" },
	{ type: "phase:complete", at: "00:02.2", phase: "Planning" },
	{ type: "phase:start", at: "00:02.3", phase: "Working" },
	{ type: "task:start", at: "00:02.4", node: "coder" },
	{
		type: "agent:thinking",
		at: "00:02.8",
		node: "coder",
		message: "Implementing core commands",
	},
	{ type: "task:complete", at: "00:05.1", node: "coder" },
	{ type: "task:start", at: "00:05.2", node: "reviewer" },
	{
		type: "agent:thinking",
		at: "00:05.8",
		node: "reviewer",
		message: "Reviewing for gaps and risks",
	},
	{ type: "task:complete", at: "00:07.3", node: "reviewer" },
	{ type: "phase:complete", at: "00:07.4", phase: "Working" },
	{ type: "harness:complete", at: "00:07.6", message: "success" },
];

type NodeStatus = "idle" | "running" | "done";

function computeStatus(events: WorkflowEvent[]): Record<string, NodeStatus> {
	const status: Record<string, NodeStatus> = {
		planner: "idle",
		coder: "idle",
		reviewer: "idle",
	};

	for (const event of events) {
		if (!event.node) continue;
		if (event.type === "task:start") {
			status[event.node] = "running";
		} else if (event.type === "task:complete") {
			status[event.node] = "done";
		}
	}

	return status;
}

function WorkflowNode({ data }: { data: Record<string, unknown> }) {
	const status = data.status as NodeStatus;
	const phase = data.phase as string;
	const title = data.title as string;
	const role = data.role as string;

	const statusStyles: Record<NodeStatus, string> = {
		idle: "border-white/40 bg-white/70 text-slate-900",
		running: "border-amber-300 bg-amber-50 text-amber-900 shadow-[0_0_0_2px_rgba(252,211,77,0.35)]",
		done: "border-emerald-300 bg-emerald-50 text-emerald-900 shadow-[0_0_0_2px_rgba(110,231,183,0.35)]",
	};

	return (
		<div
			className={`w-56 rounded-2xl border px-4 py-3 shadow-lg backdrop-blur ${statusStyles[status]}`}
		>
			<div className="text-xs uppercase tracking-[0.2em] text-slate-500">
				{phase}
			</div>
			<div className="mt-2 text-lg font-semibold">{title}</div>
			<div className="mt-1 text-sm text-slate-600">{role}</div>
			<div className="mt-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
				{status}
			</div>
		</div>
	);
}

export default function WorkflowDemoPage() {
	const [cursor, setCursor] = useState(1);
	const [playing, setPlaying] = useState(true);

	useEffect(() => {
		if (!playing) return undefined;

		const id = setInterval(() => {
			setCursor((prev) => (prev >= timeline.length ? 1 : prev + 1));
		}, 1200);

		return () => clearInterval(id);
	}, [playing]);

	const activeEvents = timeline.slice(0, cursor);
	const statusMap = useMemo(() => computeStatus(activeEvents), [activeEvents]);

	const nodes = useMemo(
		() =>
			baseNodes.map((node) => ({
				...node,
				data: {
					...node.data,
					status: statusMap[node.id],
				},
			})),
		[statusMap],
	);

	const latest = activeEvents[activeEvents.length - 1];

	return (
		<div
			className={`${spaceGrotesk.className} min-h-screen bg-[radial-gradient(circle_at_top,#fff5e6_0%,#f7f2ea_35%,#e6edf5_100%)] text-slate-900`}
		>
			<div className="mx-auto grid min-h-screen max-w-6xl gap-8 px-6 py-12 lg:grid-cols-[1.1fr_0.9fr]">
				<section className="rounded-[32px] border border-white/70 bg-white/60 p-6 shadow-[0_25px_60px_rgba(15,23,42,0.12)] backdrop-blur">
					<div className="flex items-start justify-between gap-4">
						<div>
							<p className="text-xs uppercase tracking-[0.4em] text-slate-500">
								Workflow demo
							</p>
							<h1 className="mt-3 text-3xl font-semibold">
								Planning → Working
							</h1>
							<p className="mt-2 text-sm text-slate-600">
								Live event playback from the kernel harness. Nodes light up as
								they run.
							</p>
						</div>
						<button
							type="button"
							onClick={() => setPlaying((value) => !value)}
							className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
						>
							{playing ? "Pause" : "Play"}
						</button>
					</div>

					<div className="mt-6 h-[420px] overflow-hidden rounded-3xl border border-slate-200/60 bg-white/70">
						<ReactFlow
							nodes={nodes}
							edges={edges}
							nodeTypes={{ workflow: WorkflowNode }}
							fitView
							panOnDrag={false}
							zoomOnScroll={false}
							zoomOnPinch={false}
							zoomOnDoubleClick={false}
						>
							<Background gap={16} color="#d6dde6" />
							<MiniMap
								pannable
								zoomable
								className="rounded-lg border border-slate-200 bg-white/80"
							/>
							<Controls position="bottom-right" showZoom={false} />
						</ReactFlow>
					</div>
				</section>

				<section className="rounded-[32px] border border-slate-200/70 bg-slate-950 p-6 text-slate-100 shadow-[0_20px_50px_rgba(15,23,42,0.25)]">
					<div className="flex items-center justify-between">
						<div>
							<p className="text-xs uppercase tracking-[0.3em] text-slate-400">
								Event timeline
							</p>
							<h2 className="mt-3 text-2xl font-semibold">Harness replay</h2>
						</div>
						<div className="rounded-full border border-slate-800 bg-slate-900 px-4 py-2 text-xs uppercase tracking-[0.3em] text-slate-400">
							{cursor}/{timeline.length}
						</div>
					</div>

					<div
						className={`${jetBrainsMono.className} mt-6 grid gap-3 text-xs text-slate-300`}
					>
						{activeEvents.slice(-6).map((event) => (
							<div
								key={`${event.type}-${event.at}`}
								className="rounded-xl border border-slate-800/80 bg-slate-900/70 p-3"
							>
								<div className="flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-slate-500">
									<span>{event.at}</span>
									<span>{event.type}</span>
								</div>
								<div className="mt-2 text-sm text-slate-200">
									{event.message ??
										event.node ??
										event.phase ??
										"kernel event"}
								</div>
							</div>
						))}
					</div>

					{latest && (
						<div className="mt-6 rounded-2xl border border-amber-300/40 bg-amber-200/10 p-4 text-sm text-amber-100">
							<span className="text-xs uppercase tracking-[0.3em] text-amber-200">
								Latest
							</span>
							<p className="mt-2 text-base">
								{latest.type} •{" "}
								{latest.message ?? latest.node ?? latest.phase ?? "event"}
							</p>
						</div>
					)}
				</section>
			</div>
		</div>
	);
}
