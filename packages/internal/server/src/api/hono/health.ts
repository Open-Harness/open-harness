/**
 * GET /health endpoint for Hono API.
 *
 * Provides health check for server monitoring.
 */

import { Hono } from "hono";

/**
 * GET /health handler.
 */
export function createHealthRoute() {
  const app = new Hono();

  app.get("/health", (c) => {
    return c.json({
      status: "ok",
      timestamp: new Date().toISOString(),
    });
  });

  return app;
}
