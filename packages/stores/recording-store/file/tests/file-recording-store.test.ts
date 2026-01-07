import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { recordingStoreContract } from "@open-harness/recording-store-testing";
import { FileRecordingStore } from "../src/index.js";

recordingStoreContract("FileRecordingStore", () => {
	const directory = mkdtempSync(join(tmpdir(), "recording-store-"));
	const store = new FileRecordingStore({ directory });
	return {
		store,
		cleanup: () => rmSync(directory, { recursive: true, force: true }),
	};
});
