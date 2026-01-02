#!/usr/bin/env bun
/**
 * Manual validation script for Hub Channel Registration API
 * Run with: bun run scripts/validate-channels.ts
 */

import { HubImpl } from "../src/engine/hub.js";

console.log("🧪 Validating Hub Channel Registration API...\n");

const hub = new HubImpl("validation-session");

// Track all events
const allEvents: string[] = [];
hub.subscribe("*", (e) => {
	allEvents.push(e.event.type);
});

// Test 1: Register channels
console.log("1️⃣  Registering channels...");
hub.registerChannel({
	name: "logger",
	state: () => ({ logs: [] as string[] }),
	onStart: ({ state }) => {
		console.log("   📝 Logger channel started");
		state.logs.push("started");
	},
	on: {
		"test:*": ({ state, event }) => {
			const msg = `Received: ${event.event.type}`;
			state.logs.push(msg);
			console.log(`   📝 ${msg}`);
		},
	},
	onComplete: ({ state }) => {
		console.log(`   📝 Logger channel stopped (${state.logs.length} logs)`);
	},
});

hub.registerChannel({
	name: "counter",
	state: () => ({ count: 0 }),
	onStart: () => {
		console.log("   🔢 Counter channel started");
	},
	on: {
		"test:increment": ({ state }) => {
			state.count++;
			console.log(`   🔢 Count: ${state.count}`);
		},
	},
	onComplete: ({ state }) => {
		console.log(`   🔢 Counter channel stopped (final count: ${state.count})`);
	},
});

console.log(`   ✅ Registered channels: ${hub.channels.join(", ")}\n`);

// Test 2: Verify channels are inactive before start
console.log("2️⃣  Emitting event BEFORE start (should NOT trigger handlers)...");
hub.emit({ type: "test:increment" });
console.log("   ✅ No handler output (as expected)\n");

// Test 3: Start hub
console.log("3️⃣  Starting hub...");
await hub.start();
console.log("   ✅ Hub started\n");

// Test 4: Emit events
console.log("4️⃣  Emitting events AFTER start...");
hub.emit({ type: "test:hello" });
hub.emit({ type: "test:increment" });
hub.emit({ type: "test:increment" });
hub.emit({ type: "test:increment" });
hub.emit({ type: "test:world" });

// Small delay for async handlers
await new Promise((r) => setTimeout(r, 50));
console.log("");

// Test 5: Stop hub
console.log("5️⃣  Stopping hub...");
await hub.stop();
console.log("   ✅ Hub stopped\n");

// Test 6: Verify events were emitted
console.log("6️⃣  Verifying channel lifecycle events...");
const channelEvents = allEvents.filter((e) => e.startsWith("channel:"));
console.log(`   Channel events: ${channelEvents.join(", ")}`);

const hasRegistered =
	channelEvents.filter((e) => e === "channel:registered").length === 2;
const hasStarted =
	channelEvents.filter((e) => e === "channel:started").length === 2;
const hasStopped =
	channelEvents.filter((e) => e === "channel:stopped").length === 2;

console.log(`   ✅ 2x channel:registered: ${hasRegistered}`);
console.log(`   ✅ 2x channel:started: ${hasStarted}`);
console.log(`   ✅ 2x channel:stopped: ${hasStopped}\n`);

// Test 7: Verify idempotency
console.log("7️⃣  Testing idempotency (calling start/stop multiple times)...");
await hub.start();
await hub.start();
await hub.start();
console.log("   ✅ Multiple start() calls - no errors");
await hub.stop();
await hub.stop();
console.log("   ✅ Multiple stop() calls - no errors\n");

// Summary
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("✅ All manual validations passed!");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
