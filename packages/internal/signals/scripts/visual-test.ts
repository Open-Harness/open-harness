#!/usr/bin/env bun
/**
 * Visual Test Script - Terminal Adapter Output Verification
 *
 * This script emits sample signals through terminalAdapter() to verify
 * ANSI color rendering and display formatting. Used with the tttd skill
 * for visual regression testing.
 *
 * Expected Visual Output:
 * - SUCCESS (✓) icons should be GREEN
 * - ERROR (✗) icons should be RED
 * - ACTIVE/WARNING (●/⚠) icons should be YELLOW
 * - PENDING (○) icons should be BLUE
 * - Progress bars render as [████████░░░░░░░░░░░░]
 * - Stream signals append without newlines
 *
 * Run: bun packages/internal/signals/scripts/visual-test.ts
 */

import { createSignal, type Signal, type SignalDisplay } from "@internal/signals-core";
import { terminalAdapter } from "../src/adapters/terminal.js";

// Collect output for verification
const outputLines: string[] = [];
const capture = (text: string) => {
	outputLines.push(text);
	process.stdout.write(text);
};

const adapter = terminalAdapter({
	write: capture,
	colors: true,
	showTimestamp: false,
});

// Helper to create signal with display metadata
function signal(name: string, display: Partial<SignalDisplay>, payload?: unknown): Signal {
	return createSignal(name, payload ?? {}, { source: "visual-test", display: display as SignalDisplay });
}

console.log("═══════════════════════════════════════════════════════════════");
console.log("  Terminal Adapter Visual Test - ANSI Color Verification");
console.log("═══════════════════════════════════════════════════════════════\n");

// Start adapter lifecycle
adapter.onStart?.();

// ─────────────────────────────────────────────────────────────────
// SECTION 1: Status Display Types (all statuses)
// ─────────────────────────────────────────────────────────────────
console.log("─── STATUS DISPLAY TYPES ───────────────────────────────────────");
console.log("Expected: ● YELLOW (active), ✓ GREEN (success), ✗ RED (error)");
console.log("          ⚠ YELLOW (warning), ○ BLUE (pending)\n");

adapter.onSignal(signal("test:status", { type: "status", status: "pending", title: "Pending status (BLUE ○)" }));
adapter.onSignal(signal("test:status", { type: "status", status: "active", title: "Active status (YELLOW ●)" }));
adapter.onSignal(signal("test:status", { type: "status", status: "success", title: "Success status (GREEN ✓)" }));
adapter.onSignal(signal("test:status", { type: "status", status: "error", title: "Error status (RED ✗)" }));
adapter.onSignal(signal("test:status", { type: "status", status: "warning", title: "Warning status (YELLOW ⚠)" }));

// ─────────────────────────────────────────────────────────────────
// SECTION 2: Notification Display Types
// ─────────────────────────────────────────────────────────────────
console.log("\n─── NOTIFICATION DISPLAY TYPES ─────────────────────────────────");
console.log("Expected: Same color mapping as status\n");

adapter.onSignal(
	signal("test:notification", {
		type: "notification",
		status: "success",
		title: "Task completed successfully",
		subtitle: "This is a success notification (GREEN)",
	}),
);

adapter.onSignal(
	signal("test:notification", {
		type: "notification",
		status: "error",
		title: "Operation failed",
		subtitle: "This is an error notification (RED)",
	}),
);

adapter.onSignal(
	signal("test:notification", {
		type: "notification",
		status: "warning",
		title: "Potential issue detected",
		subtitle: "This is a warning notification (YELLOW)",
	}),
);

// ─────────────────────────────────────────────────────────────────
// SECTION 3: Progress Display Types
// ─────────────────────────────────────────────────────────────────
console.log("\n─── PROGRESS DISPLAY TYPES ─────────────────────────────────────");
console.log("Expected: Progress bars [████░░░░] and step counts (2/5)\n");

adapter.onSignal(
	signal("test:progress", {
		type: "progress",
		status: "active",
		title: "Downloading files",
		progress: 25,
	}),
);

adapter.onSignal(
	signal("test:progress", {
		type: "progress",
		status: "active",
		title: "Processing items",
		progress: 50,
	}),
);

adapter.onSignal(
	signal("test:progress", {
		type: "progress",
		status: "active",
		title: "Almost done",
		progress: 75,
	}),
);

