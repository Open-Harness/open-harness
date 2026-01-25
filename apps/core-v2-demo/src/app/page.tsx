"use client";

/**
 * Core V2 Demo - Main Page
 *
 * Demonstrates the core-v2 package's React integration with:
 * - useWorkflow hook for AI SDK-compatible patterns
 * - Tape controls for time-travel debugging
 * - Real-time workflow state display
 * - Server-side workflow execution via API endpoint
 */

import { ChatUI } from "@/components/ChatUI";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center bg-zinc-50 px-6 py-12 dark:bg-zinc-900">
      <div className="w-full max-w-3xl">
        <h1 className="mb-8 text-center text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          Core V2 Demo
        </h1>
        <p className="mb-8 text-center text-lg text-zinc-600 dark:text-zinc-400">
          Event-sourced workflow system with time-travel debugging.
        </p>
        <ChatUI api="/api/workflow" />
      </div>
    </main>
  );
}
