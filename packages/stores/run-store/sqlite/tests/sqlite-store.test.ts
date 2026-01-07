import { Database } from "bun:sqlite";
import { runStoreContract } from "@open-harness/run-store-testing";
import { SqliteRunStore } from "../src/index.js";

runStoreContract("SqliteRunStore", () => {
	const db = new Database(":memory:");
	const store = new SqliteRunStore({ db });
	return { store, cleanup: () => db.close() };
});
