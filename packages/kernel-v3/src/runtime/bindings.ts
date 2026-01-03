export type BindingContext = {
  flow?: { input?: Record<string, unknown> };
  [key: string]: unknown;
};

export type BindingResolution = {
  found: boolean;
  value?: unknown;
};

export declare function resolveBindingPath(
  context: BindingContext,
  path: string,
): BindingResolution;

export declare function resolveBindingString(
  template: string,
  context: BindingContext,
): string;

export declare function resolveBindings<T extends Record<string, unknown>>(
  input: T,
  context: BindingContext,
): T;
