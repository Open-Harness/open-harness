// Structured logging for Horizon Agent
// Uses pino with file transport for observability

import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import pino from "pino";

const LOG_DIR = resolve(import.meta.dir, "../logs");
const LOG_FILE = resolve(LOG_DIR, "horizon.log");

// Ensure log directory exists
try {
	mkdirSync(LOG_DIR, { recursive: true });
} catch {
	// Directory might already exist
}

// Create logger with file transport
export const logger = pino(
	{
		level: process.env.LOG_LEVEL ?? "debug",
		formatters: {
			level: (label) => ({ level: label }),
		},
		timestamp: pino.stdTimeFunctions.isoTime,
	},
	pino.destination({
		dest: LOG_FILE,
		sync: false, // Async writes for performance
	}),
);

// Child loggers for different components
export const flowLogger = logger.child({ component: "flow" });
export const nodeLogger = logger.child({ component: "node" });
export const claudeLogger = logger.child({ component: "claude" });
export const hubLogger = logger.child({ component: "hub" });

// Export log file path for tailing
export const logFilePath = LOG_FILE;

// Flush logs (useful before exit)
export function flushLogs(): Promise<void> {
	return new Promise((resolve) => {
		logger.flush();
		setTimeout(resolve, 100);
	});
}
