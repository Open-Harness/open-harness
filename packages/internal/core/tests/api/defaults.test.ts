import { describe, expect, it, beforeEach } from "bun:test";
import {
	setDefaultStore,
	getDefaultStore,
	setDefaultMode,
	getDefaultMode,
	resetDefaults,
} from "../../src/api/defaults.js";
import type { FixtureStore } from "../../src/api/types.js";
import type { Recording, RecordingMetadata } from "../../src/recording/types.js";
import type { RecordingListQuery } from "../../src/recording/store.js";

/**
 * Mock fixture store for testing.
 */
class MockFixtureStore implements FixtureStore {
	readonly name: string;

	constructor(name = "mock") {
		this.name = name;
	}

	async save<T>(_recording: Recording<T>): Promise<void> {
		// No-op
	}

	async load<T>(_id: string): Promise<Recording<T> | null> {
		return null;
	}

	async list(_query?: RecordingListQuery): Promise<RecordingMetadata[]> {
		return [];
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
