import type { ChangeEvent } from "react";
import { useCallback, useMemo, useState } from "react";
import type { OperationType } from "../types";

/**
 * ArgumentTemplateEditor - Rich text editor for hook arguments with template variable support
 *
 * Provides:
 * - Text input for agent commands
 * - Real-time syntax validation for template variables
 * - Display of available variables for current trigger type
 * - Inline error display
 * - VSCode theming integration
 *
 * Template Syntax: {variableName}
 * Example: "/speckit.clarify --spec {specId} --author {changeAuthor}"
 *
 * @see specs/011-custom-agent-hooks/tasks.md:T040-T041
 */

// ============================================================================
// Template Variable Types (copied from backend for UI use)
// ============================================================================

interface TemplateVariable {
	name: string;
	description: string;
	valueType: string;
	availableFor: OperationType[];
	required: boolean;
	example?: string;
	category?: string;
}

// ============================================================================
// Template Validation (ported from backend parser)
// ============================================================================

const TEMPLATE_VARIABLE_PATTERN = /\{([a-zA-Z0-9_]+)\}/g;
const VALID_VARIABLE_NAME_PATTERN = /^[a-zA-Z0-9_]+$/;
const NESTED_BRACES_PATTERN = /\{\{|\}\}/;
const EMPTY_VARIABLE_PATTERN = /\{\s*\}/;

interface ValidationError {
	message: string;
	position?: number;
}

/**
 * Validate template syntax and return any errors
 * Ported from: src/features/hooks/template-variable-parser.ts
 */
function validateTemplateSyntax(template: string): ValidationError | null {
	// Check for unclosed braces
	const openBraces = (template.match(/\{/g) || []).length;
	const closeBraces = (template.match(/\}/g) || []).length;
	if (openBraces !== closeBraces) {
		return {
			message: "Unclosed braces - ensure all { have matching }",
		};
	}

	// Check for invalid variable names
	const matches = Array.from(template.matchAll(TEMPLATE_VARIABLE_PATTERN));
	for (const match of matches) {
		const varName = match[1];
		if (!VALID_VARIABLE_NAME_PATTERN.test(varName)) {
			return {
				message: `Invalid variable name "${varName}" - use only letters, numbers, and underscores`,
				position: match.index,
			};
		}
	}

	// Check for nested braces
	if (NESTED_BRACES_PATTERN.test(template)) {
		return {
			message: "Nested braces not allowed - use single { } for variables",
		};
	}

	// Check for empty variable names
	if (EMPTY_VARIABLE_PATTERN.test(template)) {
		return {
			message: "Empty variable name - provide a name between { }",
		};
	}

	return null;
}

/**
 * Extract variable names from template
 */
function extractVariables(template: string): string[] {
	const matches = Array.from(template.matchAll(TEMPLATE_VARIABLE_PATTERN));
	return matches.map((m) => m[1]);
}

// ============================================================================
// Variable Definitions (subset from backend constants)
// ============================================================================

