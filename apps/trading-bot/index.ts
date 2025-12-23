/**
 * Trading Bot Entry Point
 * Run with: bun index.ts
 */

export * from "./src/index";

// Quick start example
async function main() {
	console.log("🤖 Agentic Trading Bot v0.1.0");
	console.log("");
	console.log("Usage:");
	console.log("  bun trading-cli.ts --help     Show CLI commands");
	console.log("  bun test                      Run tests");
	console.log("  bun run dev                   Start in development mode");
	console.log("");
	console.log("Quick start:");
	console.log("  1. bun trading-cli.ts install");
	console.log("  2. bun trading-cli.ts workflow start --mock --dry-run");
}

main();
