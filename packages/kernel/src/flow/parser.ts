// Flow YAML parser
// Implements docs/flow/flow-spec.md

import { parse } from "yaml";
import type { FlowYamlValidated } from "./validator.js";
import { validateFlowYaml } from "./validator.js";

export function parseFlowYaml(source: string): FlowYamlValidated {
	const parsed = parse(source) as unknown;
	return validateFlowYaml(parsed);
}
