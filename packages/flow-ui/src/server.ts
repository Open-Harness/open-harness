/**
 * Flow UI Development Server
 *
 * Uses Bun.serve() with HTML imports for React + ReactFlow.
 * HMR enabled for development.
 */

import index from "./index.html";

const PORT = process.env.PORT ? Number.parseInt(process.env.PORT) : 3000;

console.log(`🚀 Starting Flow UI on http://localhost:${PORT}`);

Bun.serve({
	port: PORT,
	routes: {
		"/": index,
		// API routes can be added here for loading/saving flows
		"/api/health": () =>
			new Response(JSON.stringify({ status: "ok" }), {
				headers: { "Content-Type": "application/json" },
			}),
	},
	development: {
		hmr: true,
		console: true,
	},
});

console.log(`✅ Flow UI ready at http://localhost:${PORT}`);
console.log("   Connect to WebSocket channel at ws://localhost:3001/ws");
