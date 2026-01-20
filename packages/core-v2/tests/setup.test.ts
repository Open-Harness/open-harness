import { Effect, Exit } from "effect";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { exitToResult } from "../src/internal/boundary.js";
import { convertZodToJsonSchema } from "../src/internal/schema.js";

describe("Package Setup", () => {
	describe("Effect installation", () => {
		it("should run a basic Effect program", async () => {
			const program = Effect.succeed(42);
			const result = await Effect.runPromise(program);
			expect(result).toBe(42);
		});

		it("should handle Effect errors", async () => {
			const program = Effect.fail("error");
			await expect(Effect.runPromise(program)).rejects.toThrow();
		});
	});

	describe("boundary utilities", () => {
		it("exitToResult should return value on success", () => {
			const exit = Exit.succeed(42);
			const result = exitToResult(exit);
			expect(result).toBe(42);
		});

		it("exitToResult should throw on failure", () => {
			const exit = Exit.fail("something went wrong");
			expect(() => exitToResult(exit)).toThrow();
		});
	});

	describe("schema utilities", () => {
		it("should convert Zod schema to JSON Schema", () => {
			const schema = z.object({
				name: z.string(),
				age: z.number(),
			});
			const jsonSchema = convertZodToJsonSchema(schema);
			expect(jsonSchema).toHaveProperty("type", "object");
			expect(jsonSchema).toHaveProperty("properties");
		});
	});
});
