import { cors } from "hono/cors";

export const corsMiddleware = cors({
  // Default: disallow all origins unless user configures this.
  origin: () => null,
  credentials: true,
  allowMethods: ["POST", "GET", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization"],
});
