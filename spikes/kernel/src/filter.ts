import type { EventFilter } from "./events.js";

// Minimal event filter matcher:
// - "*" matches all
// - "task:*" matches prefix
// - exact matches
// - array means "any"
export function matchesFilter(type: string, filter: EventFilter): boolean {
	if (Array.isArray(filter)) return filter.some((f) => matchesFilter(type, f));
	if (filter === "*" || filter === "") return true;
	if (filter.endsWith(":*")) return type.startsWith(filter.slice(0, -1)); // keep trailing ':'
	return type === filter;
}
