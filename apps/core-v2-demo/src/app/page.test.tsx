/**
 * Tests for the main page component.
 *
 * Validates the session management architecture:
 * - List Mode: SessionList as landing view
 * - Live Mode: ChatUI for recording new sessions
 * - Replay Mode: Placeholder for time-travel debugging
 *
 * @module apps/core-v2-demo/src/app/page.test
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Home from "./page";

// Mock the components to isolate page behavior
vi.mock("@/components/SessionList", () => ({
  SessionList: ({
    onNewSession,
    onSelectSession,
  }: {
    onNewSession: () => void;
    onSelectSession: (id: string) => void;
  }) => (
    <div data-testid="session-list">
      <button
        type="button"
        onClick={onNewSession}
        data-testid="new-session-button"
      >
        New Session
      </button>
      <button
        type="button"
        onClick={() => onSelectSession("test-session-123")}
        data-testid="select-session-button"
      >
        Select Session
      </button>
    </div>
  ),
}));

vi.mock("@/components/ChatUI", () => ({
  ChatUI: ({ api }: { api?: string }) => (
    <div data-testid="chat-ui" data-api={api}>
      ChatUI Component
    </div>
  ),
}));

describe("Home Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe("List Mode (Landing View)", () => {
    it("renders SessionList as the default landing view", () => {
      render(<Home />);
      expect(screen.getByTestId("session-list")).toBeInTheDocument();
    });

    it("does not show ChatUI in list mode", () => {
      render(<Home />);
      expect(screen.queryByTestId("chat-ui")).not.toBeInTheDocument();
    });

    it("does not show back button in list mode", () => {
      render(<Home />);
      expect(screen.queryByTestId("back-button")).not.toBeInTheDocument();
    });

    it("does not show recording indicator in list mode", () => {
      render(<Home />);
      expect(
        screen.queryByTestId("recording-indicator"),
      ).not.toBeInTheDocument();
    });
  });

  describe("Live Mode (Recording)", () => {
    it("enters live mode when New Session is clicked", () => {
      render(<Home />);

      fireEvent.click(screen.getByTestId("new-session-button"));

      expect(screen.getByTestId("chat-ui")).toBeInTheDocument();
    });

    it("shows recording indicator in live mode", () => {
      render(<Home />);

      fireEvent.click(screen.getByTestId("new-session-button"));

      expect(screen.getByTestId("recording-indicator")).toBeInTheDocument();
    });

    it("shows back button in live mode", () => {
      render(<Home />);

      fireEvent.click(screen.getByTestId("new-session-button"));

      expect(screen.getByTestId("back-button")).toBeInTheDocument();
    });

    it("hides SessionList in live mode", () => {
      render(<Home />);

      fireEvent.click(screen.getByTestId("new-session-button"));

      expect(screen.queryByTestId("session-list")).not.toBeInTheDocument();
    });

    it("passes api prop to ChatUI", () => {
      render(<Home />);

      fireEvent.click(screen.getByTestId("new-session-button"));

      expect(screen.getByTestId("chat-ui")).toHaveAttribute(
        "data-api",
        "/api/workflow",
      );
    });

    it("returns to list mode when back button is clicked", () => {
      render(<Home />);

      // Enter live mode
      fireEvent.click(screen.getByTestId("new-session-button"));
      expect(screen.getByTestId("chat-ui")).toBeInTheDocument();

      // Return to list mode
      fireEvent.click(screen.getByTestId("back-button"));
      expect(screen.getByTestId("session-list")).toBeInTheDocument();
      expect(screen.queryByTestId("chat-ui")).not.toBeInTheDocument();
    });
  });

  describe("Replay Mode (Time-Travel)", () => {
    it("enters replay mode when a session is selected", () => {
      render(<Home />);

      fireEvent.click(screen.getByTestId("select-session-button"));

      expect(screen.getByTestId("replay-placeholder")).toBeInTheDocument();
    });

    it("shows truncated session ID in replay mode", () => {
      render(<Home />);

      fireEvent.click(screen.getByTestId("select-session-button"));

      // Session ID "test-session-123" should be truncated to first 8 chars
      expect(screen.getByText("test-ses...")).toBeInTheDocument();
    });

    it("shows back button in replay mode", () => {
      render(<Home />);

      fireEvent.click(screen.getByTestId("select-session-button"));

      expect(screen.getByTestId("back-button")).toBeInTheDocument();
    });

    it("hides SessionList in replay mode", () => {
      render(<Home />);

      fireEvent.click(screen.getByTestId("select-session-button"));

      expect(screen.queryByTestId("session-list")).not.toBeInTheDocument();
    });

    it("does not show ChatUI in replay mode", () => {
      render(<Home />);

      fireEvent.click(screen.getByTestId("select-session-button"));

      expect(screen.queryByTestId("chat-ui")).not.toBeInTheDocument();
    });

    it("does not show recording indicator in replay mode", () => {
      render(<Home />);

      fireEvent.click(screen.getByTestId("select-session-button"));

      expect(
        screen.queryByTestId("recording-indicator"),
      ).not.toBeInTheDocument();
    });

    it("returns to list mode when back button is clicked from replay", () => {
      render(<Home />);

      // Enter replay mode
      fireEvent.click(screen.getByTestId("select-session-button"));
      expect(screen.getByTestId("replay-placeholder")).toBeInTheDocument();

      // Return to list mode
      fireEvent.click(screen.getByTestId("back-button"));
      expect(screen.getByTestId("session-list")).toBeInTheDocument();
      expect(
        screen.queryByTestId("replay-placeholder"),
      ).not.toBeInTheDocument();
    });
  });

  describe("Mode Transitions", () => {
    it("can transition from list to live to list", () => {
      render(<Home />);

      // List mode
      expect(screen.getByTestId("session-list")).toBeInTheDocument();

      // Live mode
      fireEvent.click(screen.getByTestId("new-session-button"));
      expect(screen.getByTestId("chat-ui")).toBeInTheDocument();

      // Back to list mode
      fireEvent.click(screen.getByTestId("back-button"));
      expect(screen.getByTestId("session-list")).toBeInTheDocument();
    });

    it("can transition from list to replay to list", () => {
      render(<Home />);

      // List mode
      expect(screen.getByTestId("session-list")).toBeInTheDocument();

      // Replay mode
      fireEvent.click(screen.getByTestId("select-session-button"));
      expect(screen.getByTestId("replay-placeholder")).toBeInTheDocument();

      // Back to list mode
      fireEvent.click(screen.getByTestId("back-button"));
      expect(screen.getByTestId("session-list")).toBeInTheDocument();
    });

    it("clears selected session when returning to list from replay", () => {
      render(<Home />);

      // Enter replay mode
      fireEvent.click(screen.getByTestId("select-session-button"));
      expect(screen.getByText("test-ses...")).toBeInTheDocument();

      // Return to list
      fireEvent.click(screen.getByTestId("back-button"));

      // Enter live mode (should not show any session ID)
      fireEvent.click(screen.getByTestId("new-session-button"));
      expect(screen.queryByText("test-ses...")).not.toBeInTheDocument();
    });
  });

  describe("Page Header", () => {
    it("renders page title", () => {
      render(<Home />);
      expect(screen.getByText("Core V2 Demo")).toBeInTheDocument();
    });

    it("renders page description", () => {
      render(<Home />);
      expect(
        screen.getByText(
          "Event-sourced workflow system with time-travel debugging.",
        ),
      ).toBeInTheDocument();
    });
  });
});
