/**
 * Workflow YAML Schema
 *
 * Defines the structure for workflow configuration files.
 * Designed to be extensible for different workflow types.
 */

import { z } from "zod";

// ============================================
// Permission Modes
// ============================================

export const PermissionModeSchema = z.enum(["default", "acceptEdits", "bypassPermissions"]);
export type PermissionMode = z.infer<typeof PermissionModeSchema>;

export const PermissionsSchema = z.object({
	mode: PermissionModeSchema.default("bypassPermissions"),
	allowDangerous: z.boolean().default(true),
});

export type Permissions = z.infer<typeof PermissionsSchema>;

// ============================================
// Model Configuration
// ============================================

export const ModelNameSchema = z.enum(["sonnet", "haiku", "opus"]);
export type ModelName = z.infer<typeof ModelNameSchema>;

// ============================================
// Agent Configuration
// ============================================

export const AgentConfigSchema = z.object({
	model: ModelNameSchema.default("sonnet"),
	prompt: z.string().optional(), // Path to prompt file
	permissions: PermissionsSchema.optional(),
});

export type AgentConfig = z.infer<typeof AgentConfigSchema>;

export const NarratorConfigSchema = z.object({
	enabled: z.boolean().default(true),
	bufferSize: z.number().default(15),
});

export type NarratorConfig = z.infer<typeof NarratorConfigSchema>;

export const AgentsConfigSchema = z.object({
	initializer: AgentConfigSchema.optional(),
	builder: AgentConfigSchema.optional(),
	narrator: NarratorConfigSchema.optional(),
});

export type AgentsConfig = z.infer<typeof AgentsConfigSchema>;

// ============================================
// Data Source Configuration
// ============================================

export const DataSourceTypeSchema = z.enum(["json-file"]);
export type DataSourceType = z.infer<typeof DataSourceTypeSchema>;

export const DataSourceSchema = z.object({
	name: z.string(),
	type: DataSourceTypeSchema,
	path: z.string(),
	schema: z.string().optional(), // Schema identifier for validation
});

export type DataSourceConfig = z.infer<typeof DataSourceSchema>;

// ============================================
// Execution Strategy
// ============================================

export const ExecutionStrategySchema = z.enum(["sequential", "priority"]);
export type ExecutionStrategy = z.infer<typeof ExecutionStrategySchema>;

export const ExecutionConfigSchema = z.object({
	workOn: z.string(), // Reference to data source name
	strategy: ExecutionStrategySchema.default("sequential"),
});

export type ExecutionConfig = z.infer<typeof ExecutionConfigSchema>;

// ============================================
// Workflow Type
// ============================================

export const WorkflowTypeSchema = z.enum(["autonomous-coding"]);
export type WorkflowType = z.infer<typeof WorkflowTypeSchema>;

// ============================================
// Workflow Core Configuration
// ============================================

export const WorkflowCoreSchema = z.object({
	name: z.string(),
	type: WorkflowTypeSchema.default("autonomous-coding"),
	projectDir: z.string(),
	maxIterations: z.number().optional(),
	autoContinueDelay: z.number().default(3000), // ms
});

export type WorkflowCore = z.infer<typeof WorkflowCoreSchema>;

// ============================================
// Complete Workflow Configuration
// ============================================

export const WorkflowConfigSchema = z.object({
	workflow: WorkflowCoreSchema,
	dataSources: z.array(DataSourceSchema).optional(),
	agents: AgentsConfigSchema.optional(),
	execution: ExecutionConfigSchema.optional(),
});

export type WorkflowConfig = z.infer<typeof WorkflowConfigSchema>;

// ============================================
// Default Configuration
// ============================================

export const DEFAULT_WORKFLOW_CONFIG: Partial<WorkflowConfig> = {
	workflow: {
		name: "autonomous-coding",
		type: "autonomous-coding",
		projectDir: "./project",
		autoContinueDelay: 3000,
	},
	agents: {
		initializer: {
			model: "sonnet",
			permissions: {
				mode: "bypassPermissions",
				allowDangerous: true,
			},
		},
		builder: {
			model: "haiku",
			permissions: {
				mode: "bypassPermissions",
				allowDangerous: true,
			},
		},
		narrator: {
			enabled: true,
			bufferSize: 15,
		},
	},
	execution: {
		workOn: "features",
		strategy: "sequential",
	},
};
