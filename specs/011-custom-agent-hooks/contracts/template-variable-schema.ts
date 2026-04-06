/**
 * Template Variable Schema Contract
 * 
 * Defines interfaces for template variable parsing, substitution,
 * and validation in hook arguments.
 * 
 * Template Syntax: {variableName}
 * Example: "Review spec {specId} changed to {newStatus} by {changeAuthor}"
 */

import type { OperationType } from "../../../src/features/hooks/types";

// ============================================================================
// Core Parser Interface
// ============================================================================

/**
 * ITemplateVariableParser - Parses and substitutes template variables
 * 
 * Responsibilities:
 * - Extract variable references from template strings
 * - Validate variable availability for trigger context
 * - Perform variable substitution at runtime
 * - Handle missing variables gracefully (replace with empty string)
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
// Data Structures
// ============================================================================

/**
 * TemplateVariable - Definition of a template variable
 */
export interface TemplateVariable {
	// Identity
	name: string; // Variable name (without braces)

	// Metadata
	description: string; // Human-readable description
	valueType: TemplateValueType; // Expected value type

	// Availability
	availableFor: OperationType[]; // Trigger types that provide this variable
	required: boolean; // Always present for specified triggers?

	// Default behavior
	defaultValue?: string; // Value if unavailable (default: empty string)

	// Display
	example?: string; // Example value for UI display
	category?: TemplateVariableCategory; // Grouping for UI organization
}

/**
 * TemplateValueType - Expected data type of variable value
 */
export type TemplateValueType =
	| "string" // Text value
	| "number" // Numeric value
	| "boolean" // True/false
	| "timestamp" // ISO 8601 timestamp
	| "path" // File system path
	| "url"; // URL string

/**
 * TemplateVariableCategory - Logical grouping for UI
 */
export type TemplateVariableCategory =
	| "standard" // Available for all triggers
	| "spec" // Spec-related triggers
	| "file" // File operation triggers
	| "git" // Git operation triggers
	| "user"; // User/author information

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
// Standard Template Variables Registry
// ============================================================================

/**
 * Standard variables available for all trigger types
 */
export const STANDARD_VARIABLES: TemplateVariable[] = [
	{
		name: "timestamp",
		description: "ISO 8601 timestamp when trigger fired",
		valueType: "timestamp",
		availableFor: [], // Empty = all triggers
		required: true,
		example: "2026-01-26T10:30:00Z",
		category: "standard",
	},
	{
		name: "triggerType",
		description: "Type of trigger operation",
		valueType: "string",
		availableFor: [],
		required: true,
		example: "clarify",
		category: "standard",
	},
	{
		name: "user",
		description: "Git user name from config",
		valueType: "string",
		availableFor: [],
		required: false,
		example: "john-doe",
		category: "user",
	},
	{
		name: "branch",
		description: "Current git branch",
		valueType: "string",
		availableFor: [],
		required: false,
		example: "011-custom-agent-hooks",
		category: "git",
	},
	{
		name: "feature",
		description: "Current feature name",
		valueType: "string",
		availableFor: [],
		required: false,
		example: "custom-agent-hooks",
		category: "standard",
	},
];

/**
 * Spec-related variables (for spec status change triggers)
 */
export const SPEC_VARIABLES: TemplateVariable[] = [
	{
		name: "specId",
		description: "Spec identifier",
		valueType: "string",
		availableFor: [
			"specify",
			"clarify",
			"plan",
			"tasks",
			"analyze",
			"checklist",
		],
		required: true,
		example: "011-custom-agent-hooks",
		category: "spec",
	},
	{
		name: "specPath",
		description: "Absolute path to spec file",
		valueType: "path",
		availableFor: [
			"specify",
			"clarify",
			"plan",
			"tasks",
			"analyze",
			"checklist",
		],
		required: true,
		example: "/path/to/specs/011-custom-agent-hooks/spec.md",
		category: "spec",
	},
	{
		name: "oldStatus",
		description: "Previous spec status",
		valueType: "string",
		availableFor: ["clarify", "plan", "tasks"],
		required: false,
		example: "draft",
		category: "spec",
	},
	{
		name: "newStatus",
		description: "Current spec status",
		valueType: "string",
		availableFor: ["clarify", "plan", "tasks"],
		required: false,
		example: "review",
		category: "spec",
	},
	{
		name: "changeAuthor",
		description: "User who triggered the change",
		valueType: "string",
		availableFor: ["clarify", "plan", "tasks"],
		required: false,
		example: "john-doe",
		category: "user",
	},
];

/**
 * File operation variables (for file save triggers)
 */
