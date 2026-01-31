/**
 * Terminal renderer for workflow events.
 *
 * Style D: Hybrid - boxes for structure, compact for high-frequency events.
 * Includes tool-specific renderers for beautiful, semantic output.
 *
 * @module
 */

// ─────────────────────────────────────────────────────────────────
// ANSI Color Codes
// ─────────────────────────────────────────────────────────────────

const RESET = "\x1b[0m"
const BOLD = "\x1b[1m"
const DIM = "\x1b[2m"

const FG_RED = "\x1b[31m"
const FG_GREEN = "\x1b[32m"
const FG_YELLOW = "\x1b[33m"
const FG_BLUE = "\x1b[34m"
const FG_CYAN = "\x1b[36m"
const FG_WHITE = "\x1b[37m"
const FG_GRAY = "\x1b[90m"

// Agent text indent (4 spaces)
const AGENT_INDENT = "    "

// ─────────────────────────────────────────────────────────────────
// Box Drawing Characters
// ─────────────────────────────────────────────────────────────────

const BOX = {
  topLeft: "╭",
  topRight: "╮",
  bottomLeft: "╰",
  bottomRight: "╯",
  horizontal: "─",
  vertical: "│",
  dividerLeft: "├",
  dividerRight: "┤",
  treeVertical: "│",
  treeCorner: "╰─"
} as const

// ─────────────────────────────────────────────────────────────────
// Symbols
// ─────────────────────────────────────────────────────────────────

const SYM = {
  agentStart: "◆",
  agentEnd: "◇",
  tool: "▶",
  success: "✓",
  error: "✗",
  stateChange: "∿",
  thinking: "┄"
} as const

// ─────────────────────────────────────────────────────────────────
// Utility Functions
// ─────────────────────────────────────────────────────────────────

const getTerminalWidth = (): number => {
  return process.stdout.columns || 80
}

/**
 * Wrap text to fit within a given width, preserving words.
 */
const wrapText = (text: string, width: number, indent = 0): Array<string> => {
  const lines: Array<string> = []
  const indentStr = " ".repeat(indent)
  const effectiveWidth = width - indent

  for (const paragraph of text.split("\n")) {
    if (paragraph.trim() === "") {
      lines.push("")
      continue
    }

    const words = paragraph.split(/\s+/)
    let currentLine = ""

    for (const word of words) {
      if (currentLine.length === 0) {
        currentLine = word
      } else if (currentLine.length + 1 + word.length <= effectiveWidth) {
        currentLine += " " + word
      } else {
        lines.push(indentStr + currentLine)
        currentLine = word
      }
    }

    if (currentLine.length > 0) {
      lines.push(indentStr + currentLine)
    }
  }

  return lines
}

/**
 * Truncate a string with ellipsis if it exceeds maxLength.
 */
const truncate = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength - 3) + "..."
}

/**
 * Shorten a file path for display.
 */
const shortenPath = (path: string, maxLength = 50): string => {
  if (path.length <= maxLength) return path

  const parts = path.split("/")
  if (parts.length <= 3) return truncate(path, maxLength)

  // Keep first and last parts, collapse middle
  const first = parts[0] || ""
  const last = parts.slice(-2).join("/")

  return `${first}/.../${last}`
}

/**
 * Format a duration in milliseconds to human readable.
 */
