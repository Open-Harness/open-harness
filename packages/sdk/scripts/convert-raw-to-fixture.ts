import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type {
  SDKMessage,
  SDKResultMessage,
} from "@anthropic-ai/claude-agent-sdk";
import type { FixtureFile } from "@open-harness/provider-anthropic";

/**
 * Converts raw SDK capture JSON to FixtureFile format for use with createMockQuery.
 *
 * Usage:
 *   bun run scripts/convert-raw-to-fixture.ts
 */
function main() {
  const rawCapturePath = resolve(
    process.cwd(),
    "tests/fixtures/recordings/captured/raw-sdk-capture.json",
  );
  const outputPath = resolve(
    process.cwd(),
    "tests/fixtures/recordings/captured/raw-sdk-capture.fixture.json",
  );

  console.log(`Reading raw capture from: ${rawCapturePath}`);
  const rawCapture = JSON.parse(readFileSync(rawCapturePath, "utf-8")) as {
    prompt: string;
    messages: SDKMessage[];
  };

  // Extract the result message (last message with type "result")
  const resultMessage = rawCapture.messages.findLast(
    (msg) => msg.type === "result",
  ) as SDKResultMessage | undefined;

  if (!resultMessage) {
    throw new Error("No result message found in raw capture");
  }

  if (resultMessage.subtype !== "success") {
    throw new Error(
      `Result message has subtype "${resultMessage.subtype}", expected "success"`,
    );
  }

  // Build input from prompt
  const input = {
    prompt: rawCapture.prompt,
  };

  // Build output from result message
  // TypeScript knows result exists when subtype === "success"
  const successResult = resultMessage as SDKResultMessage & {
    subtype: "success";
    result: string;
  };

  const output = {
    text: successResult.result ?? "",
    usage: successResult.usage,
    modelUsage: successResult.modelUsage,
    totalCostUsd: successResult.total_cost_usd,
    durationMs: successResult.duration_ms,
    sessionId: successResult.session_id,
    numTurns: successResult.num_turns,
    permissionDenials: successResult.permission_denials,
  };

  // All messages (including result) are events
  const events = rawCapture.messages;

  // Create fixture file
  const fixture: FixtureFile = {
    calls: [
      {
        input,
        output,
        events,
      },
    ],
  };

  console.log(`Writing fixture to: ${outputPath}`);
  writeFileSync(outputPath, JSON.stringify(fixture, null, 2), "utf-8");

  console.log("Conversion complete!");
  console.log(`  Input prompt: ${input.prompt.substring(0, 50)}...`);
  console.log(`  Output text: ${output.text.substring(0, 50)}...`);
  console.log(`  Events: ${events.length} messages`);
}

main();
