/**
 * Template Variable Parser
 *
 * Parses and substitutes template variables in hook arguments using the syntax: $variableName
 *
 * Features:
 * - Extract variable references from template strings
 * - Validate template syntax and variable availability
 * - Substitute variables with runtime context values
 * - Handle missing variables gracefully (replace with empty string)
 *
 * Template Syntax: $variableName
 * Example: "Review spec $specId changed to $newStatus by $changeAuthor"
 *
 * @see specs/011-custom-agent-hooks/contracts/template-variable-schema.ts
 * @see specs/011-custom-agent-hooks/data-model.md
 */

import type { OperationType } from "./types";
import {
	TEMPLATE_VARIABLE_PATTERN,
	type TemplateVariable,
	VALID_VARIABLE_NAME_PATTERN,
	getVariablesForTrigger,
} from "./template-variable-constants";

// ============================================================================
// Core Types
// ============================================================================

/**
 * TemplateContext - Runtime context providing variable values
 */
export interface TemplateContext {
	// Standard variables (always present)
	timestamp: string; // ISO 8601 format
	triggerType: OperationType; // Type of trigger

	// Optional standard variables
	user?: string; // Git user name
	branch?: string; // Current git branch
	feature?: string; // Current feature name

	// Output capture variables
	acpAgentOutput?: string; // Output produced by a local ACP agent hook action

	// Dynamic variables (populated based on trigger type)
	[key: string]: string | number | boolean | undefined;
}

/**
 * TemplateValidationResult - Result of template validation
 */
export interface TemplateValidationResult {
	valid: boolean; // Syntax and variable availability OK?
	errors: TemplateValidationError[]; // Syntax errors
	warnings: TemplateValidationWarning[]; // Missing variables (non-blocking)
}

/**
 * TemplateValidationError - Syntax error in template
 */
export interface TemplateValidationError {
	code: TemplateErrorCode;
	message: string; // Human-readable error
	position?: number; // Character position in template
	variable?: string; // Variable name (if applicable)
}

/**
 * TemplateValidationWarning - Non-blocking validation issue
 */
export interface TemplateValidationWarning {
	code: TemplateWarningCode;
	message: string; // Human-readable warning
	variable: string; // Variable name
	suggestion?: string; // How to fix the issue
}

/**
 * TemplateErrorCode - Syntax error types
 */
export type TemplateErrorCode =
	| "INVALID_VARIABLE_NAME" // $123abc or $var-name (invalid characters)
	| "EMPTY_VARIABLE" // $ with no name following
	| "DEPRECATED_VARIABLE"; // Variable will be removed in future

/**
 * TemplateWarningCode - Non-blocking issue types
 */
export type TemplateWarningCode =
	| "VARIABLE_NOT_AVAILABLE" // Variable not provided by trigger type
	| "VARIABLE_NOT_REQUIRED" // Variable may be missing at runtime
	| "DEPRECATED_VARIABLE"; // Variable will be removed in future

// ============================================================================
// Parser Interface
// ============================================================================

/**
 * ITemplateVariableParser - Parses and substitutes template variables
 */
export interface ITemplateVariableParser {
	/**
	 * Parse template string to extract all variable references
	 * @param template Template string with {variable} syntax
	 * @returns Array of extracted variable names
	 */
	extractVariables(template: string): string[];

	/**
	 * Substitute variables in template with values from context
	 * @param template Template string with {variable} syntax
	 * @param context Context object with variable values
	 * @returns Resolved string with variables replaced
	 */
	substitute(template: string, context: TemplateContext): string;

	/**
	 * Validate template string for syntax errors
	 * @param template Template string to validate
	 * @returns Validation result with errors if any
	 */
	validateSyntax(template: string): TemplateValidationResult;

	/**
	 * Validate that all variables in template are available for trigger type
	 * @param template Template string to validate
	 * @param triggerType Type of trigger that will provide context
	 * @returns Validation result with warnings for unavailable variables
	 */
	validateVariables(
		template: string,
		triggerType: OperationType
	): TemplateValidationResult;

	/**
	 * Get all available variables for a specific trigger type
	 * @param triggerType Type of trigger
	 * @returns Array of variable definitions available for this trigger
	 */
	getAvailableVariables(triggerType: OperationType): TemplateVariable[];
}

// ============================================================================
// Parser Implementation
// ============================================================================

/**
 * TemplateVariableParser - Implements template variable parsing and substitution
 *
 * Responsibilities:
 * - Extract variable references from template strings
 * - Validate template syntax and variable availability
 * - Substitute variables with runtime context values
 * - Handle missing variables gracefully (replace with empty string)
 *
 * Implementation phases:
 * - Phase 2 (T007): Skeleton with stub methods ✅ CURRENT
 * - Phase 4 (T032): Implement extractVariables() - TODO
 * - Phase 4 (T033): Implement validateSyntax() - TODO
 * - Phase 4 (T034): Implement substitute() - TODO
 */
export class TemplateVariableParser implements ITemplateVariableParser {
	// ============================================================================
	// Public API
	// ============================================================================

