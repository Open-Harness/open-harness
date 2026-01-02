/**
 * Custom Node: Word Analyzer
 *
 * Demonstrates how to create a custom node type with:
 * - Input schema validation (zod)
 * - Output schema validation (zod)
 * - Async run function with typed context
 *
 * This is the pattern for extending the FlowRuntime with domain-specific nodes.
 */

import { z } from "zod";
import type { NodeTypeDefinition } from "@open-harness/kernel";

// Define input schema - what this node accepts
const WordAnalyzerInputSchema = z.object({
	text: z.string().describe("Text content to analyze"),
	countWhitespace: z.boolean().optional().describe("Include whitespace in character count"),
});

// Define output schema - what this node produces
const WordAnalyzerOutputSchema = z.object({
	words: z.number().describe("Number of words"),
	characters: z.number().describe("Number of characters"),
	lines: z.number().describe("Number of lines"),
	averageWordLength: z.number().describe("Average word length"),
	longestWord: z.string().describe("The longest word found"),
});

// Infer TypeScript types from schemas
type WordAnalyzerInput = z.infer<typeof WordAnalyzerInputSchema>;
type WordAnalyzerOutput = z.infer<typeof WordAnalyzerOutputSchema>;

/**
 * Word Analyzer Node
 *
 * Analyzes text content and produces statistics about word usage.
 * This is a stateless, pure function node - ideal for data transformation.
 */
export const wordAnalyzerNode: NodeTypeDefinition<
	WordAnalyzerInput,
	WordAnalyzerOutput
> = {
	// Unique type identifier - convention: "domain.action"
	type: "text.word_analyzer",

	// Zod schemas for runtime validation
	inputSchema: WordAnalyzerInputSchema,
	outputSchema: WordAnalyzerOutputSchema,

	// Optional capabilities (not needed for simple transforms)
	// capabilities: { isStreaming: false },

	// The actual node logic
	run: async (_ctx, input) => {
		const { text, countWhitespace = false } = input;

		// Split into words (handling multiple spaces/newlines)
		const words = text.split(/\s+/).filter((w) => w.length > 0);
		const wordCount = words.length;

		// Count characters
		const charCount = countWhitespace
			? text.length
			: text.replace(/\s/g, "").length;

		// Count lines
		const lineCount = text.split("\n").length;

		// Calculate average word length
		const totalWordChars = words.reduce((sum, word) => sum + word.length, 0);
		const avgLength = wordCount > 0 ? totalWordChars / wordCount : 0;

		// Find longest word
		const longestWord = words.reduce(
			(longest, word) => (word.length > longest.length ? word : longest),
			"",
		);

		return {
			words: wordCount,
			characters: charCount,
			lines: lineCount,
			averageWordLength: Math.round(avgLength * 100) / 100,
			longestWord,
		};
	},
};
