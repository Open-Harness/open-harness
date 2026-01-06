/**
 * Open Harness SDK - API Routes
 *
 * Hono route creators for building HTTP endpoints.
 */

import { Hono } from "hono";
import type { Runtime } from "@internal/runtime";

import { createChatRoute } from "./chat.js";
import { createCommandsRoute } from "./commands.js";
import { createEventsRoute } from "./events.js";
import { createHealthRoute } from "./health.js";

export type { EventsRouteOptions } from "./events.js";
export {
  createChatRoute,
  createCommandsRoute,
  createEventsRoute,
  createHealthRoute,
};

export function createAPIRoutes(runtime: Runtime) {
  const app = new Hono();

  app.route("/", createChatRoute(runtime));
  app.route("/", createEventsRoute(runtime));
  app.route("/", createCommandsRoute(runtime));
  app.route("/", createHealthRoute());

  return app;
}
