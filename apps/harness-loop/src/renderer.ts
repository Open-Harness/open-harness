/**
 * Terminal renderer for workflow events.
 *
 * Style D: Hybrid - boxes for structure, compact for high-frequency events.
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
 * Render streaming text delta (just return the text, no decoration).
 */
export const renderTextDelta = (delta: string): string => {
  return delta
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
 * Render final success message.
 */
export const renderAllTasksComplete = (count: number): string => {
  const title = `${FG_GREEN}${SYM.success}${RESET}  ${BOLD}${FG_WHITE}ALL TASKS COMPLETE${RESET}`
  const content = `Successfully completed ${count} task${count === 1 ? "" : "s"}`
  return "\n" + renderBox(title, content, { color: FG_GREEN })
}
