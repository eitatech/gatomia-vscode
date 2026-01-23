import { Button } from "@/components/ui/button";
import { VSCodeCheckbox } from "@/components/ui/vscode-checkbox";
import type { ChangeEvent, FormEvent } from "react";
import { useCallback, useState } from "react";
import type {
	ActionConfig,
	AgentActionParams,
	CustomActionParams,
	GitActionParams,
	GitHubActionParams,
	Hook,
	TriggerCondition,
} from "../types";
import { TriggerActionSelector } from "./trigger-action-selector";

interface HookFormProps {
	mode: "create" | "edit";
	initialData?: Hook;
	onSubmit: (
		hookData: Omit<
			Hook,
			"id" | "createdAt" | "modifiedAt" | "executionCount" | "lastExecutedAt"
		>
	) => void;
	onCancel: () => void;
	error?: string;
}

interface FormData {
	name: string;
	enabled: boolean;
	trigger: TriggerCondition;
	action: ActionConfig;
}

interface FieldErrors {
	name?: string;
	action?: string;
}

export const HookForm = ({
	mode,
	initialData,
	onSubmit,
	onCancel,
	error,
}: HookFormProps) => {
	const [formData, setFormData] = useState<FormData>(() => {
		if (mode === "edit" && initialData) {
			return {
				name: initialData.name,
				enabled: initialData.enabled,
				trigger: initialData.trigger,
				action: initialData.action,
			};
		}

		return {
			name: "",
			enabled: true,
			trigger: {
				agent: "speckit",
				operation: "specify",
				timing: "after",
			},
			action: {
				type: "agent",
				parameters: {
					command: "",
				} as AgentActionParams,
			},
		};
	});

	const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
	const [isSubmitting, setIsSubmitting] = useState(false);

	// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: form validation must cover multiple action types
	const validateForm = useCallback((): boolean => {
		const errors: FieldErrors = {};

		if (!formData.name.trim()) {
			errors.name = "Hook name is required";
		} else if (formData.name.length > 100) {
			errors.name = "Hook name must be 100 characters or less";
		}

		switch (formData.action.type) {
			case "agent": {
				const params = formData.action.parameters as AgentActionParams;
				if (!params.command?.trim()) {
					errors.action = "Command is required";
				} else if (
					!(
						params.command.startsWith("/speckit.") ||
						params.command.startsWith("/openspec.")
					)
				) {
					errors.action = "Command must start with /speckit. or /openspec.";
				} else if (params.command.length > 200) {
					errors.action = "Command must be 200 characters or less";
				}
				break;
			}
			case "git": {
				const params = formData.action.parameters as GitActionParams;
				const messageTemplate = params.messageTemplate?.trim() ?? "";
				if (params.operation === "commit" && !messageTemplate) {
					errors.action = "Commit message template is required";
				} else if (messageTemplate && messageTemplate.length > 500) {
					errors.action = "Message template must be 500 characters or less";
				}
				break;
			}
			case "github": {
				const params = formData.action.parameters as GitHubActionParams;
				if (
					(params.operation === "open-issue" ||
						params.operation === "create-pr") &&
					!params.titleTemplate?.trim()
				) {
					errors.action = "Title is required for this operation";
				} else if (params.titleTemplate && params.titleTemplate.length > 200) {
					errors.action = "Title must be 200 characters or less";
				} else if (params.bodyTemplate && params.bodyTemplate.length > 5000) {
					errors.action = "Body must be 5000 characters or less";
				} else if (
					(params.operation === "close-issue" ||
						params.operation === "add-comment") &&
					!params.issueNumber
				) {
					errors.action = "Issue number is required for this operation";
				}
				break;
			}
			case "custom": {
				const params = formData.action.parameters as CustomActionParams;
				if (!params.agentName?.trim()) {
					errors.action = "Agent name is required";
				} else if (params.agentName.length > 50) {
					errors.action = "Agent name must be 50 characters or less";
				} else if (params.arguments && params.arguments.length > 1000) {
					errors.action = "Arguments must be 1000 characters or less";
				}
				break;
			}
			case "mcp": {
				const params = formData.action.parameters as MCPActionParams;
				// Validate new required fields
				if (!params.prompt?.trim()) {
					errors.action = "Instruction/prompt is required";
				} else if (params.prompt.length > 1000) {
					errors.action = "Instruction/prompt must be 1000 characters or less";
				}
				// Check for tool selection (new format OR legacy format)
				const hasNewFormat =
					params.selectedTools && params.selectedTools.length > 0;
				const hasLegacyFormat = params.serverId && params.toolName;
				if (!(hasNewFormat || hasLegacyFormat)) {
					errors.action = "At least one MCP tool must be selected";
				}
				break;
			}
			default:
				break;
		}

		setFieldErrors(errors);
		return Object.keys(errors).length === 0;
	}, [formData]);

	const handleSubmit = useCallback(
		(event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();

			if (!validateForm()) {
				return;
			}

			setIsSubmitting(true);
			onSubmit(formData);
		},
		[formData, validateForm, onSubmit]
	);

	const handleNameChange = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			setFormData((prev) => ({ ...prev, name: event.target.value }));
			setFieldErrors((prev) => ({ ...prev, name: undefined }));
		},
		[]
	);

	const handleEnabledChange = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			setFormData((prev) => ({ ...prev, enabled: event.target.checked }));
		},
		[]
	);

	const handleTriggerChange = useCallback((nextTrigger: TriggerCondition) => {
		setFormData((prev) => ({ ...prev, trigger: nextTrigger }));
	}, []);

	const handleActionChange = useCallback((nextAction: ActionConfig) => {
		setFormData((prev) => ({ ...prev, action: nextAction }));
		setFieldErrors((prev) => ({ ...prev, action: undefined }));
	}, []);

	const clearActionError = useCallback(() => {
		setFieldErrors((prev) => ({ ...prev, action: undefined }));
	}, []);

	return (
		<form className="flex flex-col gap-4" onSubmit={handleSubmit}>
			<div className="flex flex-col gap-3">
				<header className="flex flex-col gap-1">
					<h2 className="font-semibold text-[color:var(--vscode-foreground)] text-lg">
						{mode === "create" ? "Hook Details" : "Edit Hook"}
					</h2>
					<p className="text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.65))] text-sm">
						Configure automation rules for SpecKit/OpenSpec workflows
					</p>
				</header>

				{error && (
					<div
						className="rounded border border-[color:var(--vscode-inputValidation-errorBorder)] bg-[color:var(--vscode-inputValidation-errorBackground)] px-3 py-2 text-[color:var(--vscode-inputValidation-errorForeground)] text-sm"
						role="alert"
					>
						{error}
					</div>
				)}

				<div className="flex flex-col gap-2">
					<div className="flex items-center gap-1">
						<label
							className="font-medium text-[color:var(--vscode-foreground)] text-sm"
							htmlFor="hook-name"
						>
							Name
						</label>
						<span
							aria-hidden="true"
							className="text-[color:var(--vscode-errorForeground)]"
						>
							*
						</span>
					</div>
					<input
						className="rounded border border-[color:var(--vscode-input-border)] bg-[color:var(--vscode-input-background)] px-3 py-2 text-[color:var(--vscode-input-foreground)] text-sm focus:border-[color:var(--vscode-focusBorder)] focus:outline-none"
						disabled={isSubmitting}
						id="hook-name"
						onChange={handleNameChange}
						placeholder="Auto-clarify after specify"
						type="text"
						value={formData.name}
					/>
					{fieldErrors.name && (
						<span className="text-[color:var(--vscode-errorForeground)] text-xs">
							{fieldErrors.name}
						</span>
					)}
				</div>

				<VSCodeCheckbox
					checked={formData.enabled}
					disabled={isSubmitting}
					id="hook-enabled"
					label="Enabled"
					onChange={handleEnabledChange}
				/>

				<TriggerActionSelector
					action={formData.action}
					actionError={fieldErrors.action}
					disabled={isSubmitting}
					onActionChange={handleActionChange}
					onClearActionError={clearActionError}
					onTriggerChange={handleTriggerChange}
					trigger={formData.trigger}
				/>
			</div>

			<div className="flex justify-end gap-2">
				<Button
					disabled={isSubmitting}
					onClick={onCancel}
					type="button"
					variant="outline"
				>
					Cancel
				</Button>
				<Button disabled={isSubmitting} type="submit">
					{(() => {
						if (isSubmitting) {
							return "Saving...";
						}
						if (mode === "create") {
							return "Create Hook";
						}
						return "Save Changes";
					})()}
				</Button>
			</div>
		</form>
	);
};
