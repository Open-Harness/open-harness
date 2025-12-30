// Fixture loader for replay tests
// Loads JSONL fixtures from golden/ or scratch/ directories

import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export interface FixtureStep {
	type:
		| "emit"
		| "startSession"
		| "send"
		| "sendTo"
		| "sendToRun"
		| "reply"
		| "abort"
		| "setStatus";
	event?: unknown;
	contextOverride?: unknown;
	message?: string;
	agent?: string;
	runId?: string;
	promptId?: string;
	response?: {
		content: string;
		choice?: string;
		timestamp: string;
	};
	reason?: string;
	status?: string;
}

export interface FixtureExpect {
	events?: Array<{
		event: unknown;
		context: {
			sessionId: string;
			phase?: { name: string; number?: number };
			task?: { id: string };
			agent?: { name: string; type?: string };
		};
	}>;
	status?: string | null;
	sessionActive?: boolean | null;
}

export interface HubFixture {
	sessionId: string;
	scenario: string;
	steps: FixtureStep[];
	expect: FixtureExpect;
	metadata?: {
		recordedAt?: string;
		component?: string;
		description?: string;
	};
}

/**
 * Load a fixture from golden/ or scratch/ directory.
 * @param path - Path like "hub/subscribe-basic" (component/fixture-name)
 * @param fromScratch - If true, load from scratch/ instead of golden/
 */
export async function loadFixture(
	path: string,
	fromScratch = false,
): Promise<HubFixture> {
	const baseDir = fromScratch ? "scratch" : "golden";
	// Helper is in tests/helpers/, so go up one level to get to tests/
	const __filename = fileURLToPath(import.meta.url);
	const __dirname = dirname(__filename);
	const testsDir = join(__dirname, "..");
	const fixturePath = join(testsDir, "fixtures", baseDir, `${path}.jsonl`);

	const content = await readFile(fixturePath, "utf-8");
	const lines = content
		.trim()
		.split("\n")
		.filter((line) => line.trim());

	if (lines.length === 0) {
		throw new Error(`Fixture file is empty: ${fixturePath}`);
	}

	// JSONL format: one JSON object per line, take the first one
	const fixture = JSON.parse(lines[0]) as HubFixture;

	if (
		!fixture.sessionId ||
		!fixture.scenario ||
		!fixture.steps ||
		!fixture.expect
	) {
		throw new Error(`Invalid fixture format: ${fixturePath}`);
	}

	return fixture;
}