export const FILE_VARIABLES: TemplateVariable[] = [
	{
		name: "filePath",
		description: "Absolute path to file",
		valueType: "path",
		availableFor: [], // TODO: Define file trigger types
		required: true,
		example: "/path/to/project/src/index.ts",
		category: "file",
	},
	{
		name: "fileName",
		description: "File name with extension",
		valueType: "string",
		availableFor: [],
		required: true,
		example: "index.ts",
		category: "file",
	},
	{
		name: "fileExt",
		description: "File extension without dot",
		valueType: "string",
		availableFor: [],
		required: true,
		example: "ts",
		category: "file",
	},
	{
		name: "fileDir",
		description: "Directory containing file",
		valueType: "path",
		availableFor: [],
		required: true,
		example: "/path/to/project/src",
		category: "file",
	},
];

/**
 * All registered template variables
 */
export const ALL_TEMPLATE_VARIABLES: TemplateVariable[] = [
	...STANDARD_VARIABLES,
	...SPEC_VARIABLES,
	...FILE_VARIABLES,
];

// ============================================================================
// Context Builder Interface
// ============================================================================

/**
 * ITemplateContextBuilder - Builds context from trigger events
 * 
 * Responsibilities:
 * - Extract context data from trigger events
 * - Populate standard variables
 * - Add trigger-specific variables
 * - Format values appropriately
 */
export interface ITemplateContextBuilder {
	/**
	 * Build context for a specific trigger event
	 * @param triggerType Type of trigger
	 * @param eventData Trigger event data
	 * @returns Populated template context
	 */
	buildContext(
		triggerType: OperationType,
		eventData: TriggerEventData
	): TemplateContext;

	/**
	 * Add standard variables to context
	 * @param context Context to populate
	 */
	addStandardVariables(context: TemplateContext): void;

	/**
	 * Add trigger-specific variables to context
	 * @param context Context to populate
	 * @param triggerType Type of trigger
	 * @param eventData Trigger event data
	 */
	addTriggerVariables(
		context: TemplateContext,
		triggerType: OperationType,
		eventData: TriggerEventData
	): void;
}

/**
 * TriggerEventData - Raw event data from trigger
 */
export interface TriggerEventData {
	// Event metadata
	timestamp: number; // Unix timestamp (milliseconds)

	// Dynamic event data
	[key: string]: unknown;
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Regex pattern for extracting template variables
 * Matches: {variableName}
 * Captures: variableName (alphanumeric and underscore only)
 */
export const TEMPLATE_VARIABLE_PATTERN = /\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g;

/**
 * Regex pattern for validating variable names
 * Must start with letter or underscore, followed by alphanumeric or underscore
 */
export const VARIABLE_NAME_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

/**
 * Maximum template string length
 */
export const MAX_TEMPLATE_LENGTH = 1000;

/**
 * Maximum variable name length
 */
export const MAX_VARIABLE_NAME_LENGTH = 50;

/**
 * Default value for missing variables
 */
export const DEFAULT_MISSING_VALUE = "";

/**
 * Extract variable names from template string
 * @param template Template string with {variable} syntax
 * @returns Array of unique variable names
 */
export function extractVariableNames(template: string): string[] {
	const matches = [...template.matchAll(TEMPLATE_VARIABLE_PATTERN)];
	const names = matches.map((match) => match[1]);
	return [...new Set(names)]; // Remove duplicates
}

/**
 * Check if template contains any variables
 * @param template Template string to check
 * @returns True if template has at least one variable
 */
export function hasVariables(template: string): boolean {
	return TEMPLATE_VARIABLE_PATTERN.test(template);
}

/**
 * Escape special regex characters in string
 * @param str String to escape
 * @returns Escaped string safe for regex
 */
export function escapeRegex(str: string): string {
	return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Get variable definition by name
 * @param name Variable name
 * @returns Variable definition or undefined if not found
 */
export function getVariableDefinition(
	name: string
): TemplateVariable | undefined {
	return ALL_TEMPLATE_VARIABLES.find((v) => v.name === name);
}

/**
 * Get all variables available for a trigger type
 * @param triggerType Type of trigger
 * @returns Array of available variables
 */
export function getVariablesForTrigger(
	triggerType: OperationType
): TemplateVariable[] {
	return ALL_TEMPLATE_VARIABLES.filter(
		(v) =>
			v.availableFor.length === 0 || // Available for all triggers
			v.availableFor.includes(triggerType) // Available for specific trigger
	);
}

/**
 * Check if variable is available for trigger type
 * @param variableName Variable name to check
 * @param triggerType Type of trigger
 * @returns True if variable is available
 */
export function isVariableAvailable(
	variableName: string,
	triggerType: OperationType
): boolean {
	const variable = getVariableDefinition(variableName);
	if (!variable) {
		return false;
	}

	return (
		variable.availableFor.length === 0 ||
		variable.availableFor.includes(triggerType)
	);
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
 * Type guard for TemplateVariable
 */
export function isTemplateVariable(obj: unknown): obj is TemplateVariable {
	if (typeof obj !== "object" || obj === null) {
		return false;
	}

	const variable = obj as TemplateVariable;

	return (
		typeof variable.name === "string" &&
		typeof variable.description === "string" &&
		typeof variable.valueType === "string" &&
		Array.isArray(variable.availableFor) &&
		typeof variable.required === "boolean"
	);
}
