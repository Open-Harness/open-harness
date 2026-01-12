import commonjs from "@rollup/plugin-commonjs";
import resolve from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";
import dts from "rollup-plugin-dts";

const external = [
	"react",
	"react/jsx-runtime",
	"ai",
	// Node.js native modules - should not be bundled
	"pino",
	"pino-pretty",
	"thread-stream",
];

export default [
	{
		input: "src/index.ts",
		output: { file: "dist/index.js", format: "esm", inlineDynamicImports: true },
		external,
		plugins: [
			commonjs(),
			resolve({ extensions: [".mjs", ".js", ".ts", ".json"] }),
			typescript({
				tsconfig: "./tsconfig.json",
				include: ["src/**/*", "../../internal/**/src/**/*", "../../adapters/**/src/**/*"],
				compilerOptions: {
					allowImportingTsExtensions: false,
					noEmit: false,
				},
			}),
		],
	},
	{
		input: "src/index.ts",
		output: { file: "dist/index.d.ts", format: "esm" },
		external,
		plugins: [
			dts({
				// Bundle types from workspace packages that aren't published to npm
				includeExternal: [
					"@internal/core",
					"@internal/signals",
					"@internal/signals-core",
					"@open-harness/claude",
					"@open-harness/openai",
				],
				// Resolve workspace packages via paths mapping
				compilerOptions: {
					baseUrl: ".",
					paths: {
						"@internal/core": ["../../internal/core/src/index.ts"],
						"@internal/core/*": ["../../internal/core/src/*"],
						"@internal/signals": ["../../internal/signals/src/index.ts"],
						"@internal/signals/*": ["../../internal/signals/src/*"],
						"@internal/signals-core": ["../../internal/signals-core/src/index.ts"],
						"@internal/signals-core/*": ["../../internal/signals-core/src/*"],
						"@open-harness/claude": ["../../adapters/harnesses/claude/src/index.ts"],
						"@open-harness/claude/*": ["../../adapters/harnesses/claude/src/*"],
						"@open-harness/openai": ["../../adapters/harnesses/openai/src/index.ts"],
						"@open-harness/openai/*": ["../../adapters/harnesses/openai/src/*"],
					},
				},
			}),
		],
	},
];