adapter.onSignal(
	signal("test:progress", {
		type: "progress",
		status: "success",
		title: "Complete!",
		progress: 100,
	}),
);

// Step-based progress
adapter.onSignal(
	signal("test:steps", {
		type: "progress",
		status: "active",
		title: "Processing tasks",
		progress: { current: 3, total: 10 },
	}),
);

adapter.onSignal(
	signal("test:steps", {
		type: "progress",
		status: "success",
		title: "All tasks done",
		progress: { current: 10, total: 10 },
	}),
);

// ─────────────────────────────────────────────────────────────────
// SECTION 4: Stream Display Types
// ─────────────────────────────────────────────────────────────────
console.log("\n─── STREAM DISPLAY TYPES ───────────────────────────────────────");
console.log("Expected: → icon, streaming text appends without newlines\n");

// First stream signal (gets icon prefix)
adapter.onSignal(
	signal("llm:delta", {
		type: "stream",
		status: "active",
		title: "Generating response...",
		append: false,
	}),
);

// Simulate streaming tokens
const streamTokens = ["Hello", ", ", "this ", "is ", "streaming ", "text", "!"];
for (const token of streamTokens) {
	adapter.onSignal(
		createSignal("text:delta", token, {
			source: "visual-test",
			display: { type: "stream", append: true },
		}),
	);
}
// Add newline after stream
console.log("");

// ─────────────────────────────────────────────────────────────────
// SECTION 5: Log Display Types
// ─────────────────────────────────────────────────────────────────
console.log("\n─── LOG DISPLAY TYPES ──────────────────────────────────────────");
console.log("Expected: [signal:name] prefix in dim/gray\n");

adapter.onSignal(
	signal("app:info", {
		type: "log",
		title: "Application started on port 3000",
	}),
);

adapter.onSignal(
	signal("db:query", {
		type: "log",
		title: "SELECT * FROM users WHERE id = 42",
	}),
);

// ─────────────────────────────────────────────────────────────────
// SECTION 6: Convention-Based Inference (No explicit display)
// ─────────────────────────────────────────────────────────────────
console.log("\n─── CONVENTION-BASED INFERENCE ─────────────────────────────────");
console.log("Expected: Infers display type from signal name suffix\n");

// These use ONLY naming conventions, no explicit display metadata
adapter.onSignal(createSignal("task:start", { taskId: 1 }, { source: "visual-test" }));
adapter.onSignal(createSignal("task:complete", { taskId: 1 }, { source: "visual-test" }));
adapter.onSignal(createSignal("validation:error", { field: "email" }, { source: "visual-test" }));
adapter.onSignal(createSignal("limit:warning", { usage: "90%" }, { source: "visual-test" }));

// ─────────────────────────────────────────────────────────────────
// SECTION 7: Custom Icons
// ─────────────────────────────────────────────────────────────────
console.log("\n─── CUSTOM ICONS ───────────────────────────────────────────────");
console.log("Expected: Custom emoji/icons override defaults\n");

adapter.onSignal(
	signal("rocket:launch", {
		type: "notification",
		status: "success",
		title: "Deployment started",
		icon: "🚀",
	}),
);

adapter.onSignal(
	signal("coffee:break", {
		type: "status",
		status: "active",
		title: "Taking a break",
		icon: "☕",
	}),
);

adapter.onSignal(
	signal("star:earned", {
		type: "notification",
		status: "success",
		title: "Achievement unlocked!",
		icon: "⭐",
	}),
);

// Stop adapter lifecycle
adapter.onStop?.();

console.log("\n═══════════════════════════════════════════════════════════════");
console.log("  Visual Test Complete");
console.log("═══════════════════════════════════════════════════════════════");
console.log("\nVerify the following:");
console.log("  ✓ SUCCESS icons appear in GREEN");
console.log("  ✓ ERROR icons appear in RED");
console.log("  ✓ ACTIVE/WARNING icons appear in YELLOW");
console.log("  ✓ PENDING icons appear in BLUE");
console.log("  ✓ Progress bars render correctly [████████░░░░]");
console.log("  ✓ Stream text appends properly");
console.log("  ✓ Log messages have dim [signal:name] prefix");
console.log("  ✓ Custom icons (🚀, ☕, ⭐) render correctly");