const formatDuration = (ms: number): string => {
  if (ms < 1000) return `${ms}ms`
  const seconds = ms / 1000
  if (seconds < 60) return `${seconds.toFixed(1)}s`
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes}m ${remainingSeconds.toFixed(0)}s`
}

// ─────────────────────────────────────────────────────────────────
// Box Rendering
// ─────────────────────────────────────────────────────────────────

interface BoxOptions {
  width?: number
  color?: string
  padding?: number
}

/**
 * Render a box with optional divider between title and content.
 */
const renderBox = (
  title: string,
  content: string | null,
  options: BoxOptions = {}
): string => {
  const width = options.width || getTerminalWidth() - 2
  const color = options.color || FG_CYAN
  const padding = options.padding ?? 1

  const innerWidth = width - 2 // Account for borders
  const paddedWidth = innerWidth - padding * 2

  const lines: Array<string> = []

  // Top border
  lines.push(
    `${color}${BOX.topLeft}${BOX.horizontal.repeat(innerWidth)}${BOX.topRight}${RESET}`
  )

  // Title line(s)
  const titleLines = wrapText(title, paddedWidth)
  const pad = " ".repeat(padding)
  for (const line of titleLines) {
    const padded = line.padEnd(paddedWidth)
    lines.push(
      `${color}${BOX.vertical}${RESET}${pad}${padded}${pad}${color}${BOX.vertical}${RESET}`
    )
  }

  // Divider and content (if content exists)
  if (content !== null && content.trim() !== "") {
    lines.push(
      `${color}${BOX.dividerLeft}${BOX.horizontal.repeat(innerWidth)}${BOX.dividerRight}${RESET}`
    )

    const contentLines = wrapText(content, paddedWidth)
    for (const line of contentLines) {
      const padded = line.padEnd(paddedWidth)
      lines.push(
        `${color}${BOX.vertical}${RESET}${pad}${padded}${pad}${color}${BOX.vertical}${RESET}`
      )
    }
  }

  // Bottom border
  lines.push(
    `${color}${BOX.bottomLeft}${BOX.horizontal.repeat(innerWidth)}${BOX.bottomRight}${RESET}`
  )

  return lines.join("\n")
}

// ─────────────────────────────────────────────────────────────────
// Event Renderers
// ─────────────────────────────────────────────────────────────────

/**
 * Render task header box.
 */
export const renderTaskHeader = (
  taskId: string,
  subject: string,
  description: string
): string => {
  const title = `${BOLD}${FG_WHITE}TASK ${taskId}${RESET}${FG_CYAN} · ${FG_WHITE}${subject}${RESET}`
  return "\n" + renderBox(title, description, { color: FG_CYAN })
}

/**
 * Render task completion box.
 */
export const renderTaskComplete = (
  taskId: string,
  success: boolean,
  summary: string
): string => {
  const icon = success ? `${FG_GREEN}${SYM.success}${RESET}` : `${FG_RED}${SYM.error}${RESET}`
  const status = success ? "COMPLETE" : "FAILED"
  const color = success ? FG_GREEN : FG_RED

  const title = `${icon}  ${BOLD}${FG_WHITE}TASK ${taskId} ${status}${RESET}`
  return "\n" + renderBox(title, summary, { color })
}

/**
 * Render agent started.
 */
export const renderAgentStarted = (agentName: string): string => {
  return `\n${FG_YELLOW}${SYM.agentStart}${RESET} ${FG_YELLOW}${agentName}${RESET}\n`
}

/**
 * Render agent completed.
 */
export const renderAgentCompleted = (agentName: string, durationMs: number): string => {
  const duration = formatDuration(durationMs)
  return `\n${FG_YELLOW}${SYM.agentEnd}${RESET} ${FG_YELLOW}${agentName}${RESET} ${DIM}completed (${duration})${RESET}\n`
}

/**
 * Render tool call header.
 */
export const renderToolCall = (
  toolName: string,
  input: unknown
): string => {
  const lines: Array<string> = []

  lines.push(`\n${FG_BLUE}${BOLD}${SYM.tool} ${toolName}${RESET}`)

  // Render input parameters
  if (input !== null && typeof input === "object") {
    const params = input as Record<string, unknown>
    const entries = Object.entries(params)

    for (const [key, value] of entries) {
      const formattedValue = formatParamValue(key, value)
      lines.push(`  ${FG_GRAY}${BOX.treeVertical}${RESET} ${DIM}${key}:${RESET} ${formattedValue}`)
    }
  }

  return lines.join("\n")
}

/**
 * Format a parameter value for display.
 */
const formatParamValue = (key: string, value: unknown): string => {
  if (value === null || value === undefined) {
    return `${DIM}null${RESET}`
  }

  if (typeof value === "string") {
    // Check if it's a file path
    if (key === "file_path" || key === "path" || key === "notebook_path") {
      return `${FG_WHITE}${shortenPath(value)}${RESET}`
    }

    // Check if it's a command
    if (key === "command") {
      const truncated = truncate(value, 60)
      return `${FG_WHITE}${truncated}${RESET}`
    }

    // Check for multi-line content
    if (value.includes("\n")) {
      const lines = value.split("\n")
      if (lines.length > 3) {
        return `${DIM}(${lines.length} lines)${RESET}`
      }
      return `${FG_WHITE}"${truncate(value.replace(/\n/g, "\\n"), 50)}"${RESET}`
    }

    // Regular string
    const truncated = truncate(value, 60)
    return `${FG_WHITE}"${truncated}"${RESET}`
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return `${FG_WHITE}${value}${RESET}`
  }

  if (Array.isArray(value)) {
    return `${DIM}[${value.length} items]${RESET}`
  }

  if (typeof value === "object") {
    const keys = Object.keys(value)
    return `${DIM}{${keys.length} keys}${RESET}`
  }

  return `${DIM}${String(value)}${RESET}`
}

/**
 * Render tool result.
 */
export const renderToolResult = (
  output: unknown,
  isError: boolean
): string => {
  const icon = isError
    ? `${FG_RED}${SYM.error}${RESET}`
    : `${FG_GREEN}${SYM.success}${RESET}`

  let message: string

  if (typeof output === "string") {
    // Clean up the output
    let cleaned = output

    // Remove system reminders
    const reminderIndex = cleaned.indexOf("<system-reminder>")
    if (reminderIndex !== -1) {
      cleaned = cleaned.substring(0, reminderIndex).trim()
    }

    // Remove tool_use_error tags
    cleaned = cleaned.replace(/<\/?tool_use_error>/g, "")

    // Handle multi-line
    if (cleaned.includes("\n")) {
      const lines = cleaned.split("\n").filter((l) => l.trim())
      if (lines.length > 2) {
        message = truncate(lines[0], 55) + ` ${DIM}(+${lines.length - 1} lines)${RESET}`
      } else {
        message = truncate(cleaned.replace(/\n/g, " "), 60)
      }
    } else {
      message = truncate(cleaned, 60)
    }
  } else if (output === null || output === undefined) {
    message = `${DIM}(no output)${RESET}`
  } else {
    message = `${DIM}${JSON.stringify(output).substring(0, 50)}${RESET}`
  }

  const color = isError ? FG_RED : FG_WHITE
  return `\n  ${FG_GRAY}${BOX.treeCorner}${RESET} ${icon} ${color}${message}${RESET}\n`
}

/**
 * Render streaming text delta with indentation for visual distinction.
 */
export const renderTextDelta = (delta: string): string => {
  // Indent each line for visual distinction from tool calls
  if (delta.includes("\n")) {
    return delta
      .split("\n")
      .map((line, i) => (i === 0 ? line : AGENT_INDENT + line))
      .join("\n")
  }
  return delta
}

/**
 * Render gap before agent text (after tool calls).
 * Tool results already end with \n, so we just need the indent.
 */
export const renderAgentTextGap = (): string => {
  return AGENT_INDENT
}

/**
 * Render thinking block start.
 */
export const renderThinkingStart = (): string => {
  const width = Math.min(getTerminalWidth() - 4, 60)
  return `\n${DIM}${SYM.thinking.repeat(width)}${RESET}\n`
}

/**
 * Render thinking delta (dimmed).
 */
export const renderThinkingDelta = (delta: string): string => {
  return `${DIM}${delta}${RESET}`
}

/**
 * Render thinking block end.
 */
export const renderThinkingEnd = (): string => {
  const width = Math.min(getTerminalWidth() - 4, 60)
  return `\n${DIM}${SYM.thinking.repeat(width)}${RESET}\n`
}

/**
 * Render state change notification.
 */
export const renderStateChanged = (changedKey?: string): string => {
  const detail = changedKey ? ` (${changedKey})` : ""
  return `  ${DIM}${SYM.stateChange} state updated${detail}${RESET}\n`
}

/**
 * Render workflow started (minimal).
 */
export const renderWorkflowStarted = (sessionId: string): string => {
  return `${DIM}session: ${sessionId.substring(0, 8)}...${RESET}\n`
}

/**
 * Render error box.
 */
export const renderError = (error: unknown): string => {
  const message = error instanceof Error ? error.message : String(error)
  const title = `${FG_RED}${SYM.error}${RESET}  ${BOLD}${FG_WHITE}ERROR${RESET}`
  return "\n" + renderBox(title, message, { color: FG_RED })
}

/**
 * Render a horizontal separator.
 */
export const renderSeparator = (): string => {
  const width = getTerminalWidth() - 4
  return `\n${DIM}${"─".repeat(width)}${RESET}\n`
}

/**
 * Render execution order summary.
 */
export const renderExecutionOrder = (taskIds: Array<string>): string => {
  const order = taskIds.join(` ${FG_CYAN}→${RESET} `)
  return `\n${DIM}Execution order:${RESET} ${order}\n`
}

/**
 * Render final success message (legacy - use renderOutro for full stats).
 */
export const renderAllTasksComplete = (count: number): string => {
  const title = `${FG_GREEN}${SYM.success}${RESET}  ${BOLD}${FG_WHITE}ALL TASKS COMPLETE${RESET}`
  const content = `Successfully completed ${count} task${count === 1 ? "" : "s"}`
  return "\n" + renderBox(title, content, { color: FG_GREEN })
}

// ─────────────────────────────────────────────────────────────────
// Outro Statistics
// ─────────────────────────────────────────────────────────────────

/**
 * Statistics for the outro summary.
 */
export interface OutroStats {
  tasks: number
  duration: number
  toolCalls: number
  agentRuns: number
  sessionId?: string
}

/**
 * Format duration for outro display.
 */
const formatOutroDuration = (ms: number): string => {
  if (ms < 1000) return `${ms}ms`
  const seconds = ms / 1000
  if (seconds < 60) return `${seconds.toFixed(1)}s`
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes}m ${remainingSeconds.toFixed(1)}s`
}

