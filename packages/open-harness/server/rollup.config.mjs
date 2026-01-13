import commonjs from "@rollup/plugin-commonjs";
import resolve from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";
import dts from "rollup-plugin-dts";

const external = [
	"react",
	"react/jsx-runtime",
	"ai",
	"@open-harness/run-store-sqlite",
	// Node.js native modules - should not be bundled
	"pino",
	"pino-pretty",
	"thread-stream",
];

export default [
	{
		input: "src/index.ts",
		output: { file: "dist/index.js", format: "esm" },
		external,
		plugins: [
			commonjs(),
			resolve({ extensions: [".mjs", ".js", ".ts", ".json"] }),
			typescript({
				tsconfig: "./tsconfig.json",
				include: ["src/**/*", "../../internal/**/src/**/*"],
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
				includeExternal: ["@internal/server", "@internal/core"],
				// Resolve workspace packages via paths mapping
				compilerOptions: {
					baseUrl: ".",
					paths: {
						"@internal/server": ["../../internal/server/src/index.ts"],
						"@internal/server/*": ["../../internal/server/src/*"],
						"@internal/core": ["../../internal/core/src/index.ts"],
						"@internal/core/*": ["../../internal/core/src/*"],
					},
				},
			}),
		],
	},
];
