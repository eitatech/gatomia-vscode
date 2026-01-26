/**
 * Template Variable Constants and Standard Variable Definitions
 *
 * Defines all standard template variables available for hook arguments,
 * organized by category (standard, spec-specific, file-specific, etc.).
 *
 * Template Syntax: {variableName}
 * Example: "Review spec {specId} changed to {newStatus} by {changeAuthor}"
 *
 * @see specs/011-custom-agent-hooks/contracts/template-variable-schema.ts
 * @see specs/011-custom-agent-hooks/data-model.md
 */

import type { OperationType } from "./types";

// ============================================================================
// Template Variable Types
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
	availableFor: OperationType[]; // Trigger types that provide this variable (empty = all)
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

// ============================================================================
// Standard Variables (Available for All Triggers)
// ============================================================================

/**
 * Standard variables available for all trigger types
 * @see specs/011-custom-agent-hooks/data-model.md:L129-L132
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
		defaultValue: "",
		example: "john-doe",
		category: "user",
	},
	{
		name: "branch",
		description: "Current git branch",
		valueType: "string",
		availableFor: [],
		required: false,
		defaultValue: "",
		example: "011-custom-agent-hooks",
		category: "git",
	},
	{
		name: "feature",
		description: "Current feature name",
		valueType: "string",
		availableFor: [],
		required: false,
		defaultValue: "",
		example: "custom-agent-hooks",
		category: "standard",
	},
];

// ============================================================================
// Spec-Specific Variables
// ============================================================================

/**
 * Spec-related variables (for spec status change triggers)
 * @see specs/011-custom-agent-hooks/data-model.md:L134-L139
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
			"research",
			"datamodel",
			"design",
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
			"research",
			"datamodel",
			"design",
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
		defaultValue: "",
		example: "draft",
		category: "spec",
	},
	{
		name: "newStatus",
		description: "Current spec status",
		valueType: "string",
		availableFor: ["clarify", "plan", "tasks"],
		required: false,
		defaultValue: "",
		example: "review",
		category: "spec",
	},
	{
		name: "changeAuthor",
		description: "User who triggered the change",
		valueType: "string",
		availableFor: ["clarify", "plan", "tasks"],
		required: false,
		defaultValue: "",
		example: "john-doe",
		category: "user",
	},
];

// ============================================================================
// File-Specific Variables
// ============================================================================

/**
 * File operation variables (for file save triggers)
 * @see specs/011-custom-agent-hooks/data-model.md:L141-L144
 */
export const FILE_VARIABLES: TemplateVariable[] = [
	{
		name: "filePath",
		description: "Absolute path to file",
		valueType: "path",
		availableFor: [], // TODO: Define file trigger types when file watching is implemented
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

// ============================================================================
// Aggregated Variable Collections
// ============================================================================

/**
 * All registered template variables
 */
export const ALL_TEMPLATE_VARIABLES: TemplateVariable[] = [
	...STANDARD_VARIABLES,
	...SPEC_VARIABLES,
	...FILE_VARIABLES,
];

/**
 * Variables grouped by category for UI rendering
 */
export const VARIABLES_BY_CATEGORY: Record<
	TemplateVariableCategory,
	TemplateVariable[]
> = {
	standard: ALL_TEMPLATE_VARIABLES.filter((v) => v.category === "standard"),
	spec: ALL_TEMPLATE_VARIABLES.filter((v) => v.category === "spec"),
	file: ALL_TEMPLATE_VARIABLES.filter((v) => v.category === "file"),
	git: ALL_TEMPLATE_VARIABLES.filter((v) => v.category === "git"),
	user: ALL_TEMPLATE_VARIABLES.filter((v) => v.category === "user"),
};

// ============================================================================
// Template Parsing Configuration
// ============================================================================

/**
 * Template variable regex pattern
 * Matches: {variableName}
 * Captures: variableName (group 1)
 * @see specs/011-custom-agent-hooks/research.md:L164-L180 (custom regex chosen)
 */
export const TEMPLATE_VARIABLE_PATTERN = /\{([a-zA-Z0-9_]+)\}/g;

/**
 * Valid variable name pattern
 * Alphanumeric and underscores only
 */
export const VALID_VARIABLE_NAME_PATTERN = /^[a-zA-Z0-9_]+$/;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get all variables available for a specific trigger type
 * @param triggerType Type of trigger
 * @returns Array of variables available for this trigger
 */
export function getVariablesForTrigger(
	triggerType: OperationType
): TemplateVariable[] {
	return ALL_TEMPLATE_VARIABLES.filter(
		(variable) =>
			variable.availableFor.length === 0 || // Available for all
			variable.availableFor.includes(triggerType)
	);
}

/**
 * Get variable definition by name
 * @param name Variable name (without braces)
 * @returns Variable definition or undefined if not found
 */
export function getVariableByName(name: string): TemplateVariable | undefined {
	return ALL_TEMPLATE_VARIABLES.find((v) => v.name === name);
}

/**
 * Check if a variable name is valid
 * @param name Variable name to validate
 * @returns True if name follows valid pattern
 */
export function isValidVariableName(name: string): boolean {
	return VALID_VARIABLE_NAME_PATTERN.test(name);
}
