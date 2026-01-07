import { runStoreContract } from "../../../../stores/run-store/testing/src/index.ts";
import { InMemoryRunStore } from "../../src/index.js";

// Test in-memory store using shared contract
runStoreContract("InMemoryRunStore", () => ({
	store: new InMemoryRunStore(),
}));
