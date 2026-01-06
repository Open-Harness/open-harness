import { nodeResolve } from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";

const external = [
  /^node:/,
  "@internal/nodes-basic",
  "ai",
  "bun:test",
  "bun:sqlite",
  "hono",
  "jsonata",
  "uuid",
  "yaml",
  "zod",
  "react",
  "react-dom",
];

const output = (file) => ({
  file,
  format: "esm",
  sourcemap: true,
});

const plugins = [
  nodeResolve({ extensions: [".ts", ".js", ".tsx", ".jsx"] }),
  typescript({
    tsconfig: "./tsconfig.build.json",
    allowImportingTsExtensions: false,
    allowSyntheticDefaultImports: true,
  }),
];

export default [
  {
    input: "src/index.ts",
    output: output("dist/index.js"),
    external,
    plugins,
  },
  {
    input: "src/server/index.ts",
    output: output("dist/server/index.js"),
    external,
    plugins,
  },
  {
    input: "src/client/index.ts",
    output: output("dist/client/index.js"),
    external,
    plugins,
  },
  {
    input: "src/client/react/index.ts",
    output: output("dist/client/react/index.js"),
    external,
    plugins,
  },
  {
    input: "src/testing/index.ts",
    output: output("dist/testing/index.js"),
    external,
    plugins,
  },
];
