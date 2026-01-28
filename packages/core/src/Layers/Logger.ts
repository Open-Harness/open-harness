/**
 * Logger configurations for different environments.
 *
 * Effect has built-in logging — these layers configure how logs are output.
 *
 * @module
 */

import { Layer, Logger, LogLevel } from "effect"

// ─────────────────────────────────────────────────────────────────
// Development Logger
// ─────────────────────────────────────────────────────────────────

/**
 * Development logger - pretty console output with colors.
 *
 * Use this during development for readable logs.
 */
export const DevLoggerLayer = Logger.replace(
  Logger.defaultLogger,
  Logger.prettyLogger({ colors: true })
)

// ─────────────────────────────────────────────────────────────────
// Production Logger
// ─────────────────────────────────────────────────────────────────

/**
 * Production logger - JSON for log aggregation systems.
 *
 * Use this in production for structured logging that can be
 * parsed by log aggregators (DataDog, CloudWatch, etc.).
 */
export const ProdLoggerLayer = Logger.replace(Logger.defaultLogger, Logger.jsonLogger)

// ─────────────────────────────────────────────────────────────────
// Test Logger
// ─────────────────────────────────────────────────────────────────

/**
 * Test logger - no output.
 *
 * Use this in tests to suppress log output.
 * If you need to assert on logs, use Logger.test instead.
 */
export const TestLoggerLayer = Logger.replace(Logger.defaultLogger, Logger.none)

// ─────────────────────────────────────────────────────────────────
// Minimum Level Layers
// ─────────────────────────────────────────────────────────────────

/**
 * Only show warnings and errors.
 */
export const WarnLevelLayer = Logger.minimumLogLevel(LogLevel.Warning)

/**
 * Only show errors.
 */
export const ErrorLevelLayer = Logger.minimumLogLevel(LogLevel.Error)

/**
 * Show all logs including debug.
 */
export const DebugLevelLayer = Logger.minimumLogLevel(LogLevel.Debug)

// ─────────────────────────────────────────────────────────────────
// Composite Layers
// ─────────────────────────────────────────────────────────────────

/**
 * Development setup: pretty logs at debug level.
 */
export const DevLoggingLayer = Layer.merge(DevLoggerLayer, DebugLevelLayer)

/**
 * Production setup: JSON logs at warning level.
 */
export const ProdLoggingLayer = Layer.merge(ProdLoggerLayer, WarnLevelLayer)

/**
 * Test setup: no logs.
 */
export const TestLoggingLayer = TestLoggerLayer
