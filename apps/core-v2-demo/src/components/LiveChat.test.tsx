/**
 * LiveChat Component Tests
 *
 * Tests for the LiveChat component which is used for recording new sessions:
 * - Messages display (user and assistant)
 * - Input field and submit button
 * - Loading indicator
 * - Error display
 * - NO tape controls (key difference from ChatUI)
 * - End Session button
 * - Workflow state display
 *
 * @module apps/core-v2-demo/src/components/LiveChat.test
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LiveChat } from "./LiveChat";

// Mock the workflow hook
const mockHandleSubmit = vi.fn((e: { preventDefault: () => void }) =>
  e.preventDefault(),
);
const mockSetInput = vi.fn();

// Default mock values
let mockUseWorkflowReturn = {
  messages: [] as Array<{
    id: string;
    role: "user" | "assistant";
    content: string;
    name?: string;
    toolInvocations?: Array<{
      toolCallId: string;
      toolName: string;
      state: "pending" | "result" | "error";
    }>;
  }>,
  input: "",
  setInput: mockSetInput,
  handleSubmit: mockHandleSubmit,
  isLoading: false,
  error: null as Error | null,
  state: {
    goal: "",
    tasks: [],
    currentPhase: "planning" as "planning" | "executing" | "complete",
    currentTaskIndex: 0,
    executionResults: [],
  },
};

vi.mock("@open-harness/core-v2/react", () => ({
  useWorkflow: () => mockUseWorkflowReturn,
}));

vi.mock("../lib/workflow", () => ({
  createTaskExecutorWorkflow: () => ({}),
}));

describe("LiveChat", () => {
  const mockOnSessionEnd = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset to default values
    mockUseWorkflowReturn = {
      messages: [],
      input: "",
      setInput: mockSetInput,
      handleSubmit: mockHandleSubmit,
      isLoading: false,
      error: null,
      state: {
        goal: "",
        tasks: [],
        currentPhase: "planning",
        currentTaskIndex: 0,
        executionResults: [],
      },
    };
  });

  describe("Component Structure", () => {
    it("renders the live chat container", () => {
      render(<LiveChat api="/api/workflow" onSessionEnd={mockOnSessionEnd} />);
      expect(screen.getByTestId("live-chat")).toBeInTheDocument();
    });

    it("renders the messages container", () => {
      render(<LiveChat api="/api/workflow" onSessionEnd={mockOnSessionEnd} />);
      expect(screen.getByTestId("messages-container")).toBeInTheDocument();
    });

    it("renders the chat form", () => {
      render(<LiveChat api="/api/workflow" onSessionEnd={mockOnSessionEnd} />);
      expect(screen.getByTestId("chat-form")).toBeInTheDocument();
    });

    it("renders the chat input", () => {
      render(<LiveChat api="/api/workflow" onSessionEnd={mockOnSessionEnd} />);
      expect(screen.getByTestId("chat-input")).toBeInTheDocument();
    });

    it("renders the submit button", () => {
      render(<LiveChat api="/api/workflow" onSessionEnd={mockOnSessionEnd} />);
      expect(screen.getByTestId("submit-button")).toBeInTheDocument();
    });
  });

  describe("NO Tape Controls (Key Feature)", () => {
    it("does NOT render tape controls (unlike ChatUI)", () => {
      render(<LiveChat api="/api/workflow" onSessionEnd={mockOnSessionEnd} />);

      // Tape controls should NOT exist in LiveChat
      expect(screen.queryByTestId("tape-controls")).not.toBeInTheDocument();
      expect(screen.queryByTestId("rewind-button")).not.toBeInTheDocument();
      expect(screen.queryByTestId("step-back-button")).not.toBeInTheDocument();
      expect(screen.queryByTestId("step-button")).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("position-indicator"),
      ).not.toBeInTheDocument();
    });
  });

  describe("Empty State", () => {
    it("shows welcome message when no messages", () => {
      render(<LiveChat api="/api/workflow" onSessionEnd={mockOnSessionEnd} />);
      expect(screen.getByText("Start Recording")).toBeInTheDocument();
      expect(
        screen.getByText(/Enter a goal and the AI will break it down/),
      ).toBeInTheDocument();
    });
  });

  describe("Messages Display", () => {
    it("displays user messages", () => {
      mockUseWorkflowReturn.messages = [
        { id: "1", role: "user", content: "Hello, world!" },
      ];

      render(<LiveChat api="/api/workflow" onSessionEnd={mockOnSessionEnd} />);

      expect(screen.getByText("Hello, world!")).toBeInTheDocument();
      expect(screen.getByTestId("message-user")).toBeInTheDocument();
    });

    it("displays assistant messages", () => {
      mockUseWorkflowReturn.messages = [
        { id: "1", role: "assistant", content: "I can help with that." },
      ];

      render(<LiveChat api="/api/workflow" onSessionEnd={mockOnSessionEnd} />);

      expect(screen.getByText("I can help with that.")).toBeInTheDocument();
      expect(screen.getByTestId("message-assistant")).toBeInTheDocument();
    });

    it("displays agent name when present", () => {
      mockUseWorkflowReturn.messages = [
        {
          id: "1",
          role: "assistant",
          content: "Planning tasks...",
          name: "planner",
        },
      ];

      render(<LiveChat api="/api/workflow" onSessionEnd={mockOnSessionEnd} />);

      expect(screen.getByText("planner")).toBeInTheDocument();
    });

    it("displays tool invocations with badges", () => {
      mockUseWorkflowReturn.messages = [
        {
          id: "1",
          role: "assistant",
          content: "Working on it...",
          toolInvocations: [
            { toolCallId: "tc1", toolName: "analyze", state: "pending" },
            { toolCallId: "tc2", toolName: "execute", state: "result" },
          ],
        },
      ];

      render(<LiveChat api="/api/workflow" onSessionEnd={mockOnSessionEnd} />);

      expect(screen.getByText("analyze")).toBeInTheDocument();
      expect(screen.getByText("execute")).toBeInTheDocument();
    });
  });

  describe("Loading State", () => {
    it("shows loading indicator when isLoading is true", () => {
      mockUseWorkflowReturn.isLoading = true;

      render(<LiveChat api="/api/workflow" onSessionEnd={mockOnSessionEnd} />);

      expect(screen.getByTestId("loading-indicator")).toBeInTheDocument();
      expect(screen.getByText("AI is thinking...")).toBeInTheDocument();
    });

    it("disables input when loading", () => {
      mockUseWorkflowReturn.isLoading = true;

      render(<LiveChat api="/api/workflow" onSessionEnd={mockOnSessionEnd} />);

      expect(screen.getByTestId("chat-input")).toBeDisabled();
    });

    it("disables submit button when loading", () => {
      mockUseWorkflowReturn.isLoading = true;

      render(<LiveChat api="/api/workflow" onSessionEnd={mockOnSessionEnd} />);

      expect(screen.getByTestId("submit-button")).toBeDisabled();
    });
  });

  describe("Error Display", () => {
    it("shows error message when error exists", () => {
      mockUseWorkflowReturn.error = new Error("Something went wrong");

      render(<LiveChat api="/api/workflow" onSessionEnd={mockOnSessionEnd} />);

      expect(screen.getByTestId("error-display")).toBeInTheDocument();
      expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    });

    it("does not show error display when no error", () => {
      render(<LiveChat api="/api/workflow" onSessionEnd={mockOnSessionEnd} />);

      expect(screen.queryByTestId("error-display")).not.toBeInTheDocument();
    });
  });

  describe("Workflow State Display", () => {
    it("displays current phase", () => {
      mockUseWorkflowReturn.state = {
        ...mockUseWorkflowReturn.state,
        currentPhase: "executing",
      };

      render(<LiveChat api="/api/workflow" onSessionEnd={mockOnSessionEnd} />);

      expect(screen.getByText("executing")).toBeInTheDocument();
    });

    it("displays task count", () => {
      mockUseWorkflowReturn.state = {
        ...mockUseWorkflowReturn.state,
        tasks: [
          { id: "1", title: "Task 1", description: "Desc", status: "pending" },
          { id: "2", title: "Task 2", description: "Desc", status: "pending" },
        ],
      };

      render(<LiveChat api="/api/workflow" onSessionEnd={mockOnSessionEnd} />);

      expect(screen.getByText("2")).toBeInTheDocument();
    });

    it("displays completed task count", () => {
      mockUseWorkflowReturn.state = {
        ...mockUseWorkflowReturn.state,
        executionResults: [
          { taskId: "1", output: "Done", success: true },
          { taskId: "2", output: "Done", success: true },
        ],
      };

      render(<LiveChat api="/api/workflow" onSessionEnd={mockOnSessionEnd} />);

      // Should show "2" in the "Done" section
      const doneCount = screen.getAllByText("2");
      expect(doneCount.length).toBeGreaterThan(0);
    });
  });

  describe("End Session Button", () => {
    it("shows End Session button when messages exist", () => {
      mockUseWorkflowReturn.messages = [
        { id: "1", role: "user", content: "Test" },
      ];

      render(<LiveChat api="/api/workflow" onSessionEnd={mockOnSessionEnd} />);

      expect(screen.getByTestId("end-session-button")).toBeInTheDocument();
    });

    it("shows End Session button when workflow is complete", () => {
      mockUseWorkflowReturn.state = {
        ...mockUseWorkflowReturn.state,
        currentPhase: "complete",
      };

      render(<LiveChat api="/api/workflow" onSessionEnd={mockOnSessionEnd} />);

      expect(screen.getByTestId("end-session-button")).toBeInTheDocument();
    });

    it("calls onSessionEnd when End Session button is clicked", () => {
      mockUseWorkflowReturn.messages = [
        { id: "1", role: "user", content: "Test" },
      ];

      render(<LiveChat api="/api/workflow" onSessionEnd={mockOnSessionEnd} />);

      fireEvent.click(screen.getByTestId("end-session-button"));

      expect(mockOnSessionEnd).toHaveBeenCalledTimes(1);
    });

    it("does not show End Session button during loading", () => {
      mockUseWorkflowReturn.messages = [
        { id: "1", role: "user", content: "Test" },
      ];
      mockUseWorkflowReturn.isLoading = true;

      render(<LiveChat api="/api/workflow" onSessionEnd={mockOnSessionEnd} />);

      expect(
        screen.queryByTestId("end-session-button"),
      ).not.toBeInTheDocument();
    });

    it("does not show End Session button when no messages and not complete", () => {
      render(<LiveChat api="/api/workflow" onSessionEnd={mockOnSessionEnd} />);

      expect(
        screen.queryByTestId("end-session-button"),
      ).not.toBeInTheDocument();
    });
  });

  describe("Form Submission", () => {
    it("calls handleSubmit when form is submitted", () => {
      mockUseWorkflowReturn.input = "test input";

      render(<LiveChat api="/api/workflow" onSessionEnd={mockOnSessionEnd} />);

      fireEvent.submit(screen.getByTestId("chat-form"));

      expect(mockHandleSubmit).toHaveBeenCalled();
    });

    it("disables submit when input is empty", () => {
      mockUseWorkflowReturn.input = "";

      render(<LiveChat api="/api/workflow" onSessionEnd={mockOnSessionEnd} />);

      expect(screen.getByTestId("submit-button")).toBeDisabled();
    });

    it("disables submit when input is whitespace only", () => {
      mockUseWorkflowReturn.input = "   ";

      render(<LiveChat api="/api/workflow" onSessionEnd={mockOnSessionEnd} />);

      expect(screen.getByTestId("submit-button")).toBeDisabled();
    });

    it("enables submit when input has content", () => {
      mockUseWorkflowReturn.input = "Hello";

      render(<LiveChat api="/api/workflow" onSessionEnd={mockOnSessionEnd} />);

      expect(screen.getByTestId("submit-button")).not.toBeDisabled();
    });

    it("disables input when workflow is complete", () => {
      mockUseWorkflowReturn.state = {
        ...mockUseWorkflowReturn.state,
        currentPhase: "complete",
      };

      render(<LiveChat api="/api/workflow" onSessionEnd={mockOnSessionEnd} />);

      expect(screen.getByTestId("chat-input")).toBeDisabled();
    });

    it("disables submit when workflow is complete", () => {
      mockUseWorkflowReturn.state = {
        ...mockUseWorkflowReturn.state,
        currentPhase: "complete",
      };
      mockUseWorkflowReturn.input = "test";

      render(<LiveChat api="/api/workflow" onSessionEnd={mockOnSessionEnd} />);

      expect(screen.getByTestId("submit-button")).toBeDisabled();
    });
  });

  describe("Input Handling", () => {
    it("calls setInput when input changes", () => {
      render(<LiveChat api="/api/workflow" onSessionEnd={mockOnSessionEnd} />);

      fireEvent.change(screen.getByTestId("chat-input"), {
        target: { value: "new value" },
      });

      expect(mockSetInput).toHaveBeenCalledWith("new value");
    });
  });
});
