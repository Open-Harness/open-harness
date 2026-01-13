import resolve from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";
import dts from "rollup-plugin-dts";

const external = ["ai"];

export default [
	{
		input: "src/index.ts",
		output: { file: "dist/index.js", format: "esm" },
		external,
		plugins: [
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
				includeExternal: ["@internal/client", "@internal/core"],
				// Resolve workspace packages via paths mapping
				compilerOptions: {
					baseUrl: ".",
					paths: {
						"@internal/client": ["../../internal/client/src/index.ts"],
						"@internal/client/*": ["../../internal/client/src/*"],
						"@internal/core": ["../../internal/core/src/index.ts"],
						"@internal/core/*": ["../../internal/core/src/*"],
					},
				},
			}),
		],
	},
];
