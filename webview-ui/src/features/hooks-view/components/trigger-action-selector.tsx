import { TextareaPanel } from "@/components/textarea-panel";
import type {
	ActionConfig,
	ActionType,
	AgentActionParams,
	AgentType,
	CustomActionParams,
	GitActionParams,
	GitHubActionParams,
	OperationType,
	TriggerCondition,
} from "../types";
import type {
	ChangeEvent,
	HTMLInputElement,
	HTMLSelectElement,
	HTMLTextAreaElement,
} from "react";

interface TriggerActionSelectorProps {
	trigger: TriggerCondition;
	action: ActionConfig;
	disabled?: boolean;
	actionError?: string;
	onTriggerChange: (trigger: TriggerCondition) => void;
	onActionChange: (action: ActionConfig) => void;
	onClearActionError?: () => void;
}

const getDefaultParameters = (type: ActionType): ActionConfig["parameters"] => {
	switch (type) {
		case "git":
			return {
				operation: "commit",
				messageTemplate: "",
				pushToRemote: false,
			} as GitActionParams;
		case "github":
			return {
				operation: "open-issue",
			} as GitHubActionParams;
		case "custom":
			return {
				agentName: "",
			} as CustomActionParams;
		default:
			return {
				command: "",
			} as AgentActionParams;
	}
};

const SPECKIT_OPERATIONS: Array<{ value: OperationType; label: string }> = [
	{ value: "research", label: "Research" },
	{ value: "datamodel", label: "Data Model" },
	{ value: "design", label: "Design" },
	{ value: "specify", label: "Specify" },
	{ value: "clarify", label: "Clarify" },
	{ value: "plan", label: "Plan" },
	{ value: "tasks", label: "Tasks" },
	{ value: "taskstoissues", label: "Tasks to Issues" },
	{ value: "analyze", label: "Analyze" },
	{ value: "checklist", label: "Checklist" },
	{ value: "constitution", label: "Constitution" },
	{ value: "implementation", label: "Implementation" },
	{ value: "unit-test", label: "Unit Tests" },
	{ value: "integration-test", label: "Integration Tests" },
];

const AGENT_COMMAND_SUGGESTIONS = [
	"/speckit.research",
	"/speckit.datamodel",
	"/speckit.design",
	"/speckit.specify",
	"/speckit.clarify",
	"/speckit.plan",
	"/speckit.tasks",
	"/speckit.taskstoissues",
	"/speckit.analyze",
	"/speckit.checklist",
	"/speckit.constitution",
	"/speckit.implementation",
	"/speckit.unit-test",
	"/speckit.integration-test",
];

