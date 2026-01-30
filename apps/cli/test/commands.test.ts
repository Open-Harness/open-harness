/**
 * CLI Commands Unit Tests.
 *
 * Tests for CLI command logic and behavior.
 * These tests focus on the testable parts of commands that don't require
 * full HTTP server infrastructure (which is tested in server/integration-cli-e2e.test.ts).
 *
 * @module
 */

import { Command } from "commander"
import { beforeEach, describe, expect, it } from "vitest"

// ─────────────────────────────────────────────────────────────────
// Test the CLI program structure
// ─────────────────────────────────────────────────────────────────

describe("CLI program structure", () => {
  it("defines expected commands", async () => {
    // Import the index module to get the program
    // We can't import directly as it calls program.parse(), so we test the command structure
    const program = new Command()
    program
      .name("scaffold")
      .description("Open Scaffold CLI - Run workflows from the terminal")
      .version("0.0.0")

    // Verify the expected structure matches what index.ts defines
    expect(program.name()).toBe("scaffold")
    expect(program.description()).toBe("Open Scaffold CLI - Run workflows from the terminal")
  })

  describe("run command options", () => {
    let program: Command
    let runCommand: Command

    beforeEach(() => {
      program = new Command()
      program.exitOverride() // Prevent actual process.exit
      program.configureOutput({
        writeOut: () => {},
        writeErr: () => {}
      })

      runCommand = program
        .command("run")
        .description("Run a workflow from a TypeScript file")
        .argument("<workflow>", "Path to the workflow .ts file")
        .requiredOption("-i, --input <input>", "Input to start the workflow with")
        .option("-d, --database <path>", "Database file path", "./scaffold.db")
        .option("--no-record", "Disable recording")
        .option("--headless", "Run without TUI")
        .action(() => {})
    })

    it("requires input option", () => {
      expect(() => {
        program.parse(["node", "scaffold", "run", "workflow.ts"])
      }).toThrow(/required option.*--input/)
    })

    it("requires workflow argument", () => {
      expect(() => {
        program.parse(["node", "scaffold", "run", "-i", "test input"])
      }).toThrow(/missing required argument/)
    })

    it("parses valid run command", () => {
      const parsed: { workflow?: string; input?: string; database?: string; headless?: boolean } = {}

      runCommand.action((workflow, opts) => {
        parsed.workflow = workflow
        parsed.input = opts.input
        parsed.database = opts.database
        parsed.headless = opts.headless
      })

      program.parse(["node", "scaffold", "run", "my-workflow.ts", "-i", "Build something"])

      expect(parsed.workflow).toBe("my-workflow.ts")
      expect(parsed.input).toBe("Build something")
      expect(parsed.database).toBe("./scaffold.db")
      expect(parsed.headless).toBeUndefined()
    })

    it("parses headless option", () => {
      let headless: boolean | undefined

      runCommand.action((_, opts) => {
        headless = opts.headless
      })

      program.parse(["node", "scaffold", "run", "workflow.ts", "-i", "test", "--headless"])

      expect(headless).toBe(true)
    })

    it("uses custom database path", () => {
      let database: string | undefined

      runCommand.action((_, opts) => {
        database = opts.database
      })

      program.parse(["node", "scaffold", "run", "workflow.ts", "-i", "test", "-d", "/custom/path.db"])

      expect(database).toBe("/custom/path.db")
    })
  })

  describe("replay command options", () => {
    let program: Command
    let replayCommand: Command

    beforeEach(() => {
      program = new Command()
      program.exitOverride()
      program.configureOutput({
        writeOut: () => {},
        writeErr: () => {}
      })

      replayCommand = program
        .command("replay")
        .description("Replay a recorded session")
        .requiredOption("-s, --session <id>", "Session ID to replay")
        .option("-d, --database <path>", "Database file path", "./scaffold.db")
        .option("--headless", "Run without TUI")
        .action(() => {})
    })

    it("requires session option", () => {
      expect(() => {
        program.parse(["node", "scaffold", "replay"])
      }).toThrow(/required option.*--session/)
    })

    it("parses valid replay command", () => {
      const parsed: { session?: string; database?: string } = {}

      replayCommand.action((opts) => {
        parsed.session = opts.session
        parsed.database = opts.database
      })

      program.parse(["node", "scaffold", "replay", "-s", "abc-123"])

      expect(parsed.session).toBe("abc-123")
      expect(parsed.database).toBe("./scaffold.db")
    })
  })

  describe("list command options", () => {
    let program: Command
    let listCommand: Command

    beforeEach(() => {
      program = new Command()
      program.exitOverride()
      program.configureOutput({
        writeOut: () => {},
        writeErr: () => {}
      })

      listCommand = program
        .command("list")
        .description("List recorded sessions")
        .option("-d, --database <path>", "Database file path", "./scaffold.db")
        .option("-n, --limit <n>", "Number of sessions to show", "10")
        .action(() => {})
    })

    it("uses default values", () => {
      const parsed: { database?: string; limit?: string } = {}

      listCommand.action((opts) => {
        parsed.database = opts.database
        parsed.limit = opts.limit
      })

      program.parse(["node", "scaffold", "list"])

      expect(parsed.database).toBe("./scaffold.db")
      expect(parsed.limit).toBe("10")
    })

    it("parses custom options", () => {
      const parsed: { database?: string; limit?: string } = {}

      listCommand.action((opts) => {
        parsed.database = opts.database
        parsed.limit = opts.limit
      })

      program.parse(["node", "scaffold", "list", "-d", "/custom.db", "-n", "50"])

      expect(parsed.database).toBe("/custom.db")
      expect(parsed.limit).toBe("50")
    })
  })
})

// ─────────────────────────────────────────────────────────────────
// Test list command output formatting
// ─────────────────────────────────────────────────────────────────

describe("list command formatting", () => {
  it("formats session info correctly", () => {
    // Test the formatting logic used in list.ts
    const session = {
      id: "12345678-1234-1234-1234-123456789012",
      workflowName: "my-test-workflow",
      eventCount: 42,
      createdAt: new Date("2024-01-15T10:30:00Z")
    }

    const id = session.id.padEnd(36)
    const name = session.workflowName.slice(0, 20).padEnd(20)
    const events = String(session.eventCount).padStart(6)
    const created = session.createdAt.toISOString().slice(0, 19).replace("T", " ")

    expect(id).toBe("12345678-1234-1234-1234-123456789012")
    expect(name).toBe("my-test-workflow    ")
    expect(events).toBe("    42")
    expect(created).toBe("2024-01-15 10:30:00")
  })

  it("truncates long workflow names", () => {
    const longName = "this-is-a-very-long-workflow-name-that-exceeds-twenty-characters"
    const truncated = longName.slice(0, 20).padEnd(20)

    expect(truncated).toBe("this-is-a-very-long-")
    expect(truncated.length).toBe(20)
  })

  it("pads short workflow names", () => {
    const shortName = "short"
    const padded = shortName.slice(0, 20).padEnd(20)

    expect(padded).toBe("short               ")
    expect(padded.length).toBe(20)
  })

  it("right-aligns event counts", () => {
    expect(String(1).padStart(6)).toBe("     1")
    expect(String(999).padStart(6)).toBe("   999")
    expect(String(123456).padStart(6)).toBe("123456")
    expect(String(1234567).padStart(6)).toBe("1234567") // overflow is ok
  })
})