/**
 * Render the outro statistics box.
 */
export const renderOutro = (stats: OutroStats): string => {
  const width = Math.min(getTerminalWidth() - 2, 64)
  const innerWidth = width - 2
  const pad = " ".repeat(2)

  const lines: Array<string> = []

  // Top border
  lines.push(`${FG_GREEN}${BOX.topLeft}${BOX.horizontal.repeat(innerWidth)}${BOX.topRight}${RESET}`)

  // Title line
  const titleText = `${SYM.success}  ALL TASKS COMPLETE`
  const titlePadded = titleText.padEnd(innerWidth - 2)
  lines.push(
    `${FG_GREEN}${BOX.vertical}${RESET}${pad}${BOLD}${FG_WHITE}${titlePadded}${RESET}${FG_GREEN}${BOX.vertical}${RESET}`
  )

  // Divider
  lines.push(
    `${FG_GREEN}${BOX.dividerLeft}${BOX.horizontal.repeat(innerWidth)}${BOX.dividerRight}${RESET}`
  )

  // Stats rows
  const statRows = [
    ["Tasks", `${stats.tasks} completed`],
    ["Duration", formatOutroDuration(stats.duration)],
    ["Tools", `${stats.toolCalls} calls`],
    ["Agents", `${stats.agentRuns} runs`]
  ]

  for (const [label, value] of statRows) {
    const rowText = `${label.padEnd(12)}${value}`
    const rowPadded = rowText.padEnd(innerWidth - 2)
    lines.push(
      `${FG_GREEN}${BOX.vertical}${RESET}${pad}${DIM}${rowPadded}${RESET}${FG_GREEN}${BOX.vertical}${RESET}`
    )
  }

  // Bottom border
  lines.push(`${FG_GREEN}${BOX.bottomLeft}${BOX.horizontal.repeat(innerWidth)}${BOX.bottomRight}${RESET}`)

  return "\n" + lines.join("\n")
}

