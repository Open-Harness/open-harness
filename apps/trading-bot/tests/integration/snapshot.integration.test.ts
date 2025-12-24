/**
 * Snapshot Integration Tests
 * Tests capture, restore, and time-travel capabilities
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync } from "node:fs";
import type { AgentState, MonologueEntry } from "../../src/snapshotting/agent-state";
import { SnapshotStorage } from "../../src/snapshotting/snapshot-storage";
import { createTestContext } from "../helpers/test-container";

const TEST_SNAPSHOTS_DIR = "/tmp/trading-bot-test-snapshots";

describe("Snapshot Storage Integration", () => {
	beforeAll(() => {
		// Create test snapshots directory
		mkdirSync(TEST_SNAPSHOTS_DIR, { recursive: true });
	});

	afterAll(() => {
		// Cleanup test snapshots
		try {
			rmSync(TEST_SNAPSHOTS_DIR, { recursive: true, force: true });
		} catch {
			// Ignore cleanup errors
		}
	});

	function createMockState(stage: string = "OBSERVE"): AgentState {
		return {
			strategy: {
				name: "RSI Oversold",
				currentStage: stage,
				entryDoctrine: "RSI < 20",
				exitDoctrine: "2% profit or 24h timeout",
			},
			position: {
				hasOpenPosition: false,
				symbol: "BTC/USDT",
				side: null,
				size: 0,
				entryPrice: 0,
				currentPrice: 42000,
				unrealizedPnl: 0,
				dcaLayers: 0,
			},
			market: {
				rsi: 35,
				bbPosition: "middle",
				trend: "neutral",
				volatility: "medium",
			},
			risk: {
				exposurePercent: 0,
				liquidationDistance: 0,
				cooldownRemaining: 0,
			},
		};
	}

	function createMockMonologues(): MonologueEntry[] {
		return [
			{
				timestamp: Date.now() - 60000,
				stage: "OBSERVE",
				content: "Fetched 100 candles for BTC/USDT. Current price: $42,000",
			},
			{
				timestamp: Date.now() - 30000,
				stage: "ANALYZE",
				content: "RSI at 35 - above oversold threshold. Waiting for better entry.",
			},
		];
	}

	test("INT-S01: Captures snapshot with full state", async () => {
		const ctx = createTestContext();
		const storage = new SnapshotStorage(ctx.db, ctx.timeSource, TEST_SNAPSHOTS_DIR);

		const state = createMockState("ANALYZE");
		const monologues = createMockMonologues();

		const snapshot = await storage.capture("test-snapshot-1", state, monologues, {
			createdBy: "manual",
			reason: "Integration test",
		});

		expect(snapshot.id).toBeDefined();
		expect(snapshot.name).toBe("test-snapshot-1");
		expect(snapshot.state.strategy.currentStage).toBe("ANALYZE");
		expect(snapshot.monologues.length).toBe(2);
		expect(snapshot.metadata.createdBy).toBe("manual");

		ctx.db.close();
	});

	test("INT-S02: Restores snapshot from storage", async () => {
		const ctx = createTestContext();
		const storage = new SnapshotStorage(ctx.db, ctx.timeSource, TEST_SNAPSHOTS_DIR);

		// Capture a snapshot
		const state = createMockState("EXECUTE");
		state.position = {
			hasOpenPosition: true,
			symbol: "BTC/USDT",
			side: "long",
			size: 0.01,
			entryPrice: 41500,
			currentPrice: 42000,
			unrealizedPnl: 5,
			dcaLayers: 1,
		};

		const original = await storage.capture("restore-test", state, createMockMonologues(), {
			createdBy: "auto",
			reason: "Testing restore",
		});

		// Restore it
		const restored = await storage.restore(original.id);

		expect(restored).not.toBeNull();
		expect(restored!.id).toBe(original.id);
		expect(restored!.state.strategy.currentStage).toBe("EXECUTE");
		expect(restored!.state.position.hasOpenPosition).toBe(true);
		expect(restored!.state.position.entryPrice).toBe(41500);

		ctx.db.close();
	});

	test("INT-S03: Lists snapshots with filtering", async () => {
		const ctx = createTestContext();
		const storage = new SnapshotStorage(ctx.db, ctx.timeSource, TEST_SNAPSHOTS_DIR);

		// Create multiple snapshots at different stages
		await storage.capture("snap-observe", createMockState("OBSERVE"), [], {
			createdBy: "auto",
			reason: "Test 1",
		});

		ctx.timeSource.advance(1000);

		await storage.capture("snap-analyze", createMockState("ANALYZE"), [], {
			createdBy: "auto",
			reason: "Test 2",
		});

		ctx.timeSource.advance(1000);

		await storage.capture("snap-execute", createMockState("EXECUTE"), [], {
			createdBy: "manual",
			reason: "Test 3",
		});

		// List all
		const all = await storage.list({ limit: 10 });
		expect(all.length).toBeGreaterThanOrEqual(3);

		// Filter by stage
		const observeSnaps = await storage.list({ stage: "OBSERVE" });
		expect(observeSnaps.every((s) => s.stage === "OBSERVE")).toBe(true);

		// Filter with limit
		const limited = await storage.list({ limit: 2 });
		expect(limited.length).toBe(2);

		ctx.db.close();
	});

	test("INT-S04: Finds nearest snapshot to timestamp", async () => {
		const startTime = 1000000;
		const ctx = createTestContext(startTime);
		const storage = new SnapshotStorage(ctx.db, ctx.timeSource, TEST_SNAPSHOTS_DIR);

		// Create snapshots at different times
		const snap1 = await storage.capture("t1000000", createMockState(), [], {
			createdBy: "auto",
			reason: "First",
		});

		ctx.timeSource.setTime(startTime + 60000); // +1 minute

		const snap2 = await storage.capture("t1060000", createMockState(), [], {
			createdBy: "auto",
			reason: "Second",
		});

		ctx.timeSource.setTime(startTime + 120000); // +2 minutes

		await storage.capture("t1120000", createMockState(), [], {
			createdBy: "auto",
			reason: "Third",
		});

		// Find nearest to 1030000 (should be snap1)
		const nearest = await storage.findNearestTo(startTime + 30000);
		expect(nearest).toBe(snap1.id);

		// Find nearest to 1090000 (should be snap2)
		const nearest2 = await storage.findNearestTo(startTime + 90000);
		expect(nearest2).toBe(snap2.id);

		ctx.db.close();
	});

	test("INT-S05: Deletes snapshot and cleans up files", async () => {
		const ctx = createTestContext();
		const storage = new SnapshotStorage(ctx.db, ctx.timeSource, TEST_SNAPSHOTS_DIR);

		const snapshot = await storage.capture("to-delete", createMockState(), [], {
			createdBy: "manual",
			reason: "Will be deleted",
		});

		// Verify it exists
		const beforeDelete = await storage.restore(snapshot.id);
		expect(beforeDelete).not.toBeNull();

		// Delete it
		const deleted = await storage.delete(snapshot.id);
		expect(deleted).toBe(true);

		// Verify it's gone
		const afterDelete = await storage.restore(snapshot.id);
		expect(afterDelete).toBeNull();

		ctx.db.close();
	});

	test("INT-S06: Returns null for non-existent snapshot", async () => {
		const ctx = createTestContext();
		const storage = new SnapshotStorage(ctx.db, ctx.timeSource, TEST_SNAPSHOTS_DIR);

		const result = await storage.restore("non-existent-id-12345");
		expect(result).toBeNull();

		ctx.db.close();
	});

	test("INT-S07: Stores monologues separately for querying", async () => {
		const ctx = createTestContext();
		const storage = new SnapshotStorage(ctx.db, ctx.timeSource, TEST_SNAPSHOTS_DIR);

		const monologues: MonologueEntry[] = [
			{ timestamp: 1000, stage: "OBSERVE", content: "Started observation" },
			{ timestamp: 2000, stage: "ANALYZE", content: "RSI is oversold" },
			{ timestamp: 3000, stage: "EXECUTE", content: "Placing order" },
		];

		const snapshot = await storage.capture("monologue-test", createMockState("EXECUTE"), monologues, {
			createdBy: "auto",
			reason: "Testing monologues",
		});

		// Query monologues directly from DB
		const dbMonologues = ctx.db.query<{ agent_decision: string; explanation: string }>(
			"SELECT agent_decision, explanation FROM snapshot_monologues WHERE snapshot_id = ? ORDER BY timestamp",
			[snapshot.id],
		);

		expect(dbMonologues.length).toBe(3);
		expect(dbMonologues[0].agent_decision).toBe("OBSERVE");
		expect(dbMonologues[1].agent_decision).toBe("ANALYZE");
		expect(dbMonologues[2].agent_decision).toBe("EXECUTE");

		ctx.db.close();
	});

	test("INT-S08: Handles error snapshots correctly", async () => {
		const ctx = createTestContext();
		const storage = new SnapshotStorage(ctx.db, ctx.timeSource, TEST_SNAPSHOTS_DIR);

		const errorState = createMockState("OBSERVE");

		const snapshot = await storage.capture("error-snapshot", errorState, [], {
			createdBy: "error",
			reason: "Order rejected: exposure_limit_reached",
		});

		expect(snapshot.metadata.createdBy).toBe("error");
		expect(snapshot.metadata.reason).toContain("exposure_limit_reached");

		// Can filter for error snapshots
		const errorSnaps = await storage.list({ limit: 100 });
		const found = errorSnaps.find((s) => s.id === snapshot.id);
		expect(found).toBeDefined();

		ctx.db.close();
	});

	test("INT-S09: Snapshot ID is unique and time-based", async () => {
		const ctx = createTestContext();
		const storage = new SnapshotStorage(ctx.db, ctx.timeSource, TEST_SNAPSHOTS_DIR);

		const snap1 = await storage.capture("unique-1", createMockState(), [], {
			createdBy: "auto",
			reason: "Test",
		});

		ctx.timeSource.advance(100);

		const snap2 = await storage.capture("unique-2", createMockState(), [], {
			createdBy: "auto",
			reason: "Test",
		});

		expect(snap1.id).not.toBe(snap2.id);
		expect(snap1.id.length).toBeGreaterThan(10);
		expect(snap2.id.length).toBeGreaterThan(10);

		ctx.db.close();
	});

	test("INT-S10: Full time-travel scenario", async () => {
		const startTime = Date.now();
		const ctx = createTestContext(startTime);
		const storage = new SnapshotStorage(ctx.db, ctx.timeSource, TEST_SNAPSHOTS_DIR);

		// Simulate a trading session with snapshots at each stage
		const stages = ["OBSERVE", "ANALYZE", "VALIDATE", "EXECUTE", "NARRATE", "MONITOR", "FINAL_NARRATE"];

		const snapshots: string[] = [];

		for (let i = 0; i < stages.length; i++) {
			const state = createMockState(stages[i]);
			if (i >= 3) {
				// After EXECUTE, we have a position
				state.position = {
					hasOpenPosition: true,
					symbol: "BTC/USDT",
					side: "long",
					size: 0.01,
					entryPrice: 42000,
					currentPrice: 42000 + i * 100,
					unrealizedPnl: (i - 3) * 10,
					dcaLayers: 0,
				};
			}

			const snap = await storage.capture(`stage-${stages[i]}`, state, [], {
				createdBy: "auto",
				reason: `Stage ${i + 1}/${stages.length}`,
			});

			snapshots.push(snap.id);
			ctx.timeSource.advance(60000); // 1 minute between stages
		}

		// Time travel back to VALIDATE stage
		const validateSnap = await storage.restore(snapshots[2]);
		expect(validateSnap).not.toBeNull();
		expect(validateSnap!.state.strategy.currentStage).toBe("VALIDATE");
		expect(validateSnap!.state.position.hasOpenPosition).toBe(false);

		// Time travel forward to MONITOR stage
		const monitorSnap = await storage.restore(snapshots[5]);
		expect(monitorSnap).not.toBeNull();
		expect(monitorSnap!.state.strategy.currentStage).toBe("MONITOR");
		expect(monitorSnap!.state.position.hasOpenPosition).toBe(true);
		expect(monitorSnap!.state.position.unrealizedPnl).toBeGreaterThan(0);

		ctx.db.close();
	});
});
