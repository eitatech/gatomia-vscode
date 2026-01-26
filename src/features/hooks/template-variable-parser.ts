/**
 * Template Variable Parser
 *
 * Parses and substitutes template variables in hook arguments using the syntax: {variableName}
 *
 * Features:
 * - Extract variable references from template strings
 * - Validate template syntax and variable availability
 * - Substitute variables with runtime context values
 * - Handle missing variables gracefully (replace with empty string)
 *
 * Template Syntax: {variableName}
 * Example: "Review spec {specId} changed to {newStatus} by {changeAuthor}"
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
	| "UNCLOSED_BRACE" // {variable without closing }
	| "UNOPENED_BRACE" // variable} without opening {
	| "EMPTY_VARIABLE" // {} with no name
	| "INVALID_VARIABLE_NAME" // {123abc} or {var-name} (invalid characters)
	| "NESTED_BRACES"; // {{variable}} or {var{iable}}

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
	 * - Use TEMPLATE_VARIABLE_PATTERN regex to find all {variableName} patterns
	 * - Extract variable names from capture groups
	 * - Remove duplicates and return unique variable names
	 * - Handle edge cases: empty template, no variables, etc.
	 *
	 * @param template Template string with {variable} syntax
	 * @returns Array of extracted variable names
	 */
	extractVariables(template: string): string[] {
		// Handle empty template
		if (!template) {
			return [];
		}

		// Use regex to find all {variableName} patterns
		// TEMPLATE_VARIABLE_PATTERN = /\{([a-zA-Z0-9_]+)\}/g
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
	 * - Use TEMPLATE_VARIABLE_PATTERN regex to find all {variableName} patterns
	 * - Replace each pattern with corresponding context value
	 * - Use empty string for missing variables (graceful degradation)
	 * - Handle type coercion (convert numbers/booleans to strings)
	 * - Preserve original template if no variables found
	 *
	 * @param template Template string with {variable} syntax
	 * @param context Context object with variable values
	 * @returns Resolved string with variables replaced
	 */
	substitute(template: string, context: TemplateContext): string {
		// Handle empty template
		if (!template) {
			return "";
		}

		// Replace each {variableName} with corresponding context value
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

		// Check for brace-related syntax errors
		const braceErrors = this.validateBraces(template);
		errors.push(...braceErrors);

		return {
			valid: errors.length === 0,
			errors,
			warnings: [],
		};
	}

	/**
	 * Validate braces and variable names in template
	 * @private
	 */
	private validateBraces(template: string): TemplateValidationError[] {
		const errors: TemplateValidationError[] = [];
		let braceDepth = 0;
		let lastOpenBrace = -1;

		for (let i = 0; i < template.length; i += 1) {
			const char = template[i];

			if (char === "{") {
				const openBraceError = this.handleOpenBrace(braceDepth, i);
				if (openBraceError) {
					errors.push(openBraceError);
				}
				braceDepth += 1;
				lastOpenBrace = i;
			} else if (char === "}") {
				const closeBraceErrors = this.handleCloseBrace(
					braceDepth,
					i,
					lastOpenBrace,
					template
				);
				errors.push(...closeBraceErrors);
				if (braceDepth > 0) {
					braceDepth -= 1;
				}
			}
		}

		// Check for unclosed braces at end
		if (braceDepth > 0) {
			errors.push({
				code: "UNCLOSED_BRACE",
				message: "Opening brace '{' without matching closing brace '}'",
				position: lastOpenBrace,
			});
		}

		return errors;
	}

	/**
	 * Handle opening brace validation
	 * @private
	 */
	private handleOpenBrace(
		braceDepth: number,
		position: number
	): TemplateValidationError | null {
		if (braceDepth > 0) {
			// Nested opening brace
			return {
				code: "NESTED_BRACES",
				message: "Nested braces are not allowed",
				position,
			};
		}
		return null;
	}

	/**
	 * Handle closing brace validation
	 * @private
	 */
	private handleCloseBrace(
		braceDepth: number,
		position: number,
		lastOpenBrace: number,
		template: string
	): TemplateValidationError[] {
		const errors: TemplateValidationError[] = [];

		if (braceDepth === 0) {
			// Closing brace without opening
			errors.push({
				code: "UNOPENED_BRACE",
				message: "Closing brace '}' without matching opening brace '{'",
				position,
			});
		} else if (position === lastOpenBrace + 1) {
			// Check for empty variable: {}
			errors.push({
				code: "EMPTY_VARIABLE",
				message: "Empty variable name: {}",
				position: lastOpenBrace,
			});
		} else {
			// Validate variable name
			const variableName = template.substring(lastOpenBrace + 1, position);
			if (!VALID_VARIABLE_NAME_PATTERN.test(variableName)) {
				errors.push({
					code: "INVALID_VARIABLE_NAME",
					message: `Invalid variable name: {${variableName}}. Variable names must contain only letters, numbers, and underscores.`,
					position: lastOpenBrace,
					variable: variableName,
				});
			}
		}

		return errors;
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
