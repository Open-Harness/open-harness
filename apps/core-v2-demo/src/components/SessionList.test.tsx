/**
 * SessionList Component Tests
 *
 * Tests session metadata display functionality:
 * - Session ID (truncated display)
 * - Creation date (formatted)
 * - Event count
 * - Duration (calculated from createdAt to lastEventAt)
 *
 * @module apps/core-v2-demo/src/components/SessionList.test
 */

import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { type SessionInfo, SessionList } from "./SessionList";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Sample session data for testing
const mockSessions: SessionInfo[] = [
  {
    id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    createdAt: "2024-01-15T10:30:00.000Z",
    lastEventAt: "2024-01-15T10:35:30.000Z",
    eventCount: 42,
    workflowName: "TaskExecutor",
  },
  {
    id: "b2c3d4e5-f6a7-8901-bcde-f2345678901a",
    createdAt: "2024-01-14T15:20:00.000Z",
    lastEventAt: "2024-01-14T15:20:45.000Z",
    eventCount: 8,
    workflowName: undefined,
  },
  {
    id: "c3d4e5f6-a7b8-9012-cdef-34567890123b",
    createdAt: "2024-01-13T09:00:00.000Z",
    lastEventAt: undefined,
    eventCount: 1,
  },
];

describe("SessionList", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe("Session Metadata Display", () => {
    it("displays truncated session ID", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSessions,
      });

      render(
        <SessionList onNewSession={() => {}} onSelectSession={() => {}} />,
      );

      await waitFor(() => {
        // First session ID should be truncated to first 8 characters + "..."
        expect(screen.getByText("a1b2c3d4...")).toBeInTheDocument();
        expect(screen.getByText("b2c3d4e5...")).toBeInTheDocument();
        expect(screen.getByText("c3d4e5f6...")).toBeInTheDocument();
      });
    });

    it("displays formatted creation date", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSessions,
      });

      render(
        <SessionList onNewSession={() => {}} onSelectSession={() => {}} />,
      );

      await waitFor(() => {
        // Check that dates are formatted (exact format depends on locale)
        // Jan 15, 2024 should appear somewhere
        const dateElements = screen.getAllByText(/Jan \d+, 2024/);
        expect(dateElements.length).toBeGreaterThan(0);
      });
    });

    it("displays event count for each session", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSessions,
      });

      render(
        <SessionList onNewSession={() => {}} onSelectSession={() => {}} />,
      );

      await waitFor(() => {
        // Event counts should be displayed
        expect(screen.getByText("42")).toBeInTheDocument();
        expect(screen.getByText("8")).toBeInTheDocument();
        expect(screen.getByText("1")).toBeInTheDocument();
      });

      // "events" labels should appear for each session
      const eventsLabels = screen.getAllByText("events");
      expect(eventsLabels.length).toBe(3);
    });

    it("displays calculated duration for sessions with lastEventAt", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSessions,
      });

      render(
        <SessionList onNewSession={() => {}} onSelectSession={() => {}} />,
      );

      await waitFor(() => {
        // First session: 5m 30s duration (10:30:00 to 10:35:30)
        expect(screen.getByText("5m 30s")).toBeInTheDocument();
        // Second session: 45s duration (15:20:00 to 15:20:45)
        expect(screen.getByText("45s")).toBeInTheDocument();
      });
    });

    it("displays dash for sessions without lastEventAt", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSessions,
      });

      render(
        <SessionList onNewSession={() => {}} onSelectSession={() => {}} />,
      );

      await waitFor(() => {
        // Third session has no lastEventAt, should show "—"
        expect(screen.getByText("—")).toBeInTheDocument();
      });
    });

    it("displays workflow name when available", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSessions,
      });

      render(
        <SessionList onNewSession={() => {}} onSelectSession={() => {}} />,
      );

      await waitFor(() => {
        expect(screen.getByText("TaskExecutor")).toBeInTheDocument();
      });
    });
  });

  describe("Duration Formatting", () => {
    it("formats duration less than 1 second as '< 1s'", async () => {
      const shortSession: SessionInfo = {
        id: "short-session-id-1234567890123456",
        createdAt: "2024-01-15T10:00:00.000Z",
        lastEventAt: "2024-01-15T10:00:00.500Z",
        eventCount: 2,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [shortSession],
      });

      render(
        <SessionList onNewSession={() => {}} onSelectSession={() => {}} />,
      );

      await waitFor(() => {
        expect(screen.getByText("< 1s")).toBeInTheDocument();
      });
    });

    it("formats duration in seconds only when under a minute", async () => {
      const secondsSession: SessionInfo = {
        id: "seconds-session-1234567890123456",
        createdAt: "2024-01-15T10:00:00.000Z",
        lastEventAt: "2024-01-15T10:00:45.000Z",
        eventCount: 5,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [secondsSession],
      });

      render(
        <SessionList onNewSession={() => {}} onSelectSession={() => {}} />,
      );

      await waitFor(() => {
        expect(screen.getByText("45s")).toBeInTheDocument();
      });
    });

    it("formats duration in minutes and seconds", async () => {
      const minutesSession: SessionInfo = {
        id: "minutes-session-1234567890123456",
        createdAt: "2024-01-15T10:00:00.000Z",
        lastEventAt: "2024-01-15T10:02:30.000Z",
        eventCount: 10,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [minutesSession],
      });

      render(
        <SessionList onNewSession={() => {}} onSelectSession={() => {}} />,
      );

      await waitFor(() => {
        expect(screen.getByText("2m 30s")).toBeInTheDocument();
      });
    });
  });

  describe("Session Count", () => {
    it("displays total session count in header", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSessions,
      });

      render(
        <SessionList onNewSession={() => {}} onSelectSession={() => {}} />,
      );

      await waitFor(() => {
        expect(screen.getByText("3 sessions")).toBeInTheDocument();
      });
    });

    it("displays singular 'session' for single session", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [mockSessions[0]],
      });

      render(
        <SessionList onNewSession={() => {}} onSelectSession={() => {}} />,
      );

      await waitFor(() => {
        expect(screen.getByText("1 session")).toBeInTheDocument();
      });
    });
  });

  describe("Empty State", () => {
    it("shows empty state message when no sessions", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

      render(
        <SessionList onNewSession={() => {}} onSelectSession={() => {}} />,
      );

      await waitFor(() => {
        expect(screen.getByText("No sessions yet")).toBeInTheDocument();
      });
    });
  });

  describe("Loading State", () => {
    it("shows loading skeleton while fetching", () => {
      // Never resolves - keeps loading
      mockFetch.mockImplementation(() => new Promise(() => {}));

      render(
        <SessionList onNewSession={() => {}} onSelectSession={() => {}} />,
      );

      // Loading skeleton uses animate-pulse class
      const container = screen.getByTestId("session-list");
      const skeleton = container.querySelector(".animate-pulse");
      expect(skeleton).toBeInTheDocument();
    });
  });

  describe("Error State", () => {
    it("shows error message on fetch failure", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: "Internal Server Error",
      });

      render(
        <SessionList onNewSession={() => {}} onSelectSession={() => {}} />,
      );

      await waitFor(() => {
        expect(
          screen.getByText(/Failed to fetch sessions/),
        ).toBeInTheDocument();
      });
    });
  });
});
