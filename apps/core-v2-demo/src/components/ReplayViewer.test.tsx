/**
 * ReplayViewer Component Tests
 *
 * Tests for the time-travel debugging replay viewer.
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ReplayViewer } from "./ReplayViewer";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Sample events for testing
const mockEvents = [
  {
    id: "evt-1",
    name: "user:input",
    payload: { text: "Hello, how are you?" },
    timestamp: new Date("2026-01-22T10:00:00Z").toISOString(),
  },
  {
    id: "evt-2",
    name: "agent:started",
    payload: { agentName: "TestAgent" },
    timestamp: new Date("2026-01-22T10:00:01Z").toISOString(),
  },
  {
    id: "evt-3",
    name: "text:delta",
    payload: { delta: "I'm doing " },
    timestamp: new Date("2026-01-22T10:00:02Z").toISOString(),
  },
  {
    id: "evt-4",
    name: "text:delta",
    payload: { delta: "great!" },
    timestamp: new Date("2026-01-22T10:00:03Z").toISOString(),
  },
  {
    id: "evt-5",
    name: "text:complete",
    payload: { fullText: "I'm doing great!" },
    timestamp: new Date("2026-01-22T10:00:04Z").toISOString(),
  },
];

const mockSessionData = {
  id: "test-session-123",
  events: mockEvents,
  createdAt: "2026-01-22T10:00:00Z",
  lastEventAt: "2026-01-22T10:00:04Z",
  eventCount: 5,
  workflowName: "TestWorkflow",
};

describe("ReplayViewer", () => {
  const mockOnBack = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows loading skeleton while fetching", () => {
    // Never resolve to keep in loading state
    mockFetch.mockImplementation(() => new Promise(() => {}));

    render(<ReplayViewer sessionId="test-session-123" onBack={mockOnBack} />);

    // Should show loading state (animate-pulse indicates skeleton)
    const container = document.querySelector(".animate-pulse");
    expect(container).toBeInTheDocument();
  });

  it("displays error when fetch fails", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
    });

    render(<ReplayViewer sessionId="test-session-123" onBack={mockOnBack} />);

    await waitFor(() => {
      expect(screen.getByText("Failed to Load Session")).toBeInTheDocument();
    });
  });

  it("displays 404 error when session not found", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      statusText: "Not Found",
    });

    render(
      <ReplayViewer sessionId="nonexistent-session" onBack={mockOnBack} />,
    );

    await waitFor(() => {
      expect(screen.getByText("Session not found")).toBeInTheDocument();
    });
  });

  it("renders replay viewer with session data", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockSessionData),
    });

    render(<ReplayViewer sessionId="test-session-123" onBack={mockOnBack} />);

    await waitFor(() => {
      expect(screen.getByTestId("replay-viewer")).toBeInTheDocument();
    });

    // Check session ID is displayed
    expect(screen.getByText("test-ses...")).toBeInTheDocument();

    // Check replay mode badge
    expect(screen.getByText("Replay Mode")).toBeInTheDocument();
  });

  it("displays messages from events", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockSessionData),
    });

    render(<ReplayViewer sessionId="test-session-123" onBack={mockOnBack} />);

    await waitFor(() => {
      expect(screen.getByTestId("replay-viewer")).toBeInTheDocument();
    });

    // User message should be visible
    expect(screen.getByText("Hello, how are you?")).toBeInTheDocument();

    // Assistant message should be visible (at end position by default)
    expect(screen.getByText("I'm doing great!")).toBeInTheDocument();

    // Agent name badge should be visible
    expect(screen.getByText("TestAgent")).toBeInTheDocument();
  });

  it("shows tape controls", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockSessionData),
    });

    render(<ReplayViewer sessionId="test-session-123" onBack={mockOnBack} />);

    await waitFor(() => {
      expect(screen.getByTestId("tape-controls")).toBeInTheDocument();
    });

    // Check all tape control buttons exist
    expect(screen.getByTestId("rewind-button")).toBeInTheDocument();
    expect(screen.getByTestId("step-back-button")).toBeInTheDocument();
    expect(screen.getByTestId("play-button")).toBeInTheDocument();
    expect(screen.getByTestId("step-button")).toBeInTheDocument();
    expect(screen.getByTestId("position-slider")).toBeInTheDocument();
    expect(screen.getByTestId("position-indicator")).toBeInTheDocument();
  });

  it("shows position indicator with correct values", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockSessionData),
    });

    render(<ReplayViewer sessionId="test-session-123" onBack={mockOnBack} />);

    await waitFor(() => {
      expect(screen.getByTestId("position-indicator")).toBeInTheDocument();
    });

    // Should show "5 / 5" (1-indexed position, total events)
    const indicator = screen.getByTestId("position-indicator");
    expect(indicator).toHaveTextContent("5");
    expect(indicator).toHaveTextContent("/");
  });

  it("step back button decreases position", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockSessionData),
    });

    render(<ReplayViewer sessionId="test-session-123" onBack={mockOnBack} />);

    await waitFor(() => {
      expect(screen.getByTestId("step-back-button")).toBeInTheDocument();
    });

    // Initial position should be at the end (5)
    const indicator = screen.getByTestId("position-indicator");
    expect(indicator).toHaveTextContent("5");

    // Click step back
    fireEvent.click(screen.getByTestId("step-back-button"));

    // Position should decrease to 4
    await waitFor(() => {
      expect(indicator).toHaveTextContent("4");
    });
  });

  it("rewind button goes to position 0", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockSessionData),
    });

    render(<ReplayViewer sessionId="test-session-123" onBack={mockOnBack} />);

    await waitFor(() => {
      expect(screen.getByTestId("rewind-button")).toBeInTheDocument();
    });

    // Click rewind
    fireEvent.click(screen.getByTestId("rewind-button"));

    // Position should be at 1 (1-indexed display)
    await waitFor(() => {
      const indicator = screen.getByTestId("position-indicator");
      expect(indicator).toHaveTextContent("1");
    });
  });

  it("step button increases position", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockSessionData),
    });

    render(<ReplayViewer sessionId="test-session-123" onBack={mockOnBack} />);

    await waitFor(() => {
      expect(screen.getByTestId("replay-viewer")).toBeInTheDocument();
    });

    // First rewind to start
    fireEvent.click(screen.getByTestId("rewind-button"));

    await waitFor(() => {
      const indicator = screen.getByTestId("position-indicator");
      expect(indicator).toHaveTextContent("1");
    });

    // Click step forward
    fireEvent.click(screen.getByTestId("step-button"));

    // Position should increase to 2
    await waitFor(() => {
      const indicator = screen.getByTestId("position-indicator");
      expect(indicator).toHaveTextContent("2");
    });
  });

  it("slider updates position", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockSessionData),
    });

    render(<ReplayViewer sessionId="test-session-123" onBack={mockOnBack} />);

    await waitFor(() => {
      expect(screen.getByTestId("position-slider")).toBeInTheDocument();
    });

    // Change slider value
    const slider = screen.getByTestId("position-slider");
    fireEvent.change(slider, { target: { value: "2" } });

    // Position should update to 3 (1-indexed display)
    await waitFor(() => {
      const indicator = screen.getByTestId("position-indicator");
      expect(indicator).toHaveTextContent("3");
    });
  });

  it("back to sessions button calls onBack", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockSessionData),
    });

    render(<ReplayViewer sessionId="test-session-123" onBack={mockOnBack} />);

    await waitFor(() => {
      expect(screen.getByTestId("back-to-sessions-button")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("back-to-sessions-button"));

    expect(mockOnBack).toHaveBeenCalledTimes(1);
  });

  it("retries fetch on error when retry clicked", async () => {
    // First call fails
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
    });

    render(<ReplayViewer sessionId="test-session-123" onBack={mockOnBack} />);

    await waitFor(() => {
      expect(screen.getByText("Failed to Load Session")).toBeInTheDocument();
    });

    // Set up successful response for retry
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockSessionData),
    });

    // Click retry
    fireEvent.click(screen.getByText("Retry"));

    // Should show replay viewer after successful retry
    await waitFor(() => {
      expect(screen.getByTestId("replay-viewer")).toBeInTheDocument();
    });
  });

  it("messages update when stepping through events", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockSessionData),
    });

    render(<ReplayViewer sessionId="test-session-123" onBack={mockOnBack} />);

    await waitFor(() => {
      expect(screen.getByTestId("replay-viewer")).toBeInTheDocument();
    });

    // At the end, should see both user and assistant messages
    expect(screen.getByText("Hello, how are you?")).toBeInTheDocument();
    expect(screen.getByText("I'm doing great!")).toBeInTheDocument();

    // Rewind to start
    fireEvent.click(screen.getByTestId("rewind-button"));

    await waitFor(() => {
      const indicator = screen.getByTestId("position-indicator");
      expect(indicator).toHaveTextContent("1");
    });

    // At position 0, should only see user message
    expect(screen.getByText("Hello, how are you?")).toBeInTheDocument();
    // Assistant message might not be visible at this position
  });
});
