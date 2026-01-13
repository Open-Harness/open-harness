import type { Level } from "pino";

/**
 * Logger configuration options.
 *
 * Defaults (v3.1 - batteries included):
 * - Console logging: ON (see what's happening immediately)
 * - File logging: OFF (opt-in for persistence)
 * - Level: "info"
 * - Log directory: ".open-harness/logs"
 */
export interface LoggerConfig {
	/**
	 * Minimum log level to emit.
	 * @default "info"
	 */
	level: Level;

	/**
	 * Enable file logging (JSONL format).
	 * @default false
	 */
	file: boolean;

	/**
	 * Directory for log files.
	 * @default ".open-harness/logs"
	 */
	logDir: string;

	/**
	 * Log file name (without path).
	 * @default "harness.log"
	 */
	fileName: string;

	/**
	 * Maximum file size before rotation (bytes).
	 * @default 10485760 (10MB)
	 */
	maxFileSize: number;

	/**
	 * Number of rotated files to keep.
	 * @default 5
	 */
	maxFiles: number;

	/**
	 * Enable pretty console output.
	 * @default true
	 */
	console: boolean;

	/**
	 * Completely disable all logging.
	 * @default false
	 */
	disabled: boolean;
}

/**
 * Default logger configuration.
 *
 * v3.1 "Batteries included" defaults:
 * - Console logging ON (see what's happening immediately)
 * - File logging OFF (opt-in for persistence)
 * - 10MB rotation, keep 5 files (50MB max when enabled)
 */
export const DEFAULT_CONFIG: LoggerConfig = {
	level: "info",
	file: false,
	logDir: ".open-harness/logs",
	fileName: "harness.log",
	maxFileSize: 10 * 1024 * 1024, // 10MB
	maxFiles: 5,
	console: true,
	disabled: false,
};

/**
 * Load configuration from environment variables.
 *
 * Environment variables:
 * - LOG_LEVEL: "trace" | "debug" | "info" | "warn" | "error" | "fatal"
 * - LOG_FILE: "true" | "false" (default: false)
 * - LOG_DIR: Custom log directory path
 * - LOG_CONSOLE: "true" | "false" (default: true)
 * - LOG_DISABLED: "true" | "false" (default: false)
 */
export function loadConfigFromEnv(
	env: Record<string, string | undefined> = process.env,
): Partial<LoggerConfig> {
	const config: Partial<LoggerConfig> = {};

	if (env.LOG_LEVEL) {
		const level = env.LOG_LEVEL.toLowerCase() as Level;
		if (isValidLevel(level)) {
			config.level = level;
		}
	}

	if (env.LOG_FILE !== undefined) {
		config.file = env.LOG_FILE.toLowerCase() === "true";
	}

	if (env.LOG_DIR) {
		config.logDir = env.LOG_DIR;
	}

	if (env.LOG_CONSOLE !== undefined) {
		config.console = env.LOG_CONSOLE.toLowerCase() === "true";
	}

	if (env.LOG_DISABLED !== undefined) {
		config.disabled = env.LOG_DISABLED.toLowerCase() === "true";
	}

	return config;
}

/**
 * Merge partial config with defaults.
 */
export function resolveConfig(
	partial: Partial<LoggerConfig> = {},
): LoggerConfig {
	return { ...DEFAULT_CONFIG, ...partial };
}

const VALID_LEVELS = new Set([
	"trace",
	"debug",
	"info",
	"warn",
	"error",
	"fatal",
]);

function isValidLevel(level: string): level is Level {
	return VALID_LEVELS.has(level);
}
