/**
 * Reference Implementation: ElevenLabs Voice Channel
 *
 * This file shows the minimal implementation of a bidirectional voice channel
 * using ElevenLabs Conversational AI. It demonstrates:
 *
 * 1. WebSocket connection management
 * 2. Bidirectional event handling (output + input)
 * 3. Voice command parsing
 * 4. Integration with harness control flow
 *
 * Location: packages/elevenlabs/src/channel.ts (future)
 */

import { defineChannel } from "@openharness/sdk";
import type { IUnifiedEventBus, HarnessControl } from "@openharness/sdk";
import { Conversation } from "@11labs/client";

// ============================================================================
// TYPES
// ============================================================================

export interface ElevenLabsConfig {
  /** ElevenLabs agent ID (for public agents) */
  agentId?: string;

  /** Pre-signed URL (for private agents via WebSocket) */
  signedUrl?: string;

  /** Conversation token (for private agents via WebRTC) */
  conversationToken?: string;

  /** Enable auto-reconnect on failures (default: true) */
  autoReconnect?: boolean;

  /** Max reconnection attempts (default: 3) */
  maxReconnectAttempts?: number;

  /** Logging verbosity (default: "normal") */
  verbosity?: "silent" | "normal" | "debug";

  /** Custom voice command patterns */
  customCommands?: Record<string, (control: HarnessControl) => void>;
}

interface ChannelState {
  conversation: Conversation | null;
  transcript: Array<{ speaker: "user" | "agent"; text: string; timestamp: Date }>;
  isConnected: boolean;
}

interface ParsedCommand {
  intent: "pause" | "resume" | "status" | "abort" | "response" | "unknown";
  confidence: number;
  originalText: string;
  entities?: Record<string, string>;
}

// ============================================================================
// VOICE COMMAND PARSER
// ============================================================================

