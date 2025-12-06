/**
 * MCP Parameter Resolver Service
 *
 * Resolves parameter mappings from hook context to MCP tool parameters.
 * Supports context variables, literal values, and template expansion.
 */

import { expandTemplate } from "../template-utils";
import type {
	IMCPParameterResolver,
	ParameterMapping,
	TemplateContext,
} from "./mcp-contracts";

/**
 * MCPParameterResolver implementation
 *
 * Resolves parameter mappings by extracting values from template context,
 * using literal values, or expanding template strings.
 */
export class MCPParameterResolver implements IMCPParameterResolver {
	/**
	 * Resolve parameter mappings using template context
	 * @param mappings - Parameter mapping definitions
	 * @param context - Template context (feature, branch, etc.)
	 * @returns Resolved parameters as key-value pairs
	 */
	resolve(
		mappings: ParameterMapping[],
		context: TemplateContext
	): Record<string, unknown> {
		const resolved: Record<string, unknown> = {};

		for (const mapping of mappings) {
			const value = this.resolveSingle(mapping, context);
			resolved[mapping.toolParam] = value;
		}

		return resolved;
	}

	/**
	 * Resolve a single parameter mapping
	 * @param mapping - Single parameter mapping
	 * @param context - Template context
	 * @returns Resolved value (string, number, boolean, etc.)
	 */
	resolveSingle(mapping: ParameterMapping, context: TemplateContext): unknown {
		switch (mapping.source) {
			case "context":
				// Extract value directly from context by key
				return this.resolveFromContext(mapping.value, context);

			case "literal":
				// Use the value as-is (literal string)
				return mapping.value;

			case "template":
				// Expand template variables (e.g., "{{feature}}" -> "mcp-hooks")
				return expandTemplate(mapping.value, context);

			default:
				// Unknown source type - return value as-is
				return mapping.value;
		}
	}

	/**
	 * Resolve a value from template context by key
	 * @param key - Context key (e.g., "feature", "branch")
	 * @param context - Template context
	 * @returns Context value or undefined if not found
	 */
	private resolveFromContext(key: string, context: TemplateContext): unknown {
		// Handle direct context keys
		if (key in context) {
			return context[key as keyof TemplateContext];
		}

		// Key not found in context
		return;
	}
}