export const TriggerActionSelector = ({
	trigger,
	action,
	disabled,
	actionError,
	onTriggerChange,
	onActionChange,
	onClearActionError,
}: TriggerActionSelectorProps) => {
	const handleTriggerAgentChange = (event: ChangeEvent<HTMLSelectElement>) => {
		onTriggerChange({
			...trigger,
			agent: event.target.value as AgentType,
		});
	};

	const handleTriggerOperationChange = (
		event: ChangeEvent<HTMLSelectElement>
	) => {
		onTriggerChange({
			...trigger,
			operation: event.target.value as OperationType,
		});
	};

	const handleActionTypeChange = (event: ChangeEvent<HTMLSelectElement>) => {
		const newType = event.target.value as ActionType;
		onActionChange({
			type: newType,
			parameters: getDefaultParameters(newType),
		});
		onClearActionError?.();
	};

	const handleActionParamChange =
		(field: string) =>
		(
			event: ChangeEvent<
				HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
			>
		) => {
			let value: string | boolean | number | undefined;

			if (event.target.type === "checkbox") {
				value = (event.target as HTMLInputElement).checked;
			} else if (event.target.type === "number") {
				const parsed = Number.parseInt(event.target.value, 10);
				value = Number.isNaN(parsed) ? undefined : parsed;
			} else {
				value = event.target.value;
			}

			onActionChange({
				...action,
				parameters: {
					...action.parameters,
					[field]: value,
				},
			});
			onClearActionError?.();
		};

	const handleGitOperationChange = (
		event: ChangeEvent<HTMLSelectElement>
	): void => {
		const params = action.parameters as GitActionParams;
		const nextOperation = event.target.value as GitActionParams["operation"];

		onActionChange({
			...action,
			type: "git",
			parameters: {
				...params,
				operation: nextOperation,
				...(nextOperation === "push"
					? { pushToRemote: false }
					: { pushToRemote: params.pushToRemote ?? false }),
			},
		});
		onClearActionError?.();
	};

	// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: UI renders different action editors
	const renderActionParameters = () => {
		switch (action.type) {
			case "agent": {
				const params = action.parameters as AgentActionParams;
				const commandListId = "hooks-agent-commands";
				return (
					<div className="flex flex-col gap-2">
						<div className="flex items-center gap-1">
							<label
								className="font-medium text-[color:var(--vscode-foreground)] text-sm"
								htmlFor="action-command"
							>
								Command
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
							disabled={disabled}
							id="action-command"
							list={commandListId}
							onChange={handleActionParamChange("command")}
							placeholder="/speckit.clarify or /openspec.analyze"
							type="text"
							value={params.command || ""}
						/>
						<datalist id={commandListId}>
							{AGENT_COMMAND_SUGGESTIONS.map((cmd) => (
								<option key={cmd} value={cmd} />
							))}
						</datalist>
					</div>
				);
			}
			case "git": {
				const params = action.parameters as GitActionParams;
				const isCommitOperation = params.operation === "commit";
				return (
					<>
						<div className="flex flex-col gap-2">
							<label
								className="font-medium text-[color:var(--vscode-foreground)] text-sm"
								htmlFor="git-operation"
							>
								Operation
							</label>
							<select
								className="rounded border border-[color:var(--vscode-input-border)] bg-[color:var(--vscode-dropdown-background)] px-3 py-2 text-[color:var(--vscode-dropdown-foreground)] text-sm focus:border-[color:var(--vscode-focusBorder)] focus:outline-none"
								disabled={disabled}
								id="git-operation"
								onChange={handleGitOperationChange}
								value={params.operation}
							>
								<option value="commit">Commit</option>
								<option value="push">Push</option>
							</select>
						</div>
						{isCommitOperation ? (
							<>
								<div className="flex flex-col gap-2">
									<div className="flex items-center gap-1">
										<label
											className="font-medium text-[color:var(--vscode-foreground)] text-sm"
											htmlFor="git-message-template"
										>
											Message Template
										</label>
										<span
											aria-hidden="true"
											className="text-[color:var(--vscode-errorForeground)]"
										>
											*
										</span>
									</div>
									<TextareaPanel
										disabled={disabled}
										onChange={handleActionParamChange("messageTemplate")}
										placeholder="feat({feature}): automated update at {timestamp}"
										rows={2}
										textareaClassName="min-h-[4rem] text-sm"
										textareaProps={{ id: "git-message-template" }}
										value={params.messageTemplate || ""}
									/>
									<p className="text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.6))] text-xs">
										Available variables: {"{feature}"}, {"{branch}"},{" "}
										{"{timestamp}"}, {"{user}"}
									</p>
								</div>
								<div className="flex items-center gap-2">
									<input
										checked={params.pushToRemote ?? false}
										className="size-4"
										disabled={disabled}
										id="git-push-to-remote"
										onChange={handleActionParamChange("pushToRemote")}
										type="checkbox"
									/>
									<label
										className="text-[color:var(--vscode-foreground)] text-sm"
										htmlFor="git-push-to-remote"
									>
										Push to remote after commit
									</label>
								</div>
							</>
						) : (
							<p className="text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.6))] text-xs">
								The push action immediately pushes the active branch to its
								upstream remote. No commit message is needed.
							</p>
						)}
					</>
				);
			}
			case "github": {
				const params = action.parameters as GitHubActionParams;
				return (
					<>
						<div className="flex flex-col gap-2">
							<label
								className="font-medium text-[color:var(--vscode-foreground)] text-sm"
								htmlFor="github-operation"
							>
								Operation
							</label>
							<select
								className="rounded border border-[color:var(--vscode-input-border)] bg-[color:var(--vscode-dropdown-background)] px-3 py-2 text-[color:var(--vscode-dropdown-foreground)] text-sm focus:border-[color:var(--vscode-focusBorder)] focus:outline-none"
								disabled={disabled}
								id="github-operation"
								onChange={handleActionParamChange("operation")}
								value={params.operation}
							>
								<option value="open-issue">Open Issue</option>
								<option value="close-issue">Close Issue</option>
								<option value="create-pr">Create Pull Request</option>
								<option value="add-comment">Add Comment</option>
							</select>
						</div>
						<div className="flex flex-col gap-2">
							<label
								className="font-medium text-[color:var(--vscode-foreground)] text-sm"
								htmlFor="github-repository"
							>
								Repository
							</label>
							<input
								className="rounded border border-[color:var(--vscode-input-border)] bg-[color:var(--vscode-input-background)] px-3 py-2 text-[color:var(--vscode-input-foreground)] text-sm focus:border-[color:var(--vscode-focusBorder)] focus:outline-none"
								disabled={disabled}
								id="github-repository"
								onChange={handleActionParamChange("repository")}
								placeholder="owner/repo (optional, defaults to current)"
								type="text"
								value={params.repository || ""}
							/>
						</div>
						{(params.operation === "open-issue" ||
							params.operation === "create-pr") && (
							<>
								<div className="flex flex-col gap-2">
									<div className="flex items-center gap-1">
										<label
											className="font-medium text-[color:var(--vscode-foreground)] text-sm"
											htmlFor="github-title-template"
										>
											Title
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
										disabled={disabled}
										id="github-title-template"
										onChange={handleActionParamChange("titleTemplate")}
										placeholder="Spec created for {feature}"
										type="text"
										value={params.titleTemplate || ""}
									/>
								</div>
								<div className="flex flex-col gap-2">
									<label
										className="font-medium text-[color:var(--vscode-foreground)] text-sm"
										htmlFor="github-body-template"
									>
										Body
									</label>
									<TextareaPanel
										disabled={disabled}
										onChange={handleActionParamChange("bodyTemplate")}
										placeholder="Specification created at {timestamp} by {user}"
										rows={3}
										textareaClassName="min-h-[6rem] text-sm"
										textareaProps={{ id: "github-body-template" }}
										value={params.bodyTemplate || ""}
									/>
									<p className="text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.6))] text-xs">
										Available variables: {"{feature}"}, {"{branch}"},{" "}
										{"{timestamp}"}, {"{user}"}
									</p>
								</div>
							</>
						)}
						{(params.operation === "close-issue" ||
							params.operation === "add-comment") && (
							<div className="flex flex-col gap-2">
								<div className="flex items-center gap-1">
									<label
										className="font-medium text-[color:var(--vscode-foreground)] text-sm"
										htmlFor="github-issue-number"
									>
										Issue Number
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
									disabled={disabled}
									id="github-issue-number"
									onChange={handleActionParamChange("issueNumber")}
									placeholder="123"
									type="number"
									value={params.issueNumber ?? ""}
								/>
							</div>
						)}
					</>
				);
			}
			case "custom": {
				const params = action.parameters as CustomActionParams;
				return (
					<>
						<div className="flex flex-col gap-2">
							<div className="flex items-center gap-1">
								<label
									className="font-medium text-[color:var(--vscode-foreground)] text-sm"
									htmlFor="custom-agent-name"
								>
									Agent Name
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
								disabled={disabled}
								id="custom-agent-name"
								onChange={handleActionParamChange("agentName")}
								placeholder="my-custom-agent"
								type="text"
								value={params.agentName || ""}
							/>
						</div>
						<div className="flex flex-col gap-2">
							<label
								className="font-medium text-[color:var(--vscode-foreground)] text-sm"
								htmlFor="custom-arguments"
							>
								Arguments
							</label>
							<TextareaPanel
								disabled={disabled}
								onChange={handleActionParamChange("arguments")}
								placeholder="--mode=auto --feature={feature}"
								rows={2}
								textareaClassName="min-h-[4rem] text-sm"
								textareaProps={{ id: "custom-arguments" }}
								value={params.arguments || ""}
							/>
						</div>
					</>
				);
			}
			default:
				return null;
		}
	};

	return (
		<div className="flex flex-col gap-4">
			<fieldset className="flex flex-col gap-3 rounded border border-[color:var(--vscode-panel-border)] p-3">
				<legend className="px-2 font-medium text-[color:var(--vscode-foreground)] text-sm">
					Trigger
				</legend>
				<div className="flex gap-3">
					<div className="flex flex-1 flex-col gap-2">
						<label
							className="font-medium text-[color:var(--vscode-foreground)] text-xs"
							htmlFor="trigger-agent"
						>
							Agent
						</label>
						<select
							className="rounded border border-[color:var(--vscode-input-border)] bg-[color:var(--vscode-dropdown-background)] px-3 py-2 text-[color:var(--vscode-dropdown-foreground)] text-sm focus:border-[color:var(--vscode-focusBorder)] focus:outline-none"
							disabled={disabled}
							id="trigger-agent"
							onChange={handleTriggerAgentChange}
							value={trigger.agent}
						>
							<option value="speckit">SpecKit</option>
							<option value="openspec">OpenSpec</option>
						</select>
					</div>
					<div className="flex flex-1 flex-col gap-2">
						<label
							className="font-medium text-[color:var(--vscode-foreground)] text-xs"
							htmlFor="trigger-operation"
						>
							Operation
						</label>
						<select
							className="rounded border border-[color:var(--vscode-input-border)] bg-[color:var(--vscode-dropdown-background)] px-3 py-2 text-[color:var(--vscode-dropdown-foreground)] text-sm focus:border-[color:var(--vscode-focusBorder)] focus:outline-none"
							disabled={disabled}
							id="trigger-operation"
							onChange={handleTriggerOperationChange}
							value={trigger.operation}
						>
							{SPECKIT_OPERATIONS.map((operation) => (
								<option key={operation.value} value={operation.value}>
									{operation.label}
								</option>
							))}
						</select>
					</div>
				</div>
			</fieldset>

			<fieldset className="flex flex-col gap-3 rounded border border-[color:var(--vscode-panel-border)] p-3">
				<legend className="px-2 font-medium text-[color:var(--vscode-foreground)] text-sm">
					Action
				</legend>
				<div className="flex flex-col gap-2">
					<label
						className="font-medium text-[color:var(--vscode-foreground)] text-xs"
						htmlFor="action-type"
					>
						Type
					</label>
					<select
						className="rounded border border-[color:var(--vscode-input-border)] bg-[color:var(--vscode-dropdown-background)] px-3 py-2 text-[color:var(--vscode-dropdown-foreground)] text-sm focus:border-[color:var(--vscode-focusBorder)] focus:outline-none"
						disabled={disabled}
						id="action-type"
						onChange={handleActionTypeChange}
						value={action.type}
					>
						<option value="agent">Agent Command</option>
						<option value="git">Git Operation</option>
						<option value="github">GitHub Operation</option>
						<option value="custom">Custom Agent</option>
					</select>
				</div>
				{renderActionParameters()}
				{actionError && (
					<span className="text-[color:var(--vscode-errorForeground)] text-xs">
						{actionError}
					</span>
				)}
			</fieldset>
		</div>
	);
};
