/**
 * Task loader - reads task JSON files from a directory.
 *
 * Uses Effect for error handling and file operations.
 *
 * @module
 */

import { Effect, pipe } from "effect"
import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

import { type Task, TaskSchema } from "./schema.js"

/**
 * Error reading task directory.
 */
export class TaskDirectoryError {
  readonly _tag = "TaskDirectoryError"
  constructor(
    readonly path: string,
    readonly cause: unknown
  ) {}
}

/**
 * Error parsing task file.
 */
export class TaskParseError {
  readonly _tag = "TaskParseError"
  constructor(
    readonly file: string,
    readonly cause: string
  ) {}
}

/**
 * Union of all loader errors.
 */
export type LoaderError = TaskDirectoryError | TaskParseError

/**
 * Read directory contents.
 */
const readDirectory = (path: string) =>
  Effect.try({
    try: () => readdirSync(path),
    catch: (e) => new TaskDirectoryError(path, e)
  })

/**
 * Read and parse a single task file.
 */
const readTaskFile = (tasksPath: string, file: string): Effect.Effect<Task, TaskParseError> =>
  pipe(
    Effect.try({
      try: () => {
        const filePath = join(tasksPath, file)
        const content = readFileSync(filePath, "utf-8")
        return JSON.parse(content) as unknown
      },
      catch: (e) => new TaskParseError(file, String(e))
    }),
    Effect.flatMap((data) => {
      const result = TaskSchema.safeParse(data)
      if (!result.success) {
        return Effect.fail(new TaskParseError(file, result.error.message))
      }
      return Effect.succeed(result.data)
    })
  )

/**
 * Load all tasks from a directory.
 *
 * Reads all .json files, parses them, and validates against TaskSchema.
 *
 * @param tasksPath - Directory containing task JSON files
 * @returns Effect that resolves to array of validated tasks
 */
export const loadTasks = (tasksPath: string): Effect.Effect<Array<Task>, LoaderError> =>
  pipe(
    readDirectory(tasksPath),
    Effect.map((files) => files.filter((f) => f.endsWith(".json"))),
    Effect.flatMap((jsonFiles) =>
      Effect.all(
        jsonFiles.map((file) => readTaskFile(tasksPath, file)),
        { concurrency: "unbounded" }
      )
    )
  )
