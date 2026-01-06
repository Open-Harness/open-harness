import { runStoreContract } from "@open-harness/persistence-testing";
import { InMemoryRunStore } from "../../src/persistence/memory-run-store.js";

// Test in-memory store using shared contract
runStoreContract("InMemoryRunStore", () => ({
	store: new InMemoryRunStore(),
}));
