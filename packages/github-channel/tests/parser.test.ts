import { describe, expect, it } from "bun:test";
import { parseReaction, parseSlashCommand } from "../src/parser.js";

describe("parseSlashCommand", () => {
	it("should return null for non-command text", () => {
		expect(parseSlashCommand("hello world", [])).toBeNull();
		expect(parseSlashCommand("not a command", [])).toBeNull();
	});

	it("should parse /pause", () => {
		const result = parseSlashCommand("/pause", ["pause"]);
		expect(result).toEqual({ type: "pause" });
	});

	it("should parse /resume", () => {
		const result = parseSlashCommand("/resume", ["resume"]);
		expect(result).toEqual({ type: "resume" });
	});

	it("should parse /abort with reason", () => {
		const result = parseSlashCommand("/abort test reason", ["abort"]);
		expect(result).toEqual({ type: "abort", reason: "test reason" });
	});

	it("should parse /abort without reason", () => {
		const result = parseSlashCommand("/abort", ["abort"]);
		expect(result).toEqual({ type: "abort", reason: undefined });
	});

	it("should parse /status", () => {
		const result = parseSlashCommand("/status", ["status"]);
		expect(result).toEqual({ type: "status" });
	});

	it("should parse /reply", () => {
		const result = parseSlashCommand("/reply prompt-123 my answer", ["reply"]);
		expect(result).toEqual({
			type: "reply",
			promptId: "prompt-123",
			text: "my answer",
		});
	});

	it("should parse /reply with multi-word text", () => {
		const result = parseSlashCommand(
			"/reply prompt-123 this is a longer answer",
			["reply"],
		);
		expect(result).toEqual({
			type: "reply",
			promptId: "prompt-123",
			text: "this is a longer answer",
		});
	});

	it("should parse /choose", () => {
		const result = parseSlashCommand("/choose prompt-456 optionA", ["choose"]);
		expect(result).toEqual({
			type: "choose",
			promptId: "prompt-456",
			choice: "optionA",
		});
	});

	it("should parse /help", () => {
		const result = parseSlashCommand("/help", ["help"]);
		expect(result).toEqual({ type: "help" });
	});

	it("should return unknown for invalid /reply", () => {
		const result = parseSlashCommand("/reply", ["reply"]);
		expect(result).toEqual({ type: "unknown" });
	});

	it("should return unknown for invalid /choose", () => {
		const result = parseSlashCommand("/choose", ["choose"]);
		expect(result).toEqual({ type: "unknown" });
	});

	it("should enforce allowlist", () => {
		const result = parseSlashCommand("/pause", ["resume"]);
		expect(result).toEqual({ type: "unknown" });
	});

	it("should allow all commands with empty allowlist", () => {
		const result = parseSlashCommand("/pause", []);
		expect(result).toEqual({ type: "pause" });
	});

	it("should handle case insensitivity", () => {
		const result = parseSlashCommand("/PAUSE", ["pause"]);
		expect(result).toEqual({ type: "pause" });
	});

	it("should handle extra whitespace", () => {
		const result = parseSlashCommand("  /pause  ", ["pause"]);
		expect(result).toEqual({ type: "pause" });
	});
});

describe("parseReaction", () => {
	it("should parse ✅ as confirm", () => {
		expect(parseReaction("✅")).toEqual({ type: "confirm" });
	});

	it("should parse ⏸️ as pause", () => {
		expect(parseReaction("⏸️")).toEqual({ type: "pause" });
	});

	it("should parse ▶️ as resume", () => {
		expect(parseReaction("▶️")).toEqual({ type: "resume" });
	});

	it("should parse 🛑 as abort", () => {
		expect(parseReaction("🛑")).toEqual({ type: "abort" });
	});

	it("should parse 🔁 as retry", () => {
		expect(parseReaction("🔁")).toEqual({ type: "retry" });
	});

	it("should parse 👍 as thumbsUp", () => {
		expect(parseReaction("👍")).toEqual({ type: "thumbsUp" });
	});

	it("should parse 👎 as thumbsDown", () => {
		expect(parseReaction("👎")).toEqual({ type: "thumbsDown" });
	});

	it("should return unknown for unrecognized emoji", () => {
		expect(parseReaction("🎉")).toEqual({ type: "unknown" });
		expect(parseReaction("unknown")).toEqual({ type: "unknown" });
	});

	it("should handle trimmed input", () => {
		expect(parseReaction("  ✅  ")).toEqual({ type: "confirm" });
	});
});