function parseVoiceCommand(text: string): ParsedCommand {
  const normalized = text.toLowerCase().trim();

  // Pattern matching with confidence scoring
  if (/\b(pause|hold on|wait|stop for a moment)\b/.test(normalized)) {
    return { intent: "pause", confidence: 0.9, originalText: text };
  }

  if (/\b(resume|continue|go ahead|proceed|keep going)\b/.test(normalized)) {
    return { intent: "resume", confidence: 0.9, originalText: text };
  }

  if (/\b(status|where are we|what's happening|update|progress)\b/.test(normalized)) {
    return { intent: "status", confidence: 0.85, originalText: text };
  }

  if (/\b(abort|cancel|stop everything|quit)\b/.test(normalized)) {
    return { intent: "abort", confidence: 0.95, originalText: text };
  }

  // Check for yes/no responses (for prompts)
  if (/\b(yes|yeah|yep|sure|okay|ok|affirmative)\b/.test(normalized)) {
    return {
      intent: "response",
      confidence: 0.8,
      originalText: text,
      entities: { value: "yes" },
    };
  }

  if (/\b(no|nope|nah|negative)\b/.test(normalized)) {
    return {
      intent: "response",
      confidence: 0.8,
      originalText: text,
      entities: { value: "no" },
    };
  }

  return { intent: "unknown", confidence: 0, originalText: text };
}

// ============================================================================
// CONNECTION WRAPPER (Simplified)
// ============================================================================

/**
 * Wrapper around ElevenLabs SDK for cleaner API.
 * Handles connection, reconnection, and event forwarding.
 */
class ElevenLabsConnection {
  private conversation: Conversation | null = null;
  private config: ElevenLabsConfig;
  private eventHandlers = new Map<string, Set<(data: any) => void>>();

  constructor(config: ElevenLabsConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    const maxAttempts = this.config.maxReconnectAttempts ?? 3;
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        this.conversation = await Conversation.startSession({
          agentId: this.config.agentId,
          signedUrl: this.config.signedUrl,
          conversationToken: this.config.conversationToken,
        });

        // Forward SDK events to our handlers
        this.conversation.on("user_transcript", (text: string) => {
          this.emit("user_transcript", text);
        });

        this.conversation.on("agent_response", (response: any) => {
          this.emit("agent_response", response);
        });

        this.conversation.on("thinking", () => {
          this.emit("thinking", null);
        });

        this.conversation.on("disconnect", (reason: string) => {
          this.emit("disconnect", reason);
        });

        this.log("normal", "✅ Connected to ElevenLabs");
        return; // Success!
      } catch (error: any) {
        lastError = error;

        // Don't retry auth errors (401, 404)
        if (error.status === 401 || error.status === 404) {
          throw new Error(
            `ElevenLabs authentication failed: ${error.message}\n` +
              `Check your agent ID and API key.`
          );
        }

        // Retry with exponential backoff
        if (attempt < maxAttempts) {
          const delay = 2 ** (attempt - 1) * 1000;
          this.log("normal", `⚠️  Connection failed, retrying in ${delay}ms...`);
          await this.sleep(delay);
        }
      }
    }

    throw new Error(
      `Failed to connect to ElevenLabs after ${maxAttempts} attempts: ${lastError?.message}`
    );
  }

  speak(text: string): void {
    if (!this.conversation) {
      this.log("normal", "⚠️  Cannot speak: not connected");
      return;
    }
    this.conversation.speak(text);
    this.log("debug", `🔊 Speaking: ${text}`);
  }

  on(event: string, handler: (data: any) => void): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
  }

  disconnect(): void {
    if (this.conversation) {
      this.conversation.endSession();
      this.conversation = null;
      this.log("normal", "🔌 Disconnected from ElevenLabs");
    }
  }

  private emit(event: string, data: any): void {
    this.eventHandlers.get(event)?.forEach((handler) => {
      try {
        handler(data);
      } catch (error) {
        this.log("normal", `⚠️  Error in ${event} handler: ${error}`);
      }
    });
  }

  private log(level: "silent" | "normal" | "debug", message: string): void {
    const verbosity = this.config.verbosity ?? "normal";
    if (verbosity === "silent") return;
    if (level === "debug" && verbosity !== "debug") return;
    console.log(message);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ============================================================================
// ELEVENLABS CHANNEL
// ============================================================================

/**
 * ElevenLabs Voice Channel
 *
 * Provides bidirectional voice interface to harness workflows:
 * - OUTPUT: Narrates harness events (phases, tasks, narratives) via voice
 * - INPUT: Accepts voice commands (pause, resume, status, abort) from user
 *
 * @example
 * ```typescript
 * import { ElevenLabsChannel } from "@openharness/elevenlabs";
 *
 * const result = await MyWorkflow
 *   .create({ input })
 *   .attach(ConsoleChannel)
 *   .attach(ElevenLabsChannel({
 *     agentId: process.env.ELEVENLABS_AGENT_ID!,
 *   }))
 *   .startSession()  // Enable voice commands
 *   .complete();
 * ```
 */
export const ElevenLabsChannel = (config: ElevenLabsConfig) =>
  defineChannel<ChannelState>({
    name: "ElevenLabsVoice",

    // ========================================================================
    // STATE INITIALIZATION
    // ========================================================================

    state: () => ({
      conversation: null,
      transcript: [],
      isConnected: false,
    }),

    // ========================================================================
    // LIFECYCLE: START
    // ========================================================================

    onStart: async ({ state, bus, control, output }) => {
      output.line("🎤 Connecting to ElevenLabs...");

      try {
        // Connect to ElevenLabs
        const connection = new ElevenLabsConnection(config);
        await connection.connect();
        state.conversation = connection as any; // Type cast for demo
        state.isConnected = true;

        output.success("✅ Voice interface ready");
        connection.speak("Hello! I'm monitoring the workflow. Ask me anything!");

        // ====================================================================
        // INBOUND: User Voice → Harness Commands
        // ====================================================================

        connection.on("user_transcript", (text: string) => {
          // Log to transcript
          state.transcript.push({
            speaker: "user",
            text,
            timestamp: new Date(),
          });

          output.line(`🗣️  User: ${text}`);

          // Parse voice command
          const command = parseVoiceCommand(text);

          // Handle based on intent
          switch (command.intent) {
            case "pause":
              if (command.confidence >= 0.7) {
                control.pause();
                connection.speak("Pausing workflow");
              }
              break;

            case "resume":
              if (command.confidence >= 0.7) {
                control.resume();
                connection.speak("Resuming workflow");
              }
              break;

            case "status":
              if (command.confidence >= 0.7) {
                const phase = control.getCurrentPhase();
                const task = control.getCurrentTask();
                const statusMsg = phase
                  ? `Currently in phase ${phase}${task ? `, working on task ${task}` : ""}`
                  : "Workflow is idle";
                connection.speak(statusMsg);
              }
              break;

            case "abort":
              if (command.confidence >= 0.7) {
                control.abort("User voice command");
                connection.speak("Aborting workflow");
              }
              break;

            case "response":
              // User is responding to a prompt
              // This would be handled by session:prompt listener
              bus.emit({
                type: "session:reply",
                text: command.entities?.value ?? text,
              });
              break;

            case "unknown":
              if (config.verbosity !== "silent") {
                connection.speak("I didn't understand that. Try 'pause', 'resume', or 'status'.");
              }
              break;
          }

          // Custom commands (if provided)
          if (config.customCommands) {
            for (const [pattern, handler] of Object.entries(config.customCommands)) {
              if (new RegExp(pattern, "i").test(text)) {
                handler(control);
              }
            }
          }
        });

        // ====================================================================
        // OUTBOUND: Harness Prompts → Voice Questions
        // ====================================================================

        bus.subscribe("session:prompt", (event: any) => {
          const prompt = event.event.prompt ?? event.event.question;
          connection.speak(prompt);
          output.line(`❓ Prompting user: ${prompt}`);
        });

        // Track agent responses
        connection.on("agent_response", (response: any) => {
          state.transcript.push({
            speaker: "agent",
            text: response.text ?? response,
            timestamp: new Date(),
          });
        });
      } catch (error: any) {
        output.fail(`❌ Failed to connect: ${error.message}`);
        throw error;
      }
    },

    // ========================================================================
    // EVENT HANDLERS: Harness → Voice Narration
    // ========================================================================

    on: {
      // Phase lifecycle
      "phase:start": ({ event, state }) => {
        const phaseName = event.event.name;
        (state.conversation as any)?.speak(`Starting phase: ${phaseName}`);
      },

      "phase:complete": ({ event, state }) => {
        const phaseName = event.event.name;
        (state.conversation as any)?.speak(`Completed ${phaseName}`);
      },

      // Task lifecycle
      "task:start": ({ event, state }) => {
        const taskId = event.event.id;
        (state.conversation as any)?.speak(`Working on task ${taskId}`);
      },

      "task:complete": ({ event, state }) => {
        const taskId = event.event.id;
        (state.conversation as any)?.speak(`Task ${taskId} is done`);
      },

      "task:failed": ({ event, state }) => {
        const taskId = event.event.id;
        (state.conversation as any)?.speak(`Task ${taskId} failed`);
      },

      // Agent narratives (internal monologue)
      narrative: ({ event, state }) => {
        const text = event.event.text;
        if (text && config.verbosity !== "silent") {
          (state.conversation as any)?.speak(text);
        }
      },

      // Agent thinking
      "agent:thinking": ({ event, state }) => {
        if (config.verbosity === "debug") {
          (state.conversation as any)?.speak("Thinking...");
        }
      },

      // Harness paused/resumed
      "harness:paused": ({ state }) => {
        (state.conversation as any)?.speak("Workflow paused");
      },

      "harness:resumed": ({ state }) => {
        (state.conversation as any)?.speak("Workflow resumed");
      },
    },

    // ========================================================================
    // LIFECYCLE: COMPLETE
    // ========================================================================

    onComplete: ({ state, output }) => {
      if (state.isConnected && state.conversation) {
        (state.conversation as any).speak("Workflow complete!");
        (state.conversation as any).disconnect();
      }

      output.success("🎤 Voice interface disconnected");

      // Optionally save transcript
      if (config.verbosity === "debug") {
        output.line("\n📝 Conversation Transcript:");
        for (const entry of state.transcript) {
          output.line(
            `  [${entry.timestamp.toISOString()}] ${entry.speaker}: ${entry.text}`
          );
        }
      }
    },
  });

// ============================================================================
// EXPORTS
// ============================================================================

export type { ElevenLabsConfig, ChannelState, ParsedCommand };
