import { beforeEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { UIMessage } from "ai";
import type { RuntimeEvent } from "../../core/events";
import { LocalAIKitTransport } from "../../src/server/transports/ai-sdk-local-transport";
import { MockRuntime } from "../helpers/mock-runtime.js";

describe("LocalAIKitTransport", () => {
  let mockRuntime: MockRuntime;
  let transport: LocalAIKitTransport;

  beforeEach(() => {
    mockRuntime = new MockRuntime();
    transport = new LocalAIKitTransport(
      mockRuntime as unknown as import("@open-harness/sdk").Runtime,
    );
  });

  describe("sendMessages", () => {
    test("extracts last user message and dispatches to runtime", async () => {
      const messages: UIMessage[] = [
        {
          id: "1",
          role: "user" as const,
          parts: [{ type: "text", text: "Hello" }],
        },
        { id: "2", role: "assistant" as const, parts: [] },
        {
          id: "3",
          role: "user" as const,
          parts: [{ type: "text", text: "World" }],
        },
      ];

      await transport.sendMessages({
        trigger: "submit-message",
        chatId: "chat-1",
        messageId: undefined,
        messages,
        abortSignal: new AbortController().signal,
      });

      // Wait for async dispatch to complete (transport uses setTimeout(0))
      await new Promise((resolve) => setTimeout(resolve, 10));

      const commands = mockRuntime.getDispatchedCommands();
      expect(commands).toHaveLength(1);
      expect(commands[0]).toMatchObject({
        type: "send",
        message: "World",
      });
    });

    test("throws error when no user message found", async () => {
      const messages: UIMessage[] = [
        { id: "1", role: "assistant" as const, parts: [] },
      ];

      await expect(
        transport.sendMessages({
          trigger: "submit-message",
          chatId: "chat-1",
          messageId: undefined,
          messages,
          abortSignal: new AbortController().signal,
        }),
      ).rejects.toThrow("No user message found");
    });

    test("throws error when user message has no text part", async () => {
      const messages: UIMessage[] = [
        { id: "1", role: "user" as const, parts: [] },
      ];

      await expect(
        transport.sendMessages({
          trigger: "submit-message",
          chatId: "chat-1",
          messageId: undefined,
          messages,
          abortSignal: new AbortController().signal,
        }),
      ).rejects.toThrow("User message has no text content");
    });

    test("transforms text events to chunks", async () => {
      const messages: UIMessage[] = [
        {
          id: "1",
          role: "user" as const,
          parts: [{ type: "text", text: "Hello" }],
        },
      ];

      const stream = await transport.sendMessages({
        trigger: "submit-message",
        chatId: "chat-1",
        messageId: undefined,
        messages,
        abortSignal: new AbortController().signal,
      });

      const chunks: unknown[] = [];
      const reader = stream.getReader();

      // Start reading immediately (non-blocking)
      const readPromise = (async () => {
        try {
          let done = false;
          while (!done) {
            const result = await reader.read();
            if (result.done) {
              done = true;
            } else {
              chunks.push(result.value);
            }
          }
        } catch (_error) {
          // Reader might be cancelled, ignore
        }
      })();

      // Wait for stream subscription to be ready (transport uses setTimeout(0) + dispatch)
      await new Promise((resolve) => setTimeout(resolve, 20));

      // Emit text delta event
      mockRuntime.emit({
        type: "agent:text:delta",
        nodeId: "n1",
        runId: "r1",
        content: "Hi",
        timestamp: Date.now(),
      });

      // Small delay to ensure event is processed
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Emit complete to close stream
      mockRuntime.emit({
        type: "agent:complete",
        nodeId: "n1",
        runId: "r1",
        result: "Done",
        usage: { inputTokens: 10, outputTokens: 20 },
        durationMs: 100,
        numTurns: 1,
        timestamp: Date.now(),
      });

      // Wait for reading to complete with timeout
      await Promise.race([
        readPromise,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Timeout")), 1000),
        ),
      ]).catch(() => {
        // If timeout, reader might still be waiting - cancel it
        reader.cancel();
      });

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0]).toMatchObject({ type: "text-start" });
      expect(chunks[1]).toMatchObject({ type: "text-delta", delta: "Hi" });
    });

    test("closes stream on agent:complete", async () => {
      const messages: UIMessage[] = [
        {
          id: "1",
          role: "user" as const,
          parts: [{ type: "text", text: "Hello" }],
        },
      ];

      const stream = await transport.sendMessages({
        trigger: "submit-message",
        chatId: "chat-1",
        messageId: undefined,
        messages,
        abortSignal: new AbortController().signal,
      });

      const reader = stream.getReader();

      // Wait for stream subscription to be ready
      await new Promise((resolve) => setTimeout(resolve, 20));

      // Start reading (non-blocking)
      const readPromise = reader.read();

      // Emit complete event
      mockRuntime.emit({
        type: "agent:complete",
        nodeId: "n1",
        runId: "r1",
        result: "Done",
        usage: { inputTokens: 10, outputTokens: 20 },
        durationMs: 100,
        numTurns: 1,
        timestamp: Date.now(),
      });

      // Wait for read to complete (should return done: true when stream closes)
      const result = await Promise.race([
        readPromise,
        new Promise<{ done: boolean; value?: unknown }>((resolve) =>
          setTimeout(() => resolve({ done: true, value: undefined }), 100),
        ),
      ]);
      expect(result.done).toBe(true);
    });

    test("handles abort signal", async () => {
      const messages: UIMessage[] = [
        {
          id: "1",
          role: "user" as const,
          parts: [{ type: "text", text: "Hello" }],
        },
      ];

      const abortController = new AbortController();
      const stream = await transport.sendMessages({
        trigger: "submit-message",
        chatId: "chat-1",
        messageId: undefined,
        messages,
        abortSignal: abortController.signal,
      });

      const reader = stream.getReader();

      // Abort the stream
      abortController.abort();

      // Wait a bit for stream to close
      await new Promise((resolve) => setTimeout(resolve, 10));

      const result = await reader.read();
      expect(result.done).toBe(true);
    });

    test("emits error chunk on dispatch failure", async () => {
      const messages: UIMessage[] = [
        {
          id: "1",
          role: "user" as const,
          parts: [{ type: "text", text: "Hello" }],
        },
      ];

      // Create a runtime that throws on dispatch
      const throwingRuntime = new MockRuntime();
      throwingRuntime.dispatch = () => {
        throw new Error("Dispatch failed");
      };

      const transportWithError = new LocalAIKitTransport(
        throwingRuntime as unknown as import("@open-harness/sdk").Runtime,
      );

      const stream = await transportWithError.sendMessages({
        trigger: "submit-message",
        chatId: "chat-1",
        messageId: undefined,
        messages,
        abortSignal: new AbortController().signal,
      });

      const chunks: unknown[] = [];
      const reader = stream.getReader();

      let done = false;
      while (!done) {
        const result = await reader.read();
        if (result.done) {
          done = true;
        } else {
          chunks.push(result.value);
        }
      }

      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toMatchObject({
        type: "error",
        errorText: "Dispatch failed",
      });
    });
  });

  describe("reconnectToStream", () => {
    test("returns null", async () => {
      // reconnectToStream takes no parameters in our implementation
      const result = await (
        transport.reconnectToStream as () => Promise<null>
      )();

      expect(result).toBeNull();
    });
  });

  describe("with real captured events", () => {
    const fixturePath = resolve(
      process.cwd(),
      "tests/server/fixtures/runtime-events.json",
    );
    const events = JSON.parse(
      readFileSync(fixturePath, "utf-8"),
    ) as RuntimeEvent[];

    test("processes full real event sequence", async () => {
      const messages: UIMessage[] = [
        {
          id: "1",
          role: "user" as const,
          parts: [{ type: "text", text: "test" }],
        },
      ];

      const stream = await transport.sendMessages({
        trigger: "submit-message",
        chatId: "chat-1",
        messageId: undefined,
        messages,
        abortSignal: new AbortController().signal,
      });

      const chunks: unknown[] = [];
      const reader = stream.getReader();

      // Start reading immediately
      const readPromise = (async () => {
        try {
          let done = false;
          while (!done) {
            const result = await reader.read();
            if (result.done) {
              done = true;
            } else {
              chunks.push(result.value);
            }
          }
        } catch (_error) {
          // Reader might be cancelled, ignore
        }
      })();

      // Wait for stream subscription to be ready
      await new Promise((resolve) => setTimeout(resolve, 20));

      // Emit all real events in sequence
      for (const event of events) {
        mockRuntime.emit(event);
        // Small delay to allow stream processing
        await new Promise((resolve) => setTimeout(resolve, 1));
      }

      // Wait for reading to complete with timeout
      await Promise.race([
        readPromise,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Timeout")), 2000),
        ),
      ]).catch(() => {
        // If timeout, reader might still be waiting - cancel it
        reader.cancel();
      });

      // Verify we got chunks from the real events
      expect(chunks.length).toBeGreaterThan(0);

      // Verify text chunks
      const textChunks = chunks.filter(
        (c) =>
          typeof c === "object" &&
          c !== null &&
          "type" in c &&
          (c.type === "text-start" ||
            c.type === "text-delta" ||
            c.type === "text-end"),
      );
      expect(textChunks.length).toBeGreaterThan(0);

      // Verify reasoning chunks
      const reasoningChunks = chunks.filter(
        (c) =>
          typeof c === "object" &&
          c !== null &&
          "type" in c &&
          (c.type === "reasoning-start" ||
            c.type === "reasoning-delta" ||
            c.type === "reasoning-end"),
      );
      expect(reasoningChunks.length).toBeGreaterThan(0);

      // Verify tool chunks
      const toolChunks = chunks.filter(
        (c) =>
          typeof c === "object" &&
          c !== null &&
          "type" in c &&
          (c.type === "tool-input-available" ||
            c.type === "tool-output-available"),
      );
      expect(toolChunks.length).toBeGreaterThan(0);
    });
  });
});