// ─────────────────────────────────────────────────────────────────
// Tool-Specific Renderers
// ─────────────────────────────────────────────────────────────────

/**
 * Tool renderer signature.
 */
type ToolRenderer = (input: unknown, output: unknown, isError: boolean) => string

/**
 * Extract line count from file content output.
 *
 * Read tool output format: "     1→content" (spaces, digits, tab/arrow, content)
 * We count only lines that match this pattern.
 */
const countLines = (output: unknown): number => {
  if (typeof output !== "string") return 0

  // Remove system reminders before counting
  let cleaned = output
  const reminderIndex = cleaned.indexOf("<system-reminder>")
  if (reminderIndex !== -1) {
    cleaned = cleaned.substring(0, reminderIndex)
  }

  // Count lines that start with the line number pattern: spaces + digits + arrow/tab
  const lines = cleaned.split("\n")
  let count = 0
  for (const line of lines) {
    // Match: optional spaces, one or more digits, then → or tab
    if (/^\s*\d+[→\t]/.test(line)) {
      count++
    }
  }

  // Return count, or 1 if we got output but no line numbers (edge case)
  return count || (cleaned.trim().length > 0 ? 1 : 0)
}

/**
 * Extract file count from glob output.
 */
const countFiles = (output: unknown): number => {
  if (typeof output !== "string") return 0
  // Glob output is typically file paths, one per line
  return output.trim().split("\n").filter((l) => l.trim()).length
}

