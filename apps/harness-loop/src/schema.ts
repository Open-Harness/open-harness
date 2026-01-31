/**
 * Task schema for Claude Code task lists.
 *
 * Validates task JSON files loaded from disk.
 *
 * @module
 */

import { z } from "zod"

/**
 * Task status enum matching Claude Code's task system.
 */
export const TaskStatusSchema = z.enum(["pending", "in_progress", "completed", "deleted"])

export type TaskStatus = z.infer<typeof TaskStatusSchema>

/**
 * Task schema for individual task JSON files.
 *
 * Each task has:
 * - id: Unique identifier
 * - subject: Short imperative title
 * - description: Detailed task description
 * - activeForm: Present continuous form for spinner display
 * - status: Current task status
 * - blocks: Tasks this task blocks (can't start until this completes)
 * - blockedBy: Tasks that must complete before this can start
 */
export const TaskSchema = z.object({
  id: z.string(),
  subject: z.string(),
  description: z.string(),
  activeForm: z.string().optional(),
  status: TaskStatusSchema,
  blocks: z.array(z.string()),
  blockedBy: z.array(z.string())
})

export type Task = z.infer<typeof TaskSchema>
