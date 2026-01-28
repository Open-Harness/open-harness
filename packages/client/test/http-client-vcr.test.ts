/**
 * HttpClient VCR Integration Tests.
 *
 * Tests the pause/resume/fork/getSession HTTP methods of the HttpClient
 * using fetch mocking to simulate server responses.
 *
 * @module
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { HttpClient } from "../src/HttpClient.js"

// ─────────────────────────────────────────────────────────────────
// Fetch mock setup
// ─────────────────────────────────────────────────────────────────

const mockFetch = vi.fn<typeof globalThis.fetch>()

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch)
  mockFetch.mockReset()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  })

/**
 * Create an HttpClient with a pre-set sessionId (no connect() needed).
 * This avoids starting the SSE reconnection loop.
 */
const makeClient = () => HttpClient({ url: "http://localhost:42069", sessionId: "test-session" })

// ─────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────

describe("HttpClient VCR Methods (Real HTTP)", () => {
  it("pause() pauses a running session via HTTP", async () => {
    const client = makeClient()
    mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true, wasPaused: true }))

    const result = await client.pause()

    expect(result).toEqual({ ok: true, wasPaused: true })
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:42069/sessions/test-session/pause",
      expect.objectContaining({ method: "POST" })
    )
  })

  it("resume() resumes a paused session via HTTP", async () => {
    const client = makeClient()
    mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true, wasResumed: true }))

    const result = await client.resume()

    expect(result).toEqual({ ok: true, wasResumed: true })
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:42069/sessions/test-session/resume",
      expect.objectContaining({ method: "POST" })
    )
  })

  it("fork() creates a new session with copied events via HTTP", async () => {
    const client = makeClient()
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        sessionId: "forked-session",
        originalSessionId: "test-session",
        eventsCopied: 7
      })
    )

    const result = await client.fork()

    expect(result).toEqual({
      sessionId: "forked-session",
      originalSessionId: "test-session",
      eventsCopied: 7
    })
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:42069/sessions/test-session/fork",
      expect.objectContaining({ method: "POST" })
    )
  })

  it("getSession() returns session info with running state", async () => {
    const client = makeClient()
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ sessionId: "test-session", running: true })
    )

    const result = await client.getSession()

    expect(result).toEqual({ sessionId: "test-session", running: true })
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:42069/sessions/test-session",
      expect.objectContaining({
        headers: expect.objectContaining({ "Content-Type": "application/json" })
      })
    )
  })

  it("pause then resume cycle works correctly", async () => {
    const client = makeClient()

    // Pause
    mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true, wasPaused: true }))
    const pauseResult = await client.pause()
    expect(pauseResult.wasPaused).toBe(true)

    // Resume
    mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true, wasResumed: true }))
    const resumeResult = await client.resume()
    expect(resumeResult.wasResumed).toBe(true)

    // Verify pause was called followed by resume
    const calls = mockFetch.mock.calls
    const pauseCall = calls.find(([url]) => typeof url === "string" && url.includes("/pause"))
    const resumeCall = calls.find(([url]) => typeof url === "string" && url.includes("/resume"))
    expect(pauseCall).toBeDefined()
    expect(resumeCall).toBeDefined()
  })
})
