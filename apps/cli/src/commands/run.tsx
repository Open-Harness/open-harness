/**
 * Run command - executes a workflow with TUI or headless mode
 *
 * @module
 */

import type { WorkflowDef } from "@open-scaffold/core"
import { AnthropicProvider, OpenScaffold } from "@open-scaffold/server"
import { resolve } from "path"

import { loadWorkflow } from "../loader.js"

export interface RunOptions {
  input: string
  database: string
  record: boolean
  headless?: boolean
}

export async function runCommand(
  workflowPath: string,
  options: RunOptions
): Promise<void> {
  try {
    // Resolve workflow path
    const absolutePath = resolve(workflowPath)

    // Load workflow definition
    const workflow = await loadWorkflow(absolutePath)

    // Create scaffold instance
    const scaffold = OpenScaffold.create({
      database: `file:${resolve(options.database)}`,
      mode: "live",
      providers: {
        "claude-sonnet-4-5": AnthropicProvider({ model: "claude-sonnet-4-5" }),
        "claude-haiku-4-5": AnthropicProvider({ model: "claude-haiku-4-5" }),
        "claude-opus-4-5": AnthropicProvider({ model: "claude-opus-4-5" }),
      }
    })

    // Create server for the workflow (loadWorkflow returns unknown; cast to WorkflowDef)
    const server = scaffold.createServer({
      workflow: workflow as WorkflowDef<unknown, string, string>,
      port: 0 // Ephemeral port
    })

    await server.start()
    const addr = await server.address()

    // Create session
    const { sessionId } = await fetch(`http://127.0.0.1:${addr.port}/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input: options.input })
    }).then((r) => r.json() as Promise<{ sessionId: string }>)

    if (options.headless) {
      // Headless mode: stream events as JSON lines
      await runHeadless(addr.port, sessionId)
    } else {
      // TUI mode: dynamically import to avoid loading OpenTUI in headless mode
      const { runTui } = await import("./run-tui.js")
      await runTui(addr.port, sessionId, workflow as { name: string })
    }

    // Cleanup
    await server.stop()
    await scaffold.dispose()
  } catch (err) {
    console.error("Error:", (err as Error).message)
    process.exit(1)
  }
}

async function runHeadless(port: number, sessionId: string): Promise<void> {
  const url = `http://127.0.0.1:${port}/sessions/${sessionId}/events`

  const response = await fetch(url)
  const reader = response.body?.getReader()
  if (!reader) throw new Error("No response body")

  const decoder = new TextDecoder()

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    const text = decoder.decode(value, { stream: true })
    const lines = text.split("\n")

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const data = line.slice(6)
        if (data === "[DONE]") return
        console.log(data)
      }
    }
  }
}
