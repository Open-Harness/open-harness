import resolve from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";
import dts from "rollup-plugin-dts";

const external = ["react", "react/jsx-runtime", "ai"];

export default [
	{
		input: "src/index.ts",
		output: { file: "dist/index.js", format: "esm" },
		external,
		plugins: [
			resolve({ extensions: [".mjs", ".js", ".ts", ".json"] }),
			typescript({
				tsconfig: "./tsconfig.json",
				include: ["src/**/*", "../**/src/**/*"],
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
