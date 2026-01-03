import type { NodePack, NodeTypeDefinition } from "@open-harness/kernel";
import { z } from "zod";

/**
 * Mock Claude node for tutorials.
 * Simulates claude.agent behavior without requiring live API access.
 * For live Claude functionality, use the real claude.agent from claudePack.
 */
export const mockClaudeNode: NodeTypeDefinition<
	{ prompt: string },
	{ text: string; usage?: { inputTokens: number; outputTokens: number } }
> = {
	type: "claude.agent",
	inputSchema: z.object({ prompt: z.string() }),
	outputSchema: z.object({
		text: z.string(),
		usage: z
			.object({
				inputTokens: z.number(),
				outputTokens: z.number(),
			})
			.optional(),
	}),
	capabilities: {
		supportsMultiTurn: true,
	},
	run: async (_ctx, input) => {
		// Simulate processing time
		await new Promise<void>((resolve) => setTimeout(resolve, 100));

		// Generate mock response based on prompt content
		let text: string;
		if (input.prompt.includes("API documentation")) {
			text = `# UserService API Documentation

## Methods

### createUser(email: string, password: string): Promise<User>
Creates a new user account.
- **Parameters:**
  - \`email\`: User's email address (must be valid format)
  - \`password\`: User's password
- **Returns:** Promise resolving to the created User object
- **Throws:** \`ValidationError\` if email format is invalid

### getUser(id: string): Promise<User | null>
Retrieves a user by their unique identifier.
- **Parameters:**
  - \`id\`: Unique user identifier
- **Returns:** Promise resolving to User object or null if not found

### deleteUser(id: string): Promise<void>
Permanently deletes a user from the system.
- **Parameters:**
  - \`id\`: Unique user identifier
- **Returns:** Promise resolving when deletion is complete
- **Warning:** This action cannot be undone`;
		} else {
			text = `Response to: ${input.prompt.slice(0, 100)}...`;
		}

		return {
			text,
			usage: {
				inputTokens: Math.floor(input.prompt.length / 4),
				outputTokens: Math.floor(text.length / 4),
			},
		};
	},
};

export const uppercaseNode: NodeTypeDefinition<{ text: string }, { text: string }> = {
	type: "tutorial.uppercase",
	inputSchema: z.object({ text: z.string() }),
	outputSchema: z.object({ text: z.string() }),
	run: async (_ctx, input) => {
		return { text: input.text.toUpperCase() };
	},
};

function getAttemptFromRunId(runId: string): number {
	const parts = runId.split("-");
	if (parts.length < 4) return 1;
	const attempt = Number(parts[2]);
	return Number.isFinite(attempt) ? attempt : 1;
}

export const flakyNode: NodeTypeDefinition<{ label: string }, { label: string; attempt: number }> = {
	type: "tutorial.flaky",
	inputSchema: z.object({ label: z.string() }),
	outputSchema: z.object({ label: z.string(), attempt: z.number() }),
	run: async (ctx, input) => {
		const attempt = getAttemptFromRunId(ctx.runId);
		if (attempt < 2) {
			throw new Error("flaky: retry me");
		}
		return { label: input.label, attempt };
	},
};

export const delayNode: NodeTypeDefinition<{ ms: number }, { waitedMs: number }> = {
	type: "tutorial.delay",
	inputSchema: z.object({ ms: z.number().int().nonnegative() }),
	outputSchema: z.object({ waitedMs: z.number() }),
	run: async (_ctx, input) => {
		await new Promise<void>((resolve) => {
			setTimeout(resolve, input.ms);
		});
		return { waitedMs: input.ms };
	},
};

export const failNode: NodeTypeDefinition<{ reason: string }, never> = {
	type: "tutorial.fail",
	inputSchema: z.object({ reason: z.string() }),
	outputSchema: z.never(),
	run: async (_ctx, input) => {
		throw new Error(input.reason);
	},
};

/**
 * Security scanner node for tutorial demonstrations.
 * Checks code for common security issues.
 */
export const securityScanNode: NodeTypeDefinition<
	{ path: string; content: string },
	{ path: string; issues: string[]; severity: string }
> = {
	type: "tutorial.security_scan",
	inputSchema: z.object({
		path: z.string(),
		content: z.string(),
	}),
	outputSchema: z.object({
		path: z.string(),
		issues: z.array(z.string()),
		severity: z.enum(["none", "low", "medium", "high", "critical"]),
	}),
	run: async (_ctx, input) => {
		const issues: string[] = [];

		// Check for SQL injection
		if (input.content.includes("+ userId") || input.content.includes("+ id")) {
			issues.push("SQL injection vulnerability: string concatenation in query");
		}

		// Check for plaintext password comparison
		if (input.content.includes("=== storedPassword") || input.content.includes("== password")) {
			issues.push("Insecure password handling: plaintext comparison");
		}

		// Check for hardcoded secrets (but allow env vars)
		if (input.content.includes("API_KEY =") && !input.content.includes("process.env")) {
			issues.push("Hardcoded secret detected");
		}

		// Determine severity
		let severity: "none" | "low" | "medium" | "high" | "critical" = "none";
		if (issues.length > 0) {
			if (issues.some((i) => i.includes("SQL injection"))) {
				severity = "critical";
			} else if (issues.some((i) => i.includes("password"))) {
				severity = "high";
			} else {
				severity = "medium";
			}
		}

		return { path: input.path, issues, severity };
	},
};

export const tutorialPack: NodePack = {
	register: (registry) => {
		registry.register(uppercaseNode);
		registry.register(flakyNode);
		registry.register(delayNode);
		registry.register(failNode);
		registry.register(securityScanNode);
	},
};

/**
 * Mock Claude pack for tutorials.
 * Provides claude.agent node with simulated responses.
 * Use this in tutorials that need to demonstrate Claude integration
 * without requiring live API access.
 */
export const mockClaudePack: NodePack = {
	register: (registry) => {
		registry.register(mockClaudeNode);
	},
};