/**
 * Extract match count from grep output.
 */
const parseGrepOutput = (output: unknown): { matches: number; files: number } => {
  if (typeof output !== "string") return { matches: 0, files: 0 }
  const lines = output.trim().split("\n").filter((l) => l.trim())
  const files = new Set(lines.map((l) => l.split(":")[0])).size
  return { matches: lines.length, files }
}

/**
 * Format byte size for display.
 */
const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} bytes`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`
}

/**
 * Render Read tool.
 */
const renderReadTool: ToolRenderer = (input, output, isError) => {
  const params = input as Record<string, unknown>
  const path = params.file_path as string || params.path as string || "unknown"

  const lines: Array<string> = []
  lines.push(`\n${FG_BLUE}${BOLD}${SYM.tool} Read${RESET}`)
  lines.push(`  ${FG_GRAY}${BOX.treeVertical}${RESET} ${DIM}path:${RESET} ${FG_WHITE}${shortenPath(path)}${RESET}`)

  if (isError) {
    const errMsg = typeof output === "string" ? truncate(output, 40) : "Error"
    lines.push(`  ${FG_GRAY}${BOX.treeCorner}${RESET} ${FG_RED}${SYM.error}${RESET} ${FG_RED}${errMsg}${RESET}`)
  } else {
    const lineCount = countLines(output)
    lines.push(
      `  ${FG_GRAY}${BOX.treeCorner}${RESET} ${FG_GREEN}${SYM.success}${RESET} ${FG_WHITE}${lineCount} lines${RESET}`
    )
  }

  return lines.join("\n") + "\n"
}

/**
 * Render Write tool.
 */
const renderWriteTool: ToolRenderer = (input, _output, isError) => {
  const params = input as Record<string, unknown>
  const path = params.file_path as string || params.path as string || "unknown"
  const content = params.content as string || ""

  const lines: Array<string> = []
  lines.push(`\n${FG_BLUE}${BOLD}${SYM.tool} Write${RESET}`)
  lines.push(`  ${FG_GRAY}${BOX.treeVertical}${RESET} ${DIM}path:${RESET} ${FG_WHITE}${shortenPath(path)}${RESET}`)

  // Show content preview
  if (content.length > 0) {
    const preview = content.length > 30 ? truncate(content.replace(/\n/g, "\\n"), 30) : content.replace(/\n/g, "\\n")
    lines.push(`  ${FG_GRAY}${BOX.treeVertical}${RESET} ${DIM}content:${RESET} ${FG_WHITE}"${preview}"${RESET}`)
  }

  if (isError) {
    lines.push(`  ${FG_GRAY}${BOX.treeCorner}${RESET} ${FG_RED}${SYM.error}${RESET} ${FG_RED}Failed${RESET}`)
  } else {
    const bytes = new TextEncoder().encode(content).length
    lines.push(
      `  ${FG_GRAY}${BOX.treeCorner}${RESET} ${FG_GREEN}${SYM.success}${RESET} ${FG_WHITE}Created (${
        formatBytes(bytes)
      })${RESET}`
    )
  }

  return lines.join("\n") + "\n"
}

