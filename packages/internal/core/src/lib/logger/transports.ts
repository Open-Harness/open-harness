import { existsSync, mkdirSync, statSync, renameSync } from "node:fs";
import { join } from "node:path";
import pino, { type DestinationStream, type Logger } from "pino";
import type { LoggerConfig } from "./config.js";

/**
 * Creates the appropriate transport streams based on configuration.
 *
 * - File logging: JSONL format for querying with jq
 * - Console logging: Pretty formatted output (opt-in)
 */
export function createTransports(config: LoggerConfig): DestinationStream {
	const streams: pino.StreamEntry[] = [];

	// File transport (default: ON)
	if (config.file) {
		const filePath = join(config.logDir, config.fileName);
		ensureLogDirectory(config.logDir);
		maybeRotateLog(filePath, config.maxFileSize, config.maxFiles);

		streams.push({
			level: config.level,
			stream: pino.destination({
				dest: filePath,
				sync: false, // Async for performance
			}),
		});
	}

	// Console transport (default: OFF, opt-in)
	if (config.console) {
		// Use pino-pretty for human-readable output
		// Dynamic import to avoid loading if not needed
		streams.push({
			level: config.level,
			stream: createPrettyStream(),
		});
	}

	// If no streams configured, use a no-op stream
	if (streams.length === 0) {
		return createNoopStream();
	}

	// Single stream optimization
	if (streams.length === 1 && streams[0]) {
		return streams[0].stream;
	}

	// Multiple streams
	return pino.multistream(streams);
}

/**
 * Create a pretty-printed console stream.
 */
function createPrettyStream(): DestinationStream {
	// pino-pretty is a transform stream
	const pretty = require("pino-pretty");
	return pretty({
		colorize: true,
		translateTime: "SYS:HH:MM:ss.l",
		ignore: "pid,hostname",
		messageFormat: "{type} {msg}",
	});
}

/**
 * Create a no-op stream that discards all output.
 */
function createNoopStream(): DestinationStream {
	return {
		write: () => true,
	} as DestinationStream;
}

/**
 * Ensure the log directory exists.
 */
function ensureLogDirectory(logDir: string): void {
	if (!existsSync(logDir)) {
		mkdirSync(logDir, { recursive: true });
	}
}

/**
 * Simple size-based log rotation.
 *
 * Rotates logs when current file exceeds maxFileSize:
 * - harness.log → harness.log.1
 * - harness.log.1 → harness.log.2
 * - etc.
 *
 * Note: This runs at startup only. For production use cases with
 * continuous rotation, consider using logrotate or pino-roll.
 */
function maybeRotateLog(
	filePath: string,
	maxFileSize: number,
	maxFiles: number,
): void {
	if (!existsSync(filePath)) {
		return;
	}

	try {
		const stats = statSync(filePath);
		if (stats.size < maxFileSize) {
			return;
		}

		// Rotate existing files
		for (let i = maxFiles - 1; i >= 1; i--) {
			const oldPath = i === 1 ? filePath : `${filePath}.${i - 1}`;
			const newPath = `${filePath}.${i}`;
			if (existsSync(oldPath)) {
				renameSync(oldPath, newPath);
			}
		}

		// The current file has been renamed to .1, so a new file will be created
	} catch {
		// Ignore rotation errors - logging should not crash the app
	}
}

/**
 * Get the current log file path from config.
 * Useful for agents that need to read logs.
 */
export function getLogFilePath(config: LoggerConfig): string {
	return join(config.logDir, config.fileName);
}

/**
 * List all log files (current + rotated).
 */
export function listLogFiles(config: LoggerConfig): string[] {
	const basePath = join(config.logDir, config.fileName);
	const files: string[] = [];

	if (existsSync(basePath)) {
		files.push(basePath);
	}

	for (let i = 1; i <= config.maxFiles; i++) {
		const rotatedPath = `${basePath}.${i}`;
		if (existsSync(rotatedPath)) {
			files.push(rotatedPath);
		}
	}

	return files;
}
