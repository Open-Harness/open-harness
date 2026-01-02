// Flow bindings (A3)
// Implements docs/flow/bindings.md

export type BindingContext = {
	flow: { input?: Record<string, unknown> };
	[key: string]: unknown;
};

export interface BindingResolution {
	found: boolean;
	value?: unknown;
}

export function resolveBindingPath(
	context: BindingContext,
	path: string,
): BindingResolution {
	const segments = path.split(".").filter((segment) => segment.length > 0);
	let current: unknown = context;

	for (const segment of segments) {
		if (current && typeof current === "object" && segment in current) {
			current = (current as Record<string, unknown>)[segment];
		} else {
			return { found: false };
		}
	}

	if (current === null || current === undefined) {
		return { found: false };
	}

	return { found: true, value: current };
}

function parseDefaultValue(raw: string): unknown {
	try {
		return JSON.parse(raw);
	} catch (_error) {
		throw new Error(`Invalid default JSON literal: ${raw}`);
	}
}

export function resolveBindingString(
	template: string,
	context: BindingContext,
): string {
	const regex = /{{([^}]+)}}/g;
	let result = "";
	let lastIndex = 0;
	let match = regex.exec(template);

	while (match !== null) {
		result += template.slice(lastIndex, match.index);
		lastIndex = regex.lastIndex;

		const raw = match[1]?.trim() ?? "";
		const parts = raw.split("|").map((part) => part.trim());
		let path = parts[0] ?? "";
		let optional = false;

		if (path.startsWith("?")) {
			optional = true;
			path = path.slice(1).trim();
		}

		let defaultValue: unknown;
		const defaultPart = parts.find((part) => part.startsWith("default:"));
		if (defaultPart) {
			const rawDefault = defaultPart.slice("default:".length).trim();
			defaultValue = parseDefaultValue(rawDefault);
		}

		const resolved = resolveBindingPath(context, path);
		let replacement: string;
		if (!resolved.found) {
			if (defaultPart) {
				replacement = String(defaultValue ?? "");
			} else if (optional) {
				replacement = "";
			} else {
				throw new Error(`Missing binding path: ${path}`);
			}
		} else {
			replacement = String(resolved.value);
		}

		result += replacement;

		match = regex.exec(template);
	}

	result += template.slice(lastIndex);
	return result;
}

/**
 * Check if a string is a pure binding expression (e.g., "{{ path }}")
 * vs a template with embedded bindings (e.g., "Hello {{ name }}!")
 */
function isPureBinding(template: string): boolean {
	const trimmed = template.trim();
	if (!trimmed.startsWith("{{") || !trimmed.endsWith("}}")) {
		return false;
	}
	// Check there's only one binding in the string
	const matches = trimmed.match(/{{[^}]+}}/g);
	return matches?.length === 1 && matches[0] === trimmed;
}

/**
 * Resolve a pure binding expression and return the raw value (not stringified)
 */
function resolvePureBinding(
	template: string,
	context: BindingContext,
): unknown {
	const match = template.match(/^{{\s*([^}]+?)\s*}}$/);
	if (!match) {
		throw new Error(`Invalid pure binding: ${template}`);
	}

	const raw = match[1]?.trim() ?? "";
	const parts = raw.split("|").map((part) => part.trim());
	let path = parts[0] ?? "";
	let optional = false;

	if (path.startsWith("?")) {
		optional = true;
		path = path.slice(1).trim();
	}

	let defaultValue: unknown;
	const defaultPart = parts.find((part) => part.startsWith("default:"));
	if (defaultPart) {
		const rawDefault = defaultPart.slice("default:".length).trim();
		try {
			defaultValue = JSON.parse(rawDefault);
		} catch {
			throw new Error(`Invalid default JSON literal: ${rawDefault}`);
		}
	}

	const resolved = resolveBindingPath(context, path);
	if (!resolved.found) {
		if (defaultPart) {
			return defaultValue;
		}
		if (optional) {
			return undefined;
		}
		throw new Error(`Missing binding path: ${path}`);
	}

	return resolved.value;
}

function resolveValue(value: unknown, context: BindingContext): unknown {
	if (typeof value === "string") {
		// If it's a pure binding like "{{ foo }}", return the raw value (could be array, object, etc.)
		if (isPureBinding(value)) {
			return resolvePureBinding(value, context);
		}
		// Otherwise, treat as a template string
		return resolveBindingString(value, context);
	}
	if (Array.isArray(value)) {
		return value.map((item) => resolveValue(item, context));
	}
	if (value && typeof value === "object") {
		const result: Record<string, unknown> = {};
		for (const [key, entry] of Object.entries(value)) {
			result[key] = resolveValue(entry, context);
		}
		return result;
	}
	return value;
}

export function resolveBindings<T extends Record<string, unknown>>(
	input: T,
	context: BindingContext,
): T {
	return resolveValue(input, context) as T;
}
