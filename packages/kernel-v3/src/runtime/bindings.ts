/**
 * Context object used to resolve bindings.
 */
export type BindingContext = {
	flow?: { input?: Record<string, unknown> };
	state?: Record<string, unknown>;
	[key: string]: unknown;
};

/** Result of resolving a binding path. */
export type BindingResolution = {
	found: boolean;
	value?: unknown;
};

/**
 * Resolve a dotted path (e.g., "flow.input.foo") within a context.
 * @param context - Binding context.
 * @param path - Dotted path string.
 * @returns Binding resolution result.
 */
export function resolveBindingPath(context: BindingContext, path: string): BindingResolution {
	const segments = path.split(".").filter((segment) => segment.length > 0);
	let current: unknown = context;

	for (const segment of segments) {
		if (current && typeof current === "object" && segment in current) {
			current = (current as Record<string, unknown>)[segment];
		} else {
			return { found: false };
		}
	}

	if (current === undefined || current === null) {
		return { found: false };
	}

	return { found: true, value: current };
}

/**
 * Resolve a template string with {{ }} expressions.
 * @param template - Template string.
 * @param context - Binding context.
 * @returns Resolved string.
 */
export function resolveBindingString(template: string, context: BindingContext): string {
	const regex = /{{\s*([^}]+?)\s*}}/g;
	let result = "";
	let lastIndex = 0;
	let match = regex.exec(template);

	while (match !== null) {
		result += template.slice(lastIndex, match.index);
		lastIndex = regex.lastIndex;

		const raw = match[1]?.trim() ?? "";
		const resolved = resolveBindingPath(context, raw);
		if (!resolved.found) {
			throw new Error(`Missing binding path: ${raw}`);
		}
		result += String(resolved.value);
		match = regex.exec(template);
	}

	result += template.slice(lastIndex);
	return result;
}

/**
 * Resolve bindings recursively within an object.
 * @param input - Input object with binding expressions.
 * @param context - Binding context.
 * @returns Resolved object.
 */
export function resolveBindings<T extends Record<string, unknown>>(input: T, context: BindingContext): T {
	return resolveValue(input, context) as T;
}

function resolveValue(value: unknown, context: BindingContext): unknown {
	if (typeof value === "string") {
		if (isPureBinding(value)) {
			return resolvePureBinding(value, context);
		}
		return resolveBindingString(value, context);
	}
	if (Array.isArray(value)) {
		return value.map((entry) => resolveValue(entry, context));
	}
	if (value && typeof value === "object") {
		const out: Record<string, unknown> = {};
		for (const [key, entry] of Object.entries(value)) {
			out[key] = resolveValue(entry, context);
		}
		return out;
	}
	return value;
}

function isPureBinding(template: string): boolean {
	const trimmed = template.trim();
	if (!trimmed.startsWith("{{") || !trimmed.endsWith("}}")) {
		return false;
	}
	const matches = trimmed.match(/{{[^}]+}}/g);
	return matches?.length === 1 && matches[0] === trimmed;
}

function resolvePureBinding(template: string, context: BindingContext): unknown {
	const match = template.match(/^{{\s*([^}]+?)\s*}}$/);
	if (!match) {
		throw new Error(`Invalid binding expression: ${template}`);
	}
	const raw = match[1]?.trim() ?? "";
	const resolved = resolveBindingPath(context, raw);
	if (!resolved.found) {
		throw new Error(`Missing binding path: ${raw}`);
	}
	return resolved.value;
}
