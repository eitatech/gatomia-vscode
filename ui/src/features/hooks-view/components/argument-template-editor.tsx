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
 * Template Syntax: $variableName
 * Example: "/speckit.clarify --spec $specId --author $changeAuthor"
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

const TEMPLATE_VARIABLE_PATTERN = /\$([a-zA-Z_][a-zA-Z0-9_]*)/g;
const VALID_VARIABLE_NAME_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
const EMPTY_VARIABLE_PATTERN = /\$(?![a-zA-Z_])/;

interface ValidationError {
	message: string;
	position?: number;
}

/**
 * Validate template syntax and return any errors
 * Ported from: src/features/hooks/template-variable-parser.ts
 */
function validateTemplateSyntax(template: string): ValidationError | null {
	// Check for invalid variable names
	const matches = Array.from(template.matchAll(TEMPLATE_VARIABLE_PATTERN));
	for (const match of matches) {
		const varName = match[1];
		if (!VALID_VARIABLE_NAME_PATTERN.test(varName)) {
			return {
				message: `Invalid variable name "$${varName}" - must start with letter or underscore`,
				position: match.index,
			};
		}
	}

	// Check for empty variables (lone $ without identifier)
	if (EMPTY_VARIABLE_PATTERN.test(template)) {
		return {
			message: "Empty variable name - $ must be followed by a valid identifier",
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
	{
		name: "workspacePath",
		description: "Absolute path to workspace root",
		valueType: "path",
		availableFor: [],
		required: true,
		example: "/Users/john/projects/my-app",
		category: "standard",
	},
	{
		name: "repoOwner",
		description: "GitHub repository owner/organization",
		valueType: "string",
		availableFor: [],
		required: false,
		example: "anomalyco",
		category: "git",
	},
	{
		name: "repoName",
		description: "GitHub repository name",
		valueType: "string",
		availableFor: [],
		required: false,
		example: "gatomia-vscode",
		category: "git",
	},
	{
		name: "agentId",
		description: "ID of the agent being invoked",
		valueType: "string",
		availableFor: [],
		required: false,
		example: "custom-review-agent",
		category: "standard",
	},
	{
		name: "agentType",
		description: "Execution type of agent (local or background)",
		valueType: "string",
		availableFor: [],
		required: false,
		example: "local",
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
	{
		name: "useCaseId",
		description: "Current use case identifier (if in use case context)",
		valueType: "string",
		availableFor: ["specify", "clarify", "plan"],
		required: false,
		example: "uc-001-user-authentication",
		category: "spec",
	},
	{
		name: "taskId",
		description: "Current task identifier (if in task context)",
		valueType: "string",
		availableFor: ["tasks", "plan"],
		required: false,
		example: "t-042-implement-login",
		category: "spec",
	},
	{
		name: "requirementId",
		description: "Current requirement identifier (if in requirement context)",
		valueType: "string",
		availableFor: ["specify", "clarify"],
		required: false,
		example: "req-003-secure-auth",
		category: "spec",
	},
];

const OUTPUT_VARIABLES: TemplateVariable[] = [
	{
		name: "agentOutput",
		description:
			"Output from triggering agent (file content for spec operations)",
		valueType: "string",
		availableFor: [
			"specify",
			"plan",
			"tasks",
			"research",
			"datamodel",
			"design",
			"clarify",
			"analyze",
			"checklist",
		],
		required: false,
		example: "# Specification\\n\\n## Use Case 1...",
		category: "trigger",
	},
	{
		name: "clipboardContent",
		description: "Current clipboard content (manual user copy)",
		valueType: "string",
		availableFor: [], // Available for all triggers
		required: false,
		example: "Copied text from Copilot Chat",
		category: "trigger",
	},
	{
		name: "outputPath",
		description: "Path to file generated by triggering agent",
		valueType: "path",
		availableFor: [
			"specify",
			"plan",
			"tasks",
			"research",
			"datamodel",
			"design",
		],
		required: false,
		example: "/workspace/.specify/specs/011-custom-agent-hooks/spec.md",
		category: "trigger",
	},
];

const ALL_VARIABLES = [
	...STANDARD_VARIABLES,
	...SPEC_VARIABLES,
	...OUTPUT_VARIABLES,
];

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
	placeholder = "Enter command with $variables",
}: ArgumentTemplateEditorProps) => {
	const [validationError, setValidationError] = useState<string>();

	// Get available variables for current trigger type
	const availableVariables = useMemo(
		() => getVariablesForTrigger(triggerType),
		[triggerType]
	);

	// Group variables by category
	const groupedVariables = useMemo(() => {
		const groups: Record<string, TemplateVariable[]> = {
			standard: [],
			spec: [],
			trigger: [],
		};

		for (const variable of availableVariables) {
			const category = variable.category || "standard";
			if (!groups[category]) {
				groups[category] = [];
			}
			groups[category].push(variable);
		}

		return groups;
	}, [availableVariables]);

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
			const newValue = `${value.slice(0, start)}$${varName}${value.slice(end)}`;

			onChange(newValue);

			// Restore focus and move cursor after inserted variable
			setTimeout(() => {
				input.focus();
				const newCursorPos = start + varName.length + 1; // +1 for $
				input.setSelectionRange(newCursorPos, newCursorPos);
			}, 0);
		},
		[value, onChange]
	);

	const displayError = error || validationError;

	// Category labels
	const categoryLabels: Record<string, string> = {
		standard: "Standard Variables",
		spec: "Spec Variables",
		trigger: "Output Capture Variables",
	};

	return (
		<div className="flex flex-col gap-2">
			<input
				className="rounded border border-[color:var(--vscode-input-border)] bg-[color:var(--vscode-input-background)] px-3 py-2 font-mono text-[color:var(--vscode-input-foreground)] text-sm focus:border-[color:var(--vscode-focusBorder)] focus:outline-none"
				disabled={disabled}
				id="action-command"
				onChange={handleChange}
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

			{/* Variable Picker - Always Visible */}
			{availableVariables.length > 0 && (
				<div className="rounded border border-[color:var(--vscode-panel-border)] bg-[color:var(--vscode-sideBar-background)] p-3 text-xs">
					<div className="mb-2 font-medium text-[color:var(--vscode-foreground)]">
						Available Variables
					</div>

					{/* Variables grouped by category */}
					<div className="flex flex-col gap-3">
						{Object.entries(groupedVariables).map(
							([category, variables]) =>
								variables.length > 0 && (
									<div key={category}>
										<div className="mb-1.5 font-semibold text-[10px] text-[color:var(--vscode-descriptionForeground)] uppercase tracking-wide">
											{categoryLabels[category] || category}
										</div>
										<div className="flex flex-wrap gap-1.5">
											{variables.map((variable) => {
												const isUsed = usedVariables.includes(variable.name);
												return (
													<button
														className={`rounded px-2 py-1 text-xs transition-colors ${
															isUsed
																? "cursor-default bg-[color:var(--vscode-button-secondaryBackground)] text-[color:var(--vscode-button-secondaryForeground)] opacity-50"
																: "cursor-pointer bg-[color:var(--vscode-button-secondaryBackground)] text-[color:var(--vscode-button-secondaryForeground)] hover:bg-[color:var(--vscode-button-secondaryHoverBackground)]"
														}`}
														key={variable.name}
														onClick={() => handleInsertVariable(variable.name)}
														title={`${variable.description}\nExample: ${variable.example || "N/A"}`}
														type="button"
													>
														{`$${variable.name}`}
													</button>
												);
											})}
										</div>
									</div>
								)
						)}
					</div>

					{/* Used variables summary */}
					{usedVariables.length > 0 && (
						<div className="mt-3 border-[color:var(--vscode-panel-border)] border-t pt-2 text-[color:var(--vscode-descriptionForeground)]">
							<span className="font-medium">Currently using:</span>{" "}
							{usedVariables.map((v) => `$${v}`).join(", ")}
						</div>
					)}
				</div>
			)}

			{/* Help Text */}
			<p className="text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.6))] text-xs">
				Use <span className="font-mono">{"$variableName"}</span> syntax to
				insert dynamic values. Click a variable above to insert it.
			</p>
		</div>
	);
};
