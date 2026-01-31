/**
 * Topological sort for task dependencies.
 *
 * Uses Kahn's algorithm to sort tasks by blockedBy relationships.
 *
 * @module
 */

import { Effect } from "effect"

import type { Task } from "./schema.js"

/**
 * Error when a cycle is detected in task dependencies.
 */
export class CycleDetectedError {
  readonly _tag = "CycleDetectedError"
  constructor(readonly taskIds: Array<string>) {}
}

/**
 * Topologically sort tasks based on blockedBy dependencies.
 *
 * Uses Kahn's algorithm:
 * 1. Calculate in-degree (number of blockedBy) for each task
 * 2. Build reverse map: which tasks does each task block?
 * 3. Start with tasks that have no dependencies (in-degree = 0)
 * 4. Process each task, decrementing in-degree of tasks it blocks
 * 5. Add newly unblocked tasks to the queue
 *
 * @param tasks - Array of tasks to sort
 * @returns Effect with tasks sorted in execution order, or CycleDetectedError
 */
export const topologicalSort = (
  tasks: Array<Task>
): Effect.Effect<Array<Task>, CycleDetectedError> =>
  Effect.gen(function*() {
    // Build lookup map
    const taskMap = new Map<string, Task>()
    for (const task of tasks) {
      taskMap.set(task.id, task)
    }

    // Calculate in-degree (number of unprocessed blockedBy) for each task
    // AND build the reverse relationship: blocksMap[A] = tasks that A blocks
    const inDegree = new Map<string, number>()
    const blocksMap = new Map<string, Array<string>>()

    // Initialize
    for (const task of tasks) {
      inDegree.set(task.id, 0)
      blocksMap.set(task.id, [])
    }

    // Build relationships from blockedBy
    for (const task of tasks) {
      // Count valid blockedBy (ones that exist in our task set)
      let validCount = 0
      for (const blockerId of task.blockedBy) {
        if (taskMap.has(blockerId)) {
          validCount++
          // blockerId blocks this task
          const blockedList = blocksMap.get(blockerId)
          if (blockedList) {
            blockedList.push(task.id)
          }
        }
      }
      inDegree.set(task.id, validCount)
    }

    // Initialize queue with tasks that have no dependencies
    const queue: Array<Task> = []
    for (const task of tasks) {
      if (inDegree.get(task.id) === 0) {
        queue.push(task)
      }
    }

    // Process queue
    const sorted: Array<Task> = []

    while (queue.length > 0) {
      const task = queue.shift()!
      sorted.push(task)

      // For each task this one blocks (derived from blockedBy), decrement their in-degree
      const blockedIds = blocksMap.get(task.id) ?? []
      for (const blockedId of blockedIds) {
        const current = inDegree.get(blockedId)
        if (current !== undefined) {
          const newDegree = current - 1
          inDegree.set(blockedId, newDegree)

          // If in-degree becomes 0, add to queue
          if (newDegree === 0) {
            const blockedTask = taskMap.get(blockedId)
            if (blockedTask) {
              queue.push(blockedTask)
            }
          }
        }
      }
    }

    // Check for cycles
    if (sorted.length !== tasks.length) {
      const remaining = tasks.filter((t) => !sorted.includes(t)).map((t) => t.id)
      return yield* Effect.fail(new CycleDetectedError(remaining))
    }

    return sorted
  })
