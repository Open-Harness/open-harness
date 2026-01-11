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
		plugins: [dts()],
	},
];
