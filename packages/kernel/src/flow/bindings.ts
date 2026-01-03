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

function resolveValue(value: unknown, context: BindingContext): unknown {
	if (typeof value === "string") {
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
