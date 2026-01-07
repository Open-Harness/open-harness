import { Database } from "bun:sqlite";
import { recordingStoreContract } from "@open-harness/recording-store-testing";
import { SqliteRecordingStore } from "../src/index.js";

recordingStoreContract("SqliteRecordingStore", () => {
	const db = new Database(":memory:");
	const store = new SqliteRecordingStore({ db });
	return { store, cleanup: () => db.close() };
});