/**
 * Render Edit tool.
 */
const renderEditTool: ToolRenderer = (input, _output, isError) => {
  const params = input as Record<string, unknown>
  const path = params.file_path as string || params.path as string || "unknown"
  const oldStr = params.old_string as string || ""
  const newStr = params.new_string as string || ""

  const lines: Array<string> = []
  lines.push(`\n${FG_BLUE}${BOLD}${SYM.tool} Edit${RESET}`)
  lines.push(`  ${FG_GRAY}${BOX.treeVertical}${RESET} ${DIM}path:${RESET} ${FG_WHITE}${shortenPath(path)}${RESET}`)

  // Show old/new preview
  const oldPreview = truncate(oldStr.replace(/\n/g, "\\n"), 25)
  const newPreview = truncate(newStr.replace(/\n/g, "\\n"), 25)
  lines.push(`  ${FG_GRAY}${BOX.treeVertical}${RESET} ${DIM}old:${RESET} ${FG_WHITE}"${oldPreview}"${RESET}`)
  lines.push(`  ${FG_GRAY}${BOX.treeVertical}${RESET} ${DIM}new:${RESET} ${FG_WHITE}"${newPreview}"${RESET}`)

  if (isError) {
    lines.push(`  ${FG_GRAY}${BOX.treeCorner}${RESET} ${FG_RED}${SYM.error}${RESET} ${FG_RED}Failed${RESET}`)
  } else {
    lines.push(`  ${FG_GRAY}${BOX.treeCorner}${RESET} ${FG_GREEN}${SYM.success}${RESET} ${FG_WHITE}Applied${RESET}`)
  }

  return lines.join("\n") + "\n"
}

/**
 * Render Bash tool.
 */
const renderBashTool: ToolRenderer = (input, output, isError) => {
  const params = input as Record<string, unknown>
  const command = params.command as string || ""

  const lines: Array<string> = []
  lines.push(`\n${FG_BLUE}${BOLD}${SYM.tool} Bash${RESET}`)

  // Show command with $ prefix
  const cmdPreview = truncate(command, 55)
  lines.push(`  ${FG_GRAY}${BOX.treeVertical}${RESET} ${FG_WHITE}$ ${cmdPreview}${RESET}`)

  if (isError) {
    const errMsg = typeof output === "string" ? truncate(output.replace(/\n/g, " "), 40) : "Error"
    lines.push(`  ${FG_GRAY}${BOX.treeCorner}${RESET} ${FG_RED}${SYM.error}${RESET} ${FG_RED}${errMsg}${RESET}`)
  } else {
    // Show brief output summary
    let summary = "(no output)"
    if (typeof output === "string" && output.trim()) {
      const cleaned = output.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, "").trim()
      const outLines = cleaned.split("\n").filter((l) => l.trim())
      if (outLines.length === 1) {
        summary = truncate(outLines[0], 40)
      } else if (outLines.length > 1) {
        summary = `${truncate(outLines[0], 30)} (+${outLines.length - 1} lines)`
      }
    }
    lines.push(`  ${FG_GRAY}${BOX.treeCorner}${RESET} ${FG_GREEN}${SYM.success}${RESET} ${FG_WHITE}${summary}${RESET}`)
  }

  return lines.join("\n") + "\n"
}

/**
 * Render Glob tool.
 */
