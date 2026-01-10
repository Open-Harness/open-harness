import { describe, expect, it, beforeEach } from "bun:test";
import {
	setDefaultStore,
	getDefaultStore,
	setDefaultMode,
	getDefaultMode,
	resetDefaults,
} from "../../src/api/defaults.js";
import type { FixtureStore } from "../../src/api/types.js";
import type { Recording, RecordingMetadata, Checkpoint } from "@signals/bus";
import type { Signal } from "@signals/core";

/**
 * Mock fixture store for testing.
 * Implements SignalStore interface (v0.3.0).
 */
class MockFixtureStore implements FixtureStore {
	readonly name: string;

	constructor(name = "mock") {
		this.name = name;
	}

	async create(_options?: { name?: string; tags?: string[]; providerType?: string }): Promise<string> {
		return "mock-recording-id";
	}

	async append(_recordingId: string, _signal: Signal): Promise<void> {
		// No-op
	}

	async appendBatch(_recordingId: string, _signals: Signal[]): Promise<void> {
		// No-op
	}

	async checkpoint(_recordingId: string, _name: string): Promise<void> {
		// No-op
	}

	async getCheckpoints(_recordingId: string): Promise<Checkpoint[]> {
		return [];
	}

	async finalize(_recordingId: string, _durationMs?: number): Promise<void> {
		// No-op
	}

	async load(_recordingId: string): Promise<Recording | null> {
		return null;
	}

	async loadSignals(
		_recordingId: string,
		_options?: { fromIndex?: number; toIndex?: number; patterns?: string[] },
	): Promise<Signal[]> {
		return [];
	}

	async list(_query?: { providerType?: string; tags?: string[]; limit?: number; offset?: number }): Promise<RecordingMetadata[]> {
		return [];
	}

	async delete(_recordingId: string): Promise<void> {
		// No-op
	}

	async exists(_recordingId: string): Promise<boolean> {
		return false;
	}
}

describe("api/defaults", () => {
	beforeEach(() => {
		resetDefaults();
	});

	describe("setDefaultStore / getDefaultStore", () => {
		it("should return undefined when no default store is set", () => {
			expect(getDefaultStore()).toBeUndefined();
		});

		it("should set and retrieve the default store", () => {
			const store = new MockFixtureStore("test-store");

			setDefaultStore(store);

			expect(getDefaultStore()).toBe(store);
		});

		it("should clear the default store when set to undefined", () => {
			const store = new MockFixtureStore();
			setDefaultStore(store);
			expect(getDefaultStore()).toBe(store);

			setDefaultStore(undefined);

			expect(getDefaultStore()).toBeUndefined();
		});

		it("should replace previous default store", () => {
			const store1 = new MockFixtureStore("store-1");
			const store2 = new MockFixtureStore("store-2");

			setDefaultStore(store1);
			expect(getDefaultStore()).toBe(store1);

			setDefaultStore(store2);
			expect(getDefaultStore()).toBe(store2);
		});
	});

	describe("setDefaultMode / getDefaultMode", () => {
		it("should return 'live' when no default mode is set", () => {
			expect(getDefaultMode()).toBe("live");
		});

		it("should set and retrieve the default mode", () => {
			setDefaultMode("record");

			expect(getDefaultMode()).toBe("record");
		});

		it("should clear the default mode when set to undefined", () => {
			setDefaultMode("replay");
			expect(getDefaultMode()).toBe("replay");

			setDefaultMode(undefined);

			expect(getDefaultMode()).toBe("live");
		});

		it("should support all fixture modes", () => {
			setDefaultMode("record");
			expect(getDefaultMode()).toBe("record");

			setDefaultMode("replay");
			expect(getDefaultMode()).toBe("replay");

			setDefaultMode("live");
			expect(getDefaultMode()).toBe("live");
		});
	});

	describe("resetDefaults", () => {
		it("should reset both store and mode to initial state", () => {
			const store = new MockFixtureStore();
			setDefaultStore(store);
			setDefaultMode("record");

			resetDefaults();

			expect(getDefaultStore()).toBeUndefined();
			expect(getDefaultMode()).toBe("live");
		});
	});

	describe("independence", () => {
		it("should allow setting store and mode independently", () => {
			const store = new MockFixtureStore();

			setDefaultStore(store);
			// Mode should still be default
			expect(getDefaultMode()).toBe("live");

			setDefaultMode("replay");
			// Store should still be set
			expect(getDefaultStore()).toBe(store);
		});
	});
});
