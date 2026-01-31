/**
 * Task loader - reads task JSON files from a directory.
 *
 * Uses Effect for error handling and async file operations.
 *
 * @module
 */

import { Effect } from "effect"
import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

import { type Task, TaskSchema } from "./schema.js"

/**
 * Load all tasks from a directory.
 *
 * Reads all .json files, parses them, and validates against TaskSchema.
 *
 * @param tasksPath - Directory containing task JSON files
 * @returns Effect that resolves to array of validated tasks
 */
export const loadTasks = (tasksPath: string): Effect.Effect<Array<Task>, Error> =>
  Effect.try({
    try: () => {
      // Read all files in directory
      const files = readdirSync(tasksPath)

      // Filter for .json files
      const jsonFiles = files.filter((f) => f.endsWith(".json"))

      // Load and parse each file
      const tasks: Array<Task> = []

      for (const file of jsonFiles) {
        const filePath = join(tasksPath, file)
        const content = readFileSync(filePath, "utf-8")
        const data = JSON.parse(content) as unknown

        // Validate against schema
        const result = TaskSchema.safeParse(data)

        if (!result.success) {
          throw new Error(`Invalid task in ${file}: ${result.error.message}`)
        }

        tasks.push(result.data)
      }

      return tasks
    },
    catch: (error) => {
      if (error instanceof Error) {
        return error
      }
      return new Error(`Failed to load tasks: ${String(error)}`)
    }
  })
