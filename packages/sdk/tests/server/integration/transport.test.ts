import { beforeEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { UIMessage } from "ai";
import type { RuntimeEvent } from "../../../core/events";
import { LocalAIKitTransport } from "../../../src/server/transports/ai-sdk-local-transport";
import { MockRuntime } from "../helpers/mock-runtime";