	/**
	 * Parse template string to extract all variable references
	 *
	 * TODO: Phase 4 (T032) - Implement variable extraction
	 * - Use TEMPLATE_VARIABLE_PATTERN regex to find all $variableName patterns
	 * - Extract variable names from capture groups
	 * - Remove duplicates and return unique variable names
	 * - Handle edge cases: empty template, no variables, etc.
	 *
	 * @param template Template string with $variable syntax
	 * @returns Array of extracted variable names
	 */
	extractVariables(template: string): string[] {
		// Handle empty template
		if (!template) {
			return [];
		}

		// Use regex to find all $variableName patterns
		// TEMPLATE_VARIABLE_PATTERN = /\$([a-zA-Z_][a-zA-Z0-9_]*)/g
		const matches = template.matchAll(TEMPLATE_VARIABLE_PATTERN);

		// Extract variable names from capture groups
		const variables = Array.from(matches).map((match) => match[1]);

		// Remove duplicates and return unique variable names
		return [...new Set(variables)];
	}

	/**
	 * Substitute variables in template with values from context
	 *
	 * TODO: Phase 4 (T034) - Implement variable substitution
	 * - Use TEMPLATE_VARIABLE_PATTERN regex to find all $variableName patterns
	 * - Replace each pattern with corresponding context value
	 * - Use empty string for missing variables (graceful degradation)
	 * - Handle type coercion (convert numbers/booleans to strings)
	 * - Preserve original template if no variables found
	 *
	 * @param template Template string with $variable syntax
	 * @param context Context object with variable values
	 * @returns Resolved string with variables replaced
	 */
	substitute(template: string, context: TemplateContext): string {
		// Handle empty template
		if (!template) {
			return "";
		}

		// Replace each $variableName with corresponding context value
		// Use empty string for missing/undefined variables (graceful degradation)
		return template.replace(
			TEMPLATE_VARIABLE_PATTERN,
			(_match, variableName) => {
				const value = context[variableName];

				// Handle missing or undefined variables
				if (value === undefined || value === null) {
					return "";
				}

				// Convert non-string values to strings
				return String(value);
			}
		);
	}

	/**
	 * Validate template string for syntax errors
	 *
	 * @param template Template string to validate
	 * @returns Validation result with errors if any
	 */
	validateSyntax(template: string): TemplateValidationResult {
		const errors: TemplateValidationError[] = [];

		// Handle empty template (valid)
		if (!template) {
			return { valid: true, errors: [], warnings: [] };
		}

		// Check for invalid variable names
		const matches = Array.from(template.matchAll(TEMPLATE_VARIABLE_PATTERN));
		for (const match of matches) {
			const varName = match[1];
			if (!VALID_VARIABLE_NAME_PATTERN.test(varName)) {
				errors.push({
					code: "INVALID_VARIABLE_NAME",
					message: `Invalid variable name "$${varName}" - must start with letter or underscore, followed by letters, numbers, or underscores`,
					position: match.index,
					variable: varName,
				});
			}
		}

		// Check for empty variables ($ followed by whitespace or end of string)
		// This explicitly allows $100, $$$, etc. as literal text
		const emptyVarPattern = /\$(?=\s|$)/g;
		const emptyMatches = Array.from(template.matchAll(emptyVarPattern));
		for (const match of emptyMatches) {
			errors.push({
				code: "EMPTY_VARIABLE",
				message:
					"Empty variable name - $ must be followed by a valid identifier",
				position: match.index,
			});
		}

		return {
			valid: errors.length === 0,
			errors,
			warnings: [],
		};
	}

	/**
	 * Validate that all variables in template are available for trigger type
	 *
	 * TODO: Phase 4 (T034) - Implement variable availability validation
	 * - Extract variables from template using extractVariables()
	 * - Check if each variable is available for the given trigger type
	 * - Use getVariablesForTrigger() to get available variables
	 * - Generate warnings for unavailable variables
	 * - Generate warnings for optional variables (not required)
	 * - Return validation result with warnings
	 *
	 * @param template Template string to validate
	 * @param triggerType Type of trigger that will provide context
	 * @returns Validation result with warnings for unavailable variables
	 */
	validateVariables(
		template: string,
		triggerType: OperationType
	): TemplateValidationResult {
		// TODO: Phase 4 (T034) - Implement variable availability validation
		// Stub implementation: assume all variables available
		return {
			valid: true,
			errors: [],
			warnings: [],
		};
	}

	/**
	 * Get all available variables for a specific trigger type
	 *
	 * Implementation: Delegates to template-variable-constants helper
	 *
	 * @param triggerType Type of trigger
	 * @returns Array of variable definitions available for this trigger
	 */
	getAvailableVariables(triggerType: OperationType): TemplateVariable[] {
		return getVariablesForTrigger(triggerType);
	}
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard for TemplateContext
 */
export function isTemplateContext(obj: unknown): obj is TemplateContext {
	if (typeof obj !== "object" || obj === null) {
		return false;
	}

	const context = obj as TemplateContext;

	return (
		typeof context.timestamp === "string" &&
		typeof context.triggerType === "string"
	);
}

/**
 * Type guard for TemplateValidationResult
 */
export function isTemplateValidationResult(
	obj: unknown
): obj is TemplateValidationResult {
	if (typeof obj !== "object" || obj === null) {
		return false;
	}

	const result = obj as TemplateValidationResult;

	return (
		typeof result.valid === "boolean" &&
		Array.isArray(result.errors) &&
		Array.isArray(result.warnings)
	);
}