const renderGlobTool: ToolRenderer = (input, output, isError) => {
  const params = input as Record<string, unknown>
  const pattern = params.pattern as string || "**/*"
  const path = params.path as string

  const lines: Array<string> = []
  lines.push(`\n${FG_BLUE}${BOLD}${SYM.tool} Glob${RESET}`)
  lines.push(`  ${FG_GRAY}${BOX.treeVertical}${RESET} ${DIM}pattern:${RESET} ${FG_WHITE}${pattern}${RESET}`)

  if (path) {
    lines.push(`  ${FG_GRAY}${BOX.treeVertical}${RESET} ${DIM}path:${RESET} ${FG_WHITE}${shortenPath(path)}${RESET}`)
  }

  if (isError) {
    lines.push(`  ${FG_GRAY}${BOX.treeCorner}${RESET} ${FG_RED}${SYM.error}${RESET} ${FG_RED}Error${RESET}`)
  } else {
    const fileCount = countFiles(output)
    lines.push(
      `  ${FG_GRAY}${BOX.treeCorner}${RESET} ${FG_GREEN}${SYM.success}${RESET} ${FG_WHITE}${fileCount} files${RESET}`
    )
  }

  return lines.join("\n") + "\n"
}

/**
 * Render Grep tool.
 */
const renderGrepTool: ToolRenderer = (input, output, isError) => {
  const params = input as Record<string, unknown>
  const pattern = params.pattern as string || ""
  const path = params.path as string

  const lines: Array<string> = []
  lines.push(`\n${FG_BLUE}${BOLD}${SYM.tool} Grep${RESET}`)
  lines.push(
    `  ${FG_GRAY}${BOX.treeVertical}${RESET} ${DIM}pattern:${RESET} ${FG_WHITE}"${truncate(pattern, 40)}"${RESET}`
  )

  if (path) {
    lines.push(`  ${FG_GRAY}${BOX.treeVertical}${RESET} ${DIM}path:${RESET} ${FG_WHITE}${shortenPath(path)}${RESET}`)
  }

  if (isError) {
    lines.push(`  ${FG_GRAY}${BOX.treeCorner}${RESET} ${FG_RED}${SYM.error}${RESET} ${FG_RED}Error${RESET}`)
  } else {
    const { files, matches } = parseGrepOutput(output)
    lines.push(
      `  ${FG_GRAY}${BOX.treeCorner}${RESET} ${FG_GREEN}${SYM.success}${RESET} ${FG_WHITE}${matches} matches in ${files} files${RESET}`
    )
  }

  return lines.join("\n") + "\n"
}

/**
 * Render WebSearch tool.
 */
const renderWebSearchTool: ToolRenderer = (input, output, isError) => {
  const params = input as Record<string, unknown>
  const query = params.query as string || ""

  const lines: Array<string> = []
  lines.push(`\n${FG_BLUE}${BOLD}${SYM.tool} WebSearch${RESET}`)
  lines.push(`  ${FG_GRAY}${BOX.treeVertical}${RESET} ${DIM}query:${RESET} ${FG_WHITE}"${truncate(query, 45)}"${RESET}`)

  if (isError) {
    lines.push(`  ${FG_GRAY}${BOX.treeCorner}${RESET} ${FG_RED}${SYM.error}${RESET} ${FG_RED}Error${RESET}`)
  } else {
    // Estimate result count from output length
    const resultCount = typeof output === "string" ? Math.max(1, Math.floor(output.length / 500)) : 0
    lines.push(
      `  ${FG_GRAY}${BOX.treeCorner}${RESET} ${FG_GREEN}${SYM.success}${RESET} ${FG_WHITE}${resultCount} results${RESET}`
    )
  }

  return lines.join("\n") + "\n"
}

/**
 * Render WebFetch tool.
 */
const renderWebFetchTool: ToolRenderer = (input, output, isError) => {
  const params = input as Record<string, unknown>
  const url = params.url as string || ""

  const lines: Array<string> = []
  lines.push(`\n${FG_BLUE}${BOLD}${SYM.tool} WebFetch${RESET}`)

  // Shorten URL for display
  const shortUrl = url.length > 50 ? url.substring(0, 47) + "..." : url
  lines.push(`  ${FG_GRAY}${BOX.treeVertical}${RESET} ${DIM}url:${RESET} ${FG_WHITE}${shortUrl}${RESET}`)

  if (isError) {
    lines.push(`  ${FG_GRAY}${BOX.treeCorner}${RESET} ${FG_RED}${SYM.error}${RESET} ${FG_RED}Failed to fetch${RESET}`)
  } else {
    const bytes = typeof output === "string" ? new TextEncoder().encode(output).length : 0
    lines.push(
      `  ${FG_GRAY}${BOX.treeCorner}${RESET} ${FG_GREEN}${SYM.success}${RESET} ${FG_WHITE}Fetched (${
        formatBytes(bytes)
      })${RESET}`
    )
  }

  return lines.join("\n") + "\n"
}

