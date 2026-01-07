/**
 * Open Harness SDK - API Routes
 *
 * Hono route creators for building HTTP endpoints.
 */

import { Hono } from "hono";
import type { Runtime } from "@internal/core";

import { createChatRoute } from "./chat";
import { createCommandsRoute } from "./commands";
import { createEventsRoute } from "./events";
import { createHealthRoute } from "./health";

export type { EventsRouteOptions } from "./events";
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
