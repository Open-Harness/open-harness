import resolve from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";
import dts from "rollup-plugin-dts";

const external = [
	"@open-harness/recording-store-file",
	"@open-harness/recording-store-sqlite",
	"@open-harness/run-store-sqlite",
];

export default [
	{
		input: "src/index.ts",
		output: { file: "dist/index.js", format: "esm" },
		external,
		plugins: [
			resolve({ extensions: [".mjs", ".js", ".ts", ".json"] }),
			typescript({
				tsconfig: "./tsconfig.json",
				include: ["src/**/*"],
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