/**
 * Render Task (subagent) tool.
 */
const renderTaskTool: ToolRenderer = (input, _output, isError) => {
  const params = input as Record<string, unknown>
  const subagentType = params.subagent_type as string || "unknown"
  const prompt = params.prompt as string || ""

  const lines: Array<string> = []
  lines.push(`\n${FG_BLUE}${BOLD}${SYM.tool} Task${RESET}`)
  lines.push(`  ${FG_GRAY}${BOX.treeVertical}${RESET} ${DIM}type:${RESET} ${FG_WHITE}${subagentType}${RESET}`)
  lines.push(
    `  ${FG_GRAY}${BOX.treeVertical}${RESET} ${DIM}prompt:${RESET} ${FG_WHITE}"${truncate(prompt, 40)}"${RESET}`
  )

  if (isError) {
    lines.push(`  ${FG_GRAY}${BOX.treeCorner}${RESET} ${FG_RED}${SYM.error}${RESET} ${FG_RED}Failed${RESET}`)
  } else {
    lines.push(`  ${FG_GRAY}${BOX.treeCorner}${RESET} ${FG_GREEN}${SYM.success}${RESET} ${FG_WHITE}Completed${RESET}`)
  }

  return lines.join("\n") + "\n"
}

/**
 * Render StructuredOutput tool.
 */
const renderOutputTool: ToolRenderer = (input, _output, isError) => {
  const params = input as Record<string, unknown>
  const success = params.success as boolean
  const summary = params.summary as string || ""

  const lines: Array<string> = []
  lines.push(`\n${FG_BLUE}${BOLD}${SYM.tool} Output${RESET}`)
  lines.push(`  ${FG_GRAY}${BOX.treeVertical}${RESET} ${DIM}success:${RESET} ${FG_WHITE}${success}${RESET}`)

  if (summary) {
    lines.push(
      `  ${FG_GRAY}${BOX.treeVertical}${RESET} ${DIM}summary:${RESET} ${FG_WHITE}"${truncate(summary, 35)}"${RESET}`
    )
  }

  if (isError) {
    lines.push(`  ${FG_GRAY}${BOX.treeCorner}${RESET} ${FG_RED}${SYM.error}${RESET} ${FG_RED}Error${RESET}`)
  } else {
    lines.push(`  ${FG_GRAY}${BOX.treeCorner}${RESET} ${FG_GREEN}${SYM.success}${RESET} ${FG_WHITE}Submitted${RESET}`)
  }

  return lines.join("\n") + "\n"
}

/**
 * Tool renderer registry.
 */
const TOOL_RENDERERS: Record<string, ToolRenderer> = {
  Read: renderReadTool,
  Write: renderWriteTool,
  Edit: renderEditTool,
  Bash: renderBashTool,
  Glob: renderGlobTool,
  Grep: renderGrepTool,
  WebSearch: renderWebSearchTool,
  WebFetch: renderWebFetchTool,
  Task: renderTaskTool,
  StructuredOutput: renderOutputTool
}

/**
 * Check if a tool has a specific renderer.
 */
export const hasToolRenderer = (toolName: string): boolean => {
  return toolName in TOOL_RENDERERS
}

/**
 * Render tool call with tool-specific formatting (combined call + result).
 */
export const renderToolSpecific = (
  toolName: string,
  input: unknown,
  output: unknown,
  isError: boolean
): string => {
  const renderer = TOOL_RENDERERS[toolName]
  if (renderer) {
    return renderer(input, output, isError)
  }
  // Fallback: use generic rendering (handled by caller)
  return ""
}
