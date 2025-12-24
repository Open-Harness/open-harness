/**
 * Smoke Test: Database Initialization
 * Verifies that the database initializes correctly with all tables
 */

import { describe, expect, test } from "bun:test";
import { TradingDatabase } from "../../src/core/database";

describe("Database Smoke Tests", () => {
	test("ST-01: Database initializes without errors", () => {
		const db = new TradingDatabase({ path: ":memory:" });
		expect(() => db.initialize()).not.toThrow();
		db.close();
	});

	test("ST-02: All required tables are created", () => {
		const db = new TradingDatabase({ path: ":memory:" });
		db.initialize();

		const tables = db.query<{ name: string }>("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");

		const tableNames = tables.map((t) => t.name);

		expect(tableNames).toContain("cache");
		expect(tableNames).toContain("trades");
		expect(tableNames).toContain("positions");
		expect(tableNames).toContain("dca_layers");
		expect(tableNames).toContain("audit_log");
		expect(tableNames).toContain("snapshots");
		expect(tableNames).toContain("snapshot_monologues");

		db.close();
	});

	test("ST-03: Can insert and query data", () => {
		const db = new TradingDatabase({ path: ":memory:" });
		db.initialize();

		// Insert test data
		db.run("INSERT INTO cache (key, value, expires_at) VALUES (?, ?, ?)", [
			"test_key",
			'{"test": true}',
			Date.now() + 60000,
		]);

		// Query it back
		const rows = db.query<{ key: string; value: string }>("SELECT key, value FROM cache WHERE key = ?", ["test_key"]);

		expect(rows.length).toBe(1);
		expect(rows[0].key).toBe("test_key");
		expect(JSON.parse(rows[0].value)).toEqual({ test: true });

		db.close();
	});
});
