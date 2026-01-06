import { describe, expect, test } from "bun:test";

describe("package exports compile", () => {
  test("core export surface is importable", async () => {
    const mod = await import("../../src/index.ts");
    expect(mod).toBeTruthy();
  });

  test("server export surface is importable", async () => {
    const mod = await import("../../src/server/index.ts");
    expect(mod).toBeTruthy();
  });

  test("client export surface is importable", async () => {
    const mod = await import("../../src/client/index.ts");
    expect(mod).toBeTruthy();
  });

  test("react export surface is importable", async () => {
    const mod = await import("../../src/client/react/index.ts");
    expect(mod).toBeTruthy();
  });
});