const STANDARD_VARIABLES: TemplateVariable[] = [
	{
		name: "timestamp",
		description: "ISO 8601 timestamp when trigger fired",
		valueType: "timestamp",
		availableFor: [],
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

const SPEC_VARIABLES: TemplateVariable[] = [
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

const ALL_VARIABLES = [...STANDARD_VARIABLES, ...SPEC_VARIABLES];

/**
 * Get variables available for a specific trigger type
 */
function getVariablesForTrigger(
	triggerType: OperationType
): TemplateVariable[] {
	return ALL_VARIABLES.filter(
		(v) => v.availableFor.length === 0 || v.availableFor.includes(triggerType)
	);
}

// ============================================================================
// Component Props
// ============================================================================

interface ArgumentTemplateEditorProps {
	value: string;
	onChange: (value: string) => void;
	triggerType: OperationType;
	error?: string;
	disabled?: boolean;
	placeholder?: string;
}

// ============================================================================
// Component
// ============================================================================

export const ArgumentTemplateEditor = ({
	value,
	onChange,
	triggerType,
	error,
	disabled = false,
	placeholder = "Enter command with {variables}",
}: ArgumentTemplateEditorProps) => {
	const [validationError, setValidationError] = useState<string>();
	const [showVariableHints, setShowVariableHints] = useState(false);

	// Get available variables for current trigger type
	const availableVariables = useMemo(
		() => getVariablesForTrigger(triggerType),
		[triggerType]
	);

	// Extract used variables from current value
	const usedVariables = useMemo(() => extractVariables(value), [value]);

	// Handle input change with validation
	const handleChange = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			const newValue = event.target.value;
			onChange(newValue);

			// Validate syntax
			const validationResult = validateTemplateSyntax(newValue);
			setValidationError(validationResult?.message);
		},
		[onChange]
	);

	// Handle focus to show variable hints
	const handleFocus = useCallback(() => {
		setShowVariableHints(true);
	}, []);

	// Handle blur to hide variable hints (with delay to allow clicking)
	const handleBlur = useCallback(() => {
		setTimeout(() => setShowVariableHints(false), 200);
	}, []);

	// Insert variable at cursor position
	const handleInsertVariable = useCallback(
		(varName: string) => {
			const input = document.getElementById(
				"action-command"
			) as HTMLInputElement;
			if (!input) {
				return;
			}

			const start = input.selectionStart ?? value.length;
			const end = input.selectionEnd ?? value.length;
			const newValue = `${value.slice(0, start)}{${varName}}${value.slice(end)}`;

			onChange(newValue);

			// Restore focus and move cursor after inserted variable
			setTimeout(() => {
				input.focus();
				const newCursorPos = start + varName.length + 2; // +2 for braces
				input.setSelectionRange(newCursorPos, newCursorPos);
			}, 0);
		},
		[value, onChange]
	);

	const displayError = error || validationError;

	return (
		<div className="flex flex-col gap-2">
			<input
				className="rounded border border-[color:var(--vscode-input-border)] bg-[color:var(--vscode-input-background)] px-3 py-2 font-mono text-[color:var(--vscode-input-foreground)] text-sm focus:border-[color:var(--vscode-focusBorder)] focus:outline-none"
				disabled={disabled}
				id="action-command"
				onBlur={handleBlur}
				onChange={handleChange}
				onFocus={handleFocus}
				placeholder={placeholder}
				type="text"
				value={value}
			/>

			{/* Error Display */}
			{displayError && (
				<span className="text-[color:var(--vscode-errorForeground)] text-xs">
					{displayError}
				</span>
			)}

			{/* Variable Hints Section */}
			{showVariableHints && availableVariables.length > 0 && (
				<div className="rounded border border-[color:var(--vscode-panel-border)] bg-[color:var(--vscode-sideBar-background)] p-2 text-xs">
					<div className="mb-2 font-medium text-[color:var(--vscode-foreground)]">
						Available Variables
					</div>
					<div className="flex flex-wrap gap-1">
						{availableVariables.map((variable) => {
							const isUsed = usedVariables.includes(variable.name);
							return (
								<button
									className={`rounded px-2 py-1 text-xs transition-colors ${
										isUsed
											? "bg-[color:var(--vscode-button-secondaryBackground)] text-[color:var(--vscode-button-secondaryForeground)] opacity-50"
											: "bg-[color:var(--vscode-button-secondaryBackground)] text-[color:var(--vscode-button-secondaryForeground)] hover:bg-[color:var(--vscode-button-secondaryHoverBackground)]"
									}`}
									key={variable.name}
									onClick={() => handleInsertVariable(variable.name)}
									title={`${variable.description}\nExample: ${variable.example || "N/A"}`}
									type="button"
								>
									{`{${variable.name}}`}
								</button>
							);
						})}
					</div>
					{usedVariables.length > 0 && (
						<div className="mt-2 border-[color:var(--vscode-panel-border)] border-t pt-2 text-[color:var(--vscode-descriptionForeground)]">
							Using: {usedVariables.map((v) => `{${v}}`).join(", ")}
						</div>
					)}
				</div>
			)}

			{/* Help Text */}
			<p className="text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.6))] text-xs">
				Use <span className="font-mono">{"{variableName}"}</span> syntax to
				insert dynamic values. Click a variable below to insert it.
			</p>
		</div>
	);
};
