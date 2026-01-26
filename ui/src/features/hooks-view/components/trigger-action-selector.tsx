import { TextareaPanel } from "@/components/textarea-panel";
import { VSCodeCheckbox } from "@/components/ui/vscode-checkbox";
import { VSCodeSelect } from "@/components/ui/vscode-select";
import { AgentDropdown } from "@/components/hooks/agent-dropdown";
import { AgentTypeSelector } from "./agent-type-selector";
import type {
	ActionConfig,
	ActionType,
	AgentActionParams,
	AgentType,
	CustomActionParams,
	GitActionParams,
	GitHubActionParams,
	MCPActionParams,
	OperationType,
	SelectedMCPTool,
	TriggerCondition,
} from "../types";
import type {
	ChangeEvent,
	HTMLInputElement,
	HTMLSelectElement,
	HTMLTextAreaElement,
} from "react";
import { useMCPServers } from "../hooks/use-mcp-servers";
import { MCPToolsSelector } from "./mcp-tools-selector";
import { ArgumentTemplateEditor } from "./argument-template-editor";

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
				prompt: "",
				selectedTools: [],
			} as CustomActionParams;
		case "mcp":
			return {
				prompt: "",
				selectedTools: [],
				// Legacy fields for backward compatibility
				serverId: "",
				serverName: "",
				toolName: "",
				toolDisplayName: "",
			} as MCPActionParams;
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
	// MCP servers state
	const { servers, loading: mcpLoading, error: mcpError } = useMCPServers();

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

	const handleMCPToolsSelection = (selectedTools: SelectedMCPTool[]): void => {
		const params = action.parameters as MCPActionParams;
		onActionChange({
			...action,
			type: "mcp",
			parameters: {
				...params,
				selectedTools,
			} as MCPActionParams,
		});
		onClearActionError?.();
	};

	const handleCustomToolsSelection = (
		selectedTools: SelectedMCPTool[]
	): void => {
		const params = action.parameters as CustomActionParams;
		onActionChange({
			...action,
			type: "custom",
			parameters: {
				...params,
				selectedTools,
			} as CustomActionParams,
		});
		onClearActionError?.();
	};

	// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: UI renders different action editors
	const renderActionParameters = () => {
		switch (action.type) {
			case "agent": {
				const params = action.parameters as AgentActionParams;
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
						<ArgumentTemplateEditor
							disabled={disabled}
							error={actionError}
							onChange={(value) => {
								onActionChange({
									...action,
									parameters: {
										...params,
										command: value,
									},
								});
								onClearActionError?.();
							}}
							placeholder="/speckit.clarify --spec {specId}"
							triggerType={trigger.operation}
							value={params.command || ""}
						/>
					</div>
				);
			}
			case "git": {
				const params = action.parameters as GitActionParams;
				const isCommitOperation = params.operation === "commit";
				return (
					<>
						<VSCodeSelect
							disabled={disabled}
							id="git-operation"
							label="Operation"
							onChange={handleGitOperationChange}
							value={params.operation}
						>
							<option value="commit">Commit</option>
							<option value="push">Push</option>
						</VSCodeSelect>
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
								<VSCodeCheckbox
									checked={params.pushToRemote ?? false}
									disabled={disabled}
									id="git-push-to-remote"
									label="Push to remote after commit"
									onChange={handleActionParamChange("pushToRemote")}
								/>
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
						<VSCodeSelect
							disabled={disabled}
							id="github-operation"
							label="Operation"
							onChange={handleActionParamChange("operation")}
							value={params.operation}
						>
							<option value="open-issue">Open Issue</option>
							<option value="close-issue">Close Issue</option>
							<option value="create-pr">Create Pull Request</option>
							<option value="add-comment">Add Comment</option>
						</VSCodeSelect>
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
									Agent
								</label>
								<span
									aria-hidden="true"
									className="text-[color:var(--vscode-errorForeground)]"
								>
									*
								</span>
							</div>
							<AgentDropdown
								disabled={disabled}
								onAgentChange={(agentId) => {
									onActionChange({
										...action,
										parameters: {
											...params,
											agentId,
											agentName: agentId, // Keep backward compatibility
										} as CustomActionParams,
									});
									onClearActionError?.();
								}}
								selectedAgentId={params.agentId || params.agentName}
							/>
						</div>

						{/* Agent Type Selector - Manual override for agent execution type */}
						<AgentTypeSelector
							disabled={disabled}
							onChange={(agentType) => {
								onActionChange({
									...action,
									parameters: {
										...params,
										agentType,
									} as CustomActionParams,
								});
								onClearActionError?.();
							}}
							value={params.agentType}
						/>

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
			case "mcp": {
				const params = action.parameters as MCPActionParams;
				return (
					<div className="flex flex-col gap-4">
						{/* Prompt/Instruction Field */}
						<div className="flex flex-col gap-2">
							<label
								className="font-medium text-[color:var(--vscode-foreground)] text-xs"
								htmlFor="mcp-prompt"
							>
								Instruction/Prompt{" "}
								<span className="text-[color:var(--vscode-errorForeground)]">
									*
								</span>
							</label>
							<textarea
								className="min-h-[80px] resize-y rounded border border-[color:var(--vscode-input-border)] bg-[color:var(--vscode-input-background)] px-3 py-2 text-[color:var(--vscode-input-foreground)] text-sm focus:border-[color:var(--vscode-focusBorder)] focus:outline-none"
								disabled={disabled}
								id="mcp-prompt"
								maxLength={1000}
								onChange={(e) => {
									onActionChange({
										...action,
										parameters: {
											...params,
											prompt: e.target.value,
										} as MCPActionParams,
									});
									onClearActionError?.();
								}}
								placeholder="Enter the instruction or prompt for the agent to execute..."
								value={params.prompt || ""}
							/>
							<div className="flex justify-between text-[color:var(--vscode-descriptionForeground)] text-xs">
								<span>
									Describe what the agent should do with the selected tools
								</span>
								<span>{params.prompt?.length || 0}/1000</span>
							</div>
						</div>

						{/* Agent Selector */}
						<VSCodeSelect
							description="Select which agent should execute the action (optional, defaults to GitHub Copilot)"
							disabled={disabled}
							id="mcp-agent"
							label="Agent (Optional)"
							onChange={(e) => {
								onActionChange({
									...action,
									parameters: {
										...params,
										agentId: e.target.value || undefined,
									} as MCPActionParams,
								});
								onClearActionError?.();
							}}
							size="sm"
							value={params.agentId || ""}
						>
							<option value="">Default Agent</option>
							<option value="gpt-4o">GPT-4o</option>
							<option value="gpt-4o-mini">GPT-4o Mini</option>
							<option value="o1-preview">O1 Preview</option>
							<option value="o1-mini">O1 Mini</option>
							<option value="claude-3-5-sonnet">Claude 3.5 Sonnet</option>
						</VSCodeSelect>

						{/* MCP Tools Selector - Multi-select with checkboxes */}
						<div className="flex flex-col gap-2">
							<div className="font-medium text-[color:var(--vscode-foreground)] text-xs">
								MCP Tools{" "}
								<span className="text-[color:var(--vscode-errorForeground)]">
									*
								</span>
							</div>
							{mcpLoading && (
								<div className="flex items-center justify-center py-8 text-[color:var(--vscode-descriptionForeground)] text-sm">
									<span className="codicon codicon-loading codicon-modifier-spin mr-2" />
									Loading MCP tools...
								</div>
							)}
							{!mcpLoading && mcpError && (
								<div className="rounded border border-[color:var(--vscode-errorBorder)] bg-[color:var(--vscode-inputValidation-errorBackground)] px-3 py-2 text-[color:var(--vscode-errorForeground)] text-sm">
									{mcpError}
								</div>
							)}
							{!(mcpLoading || mcpError) && (
								<MCPToolsSelector
									disabled={disabled}
									onSelectionChange={handleMCPToolsSelection}
									selectedTools={params.selectedTools || []}
									servers={servers}
								/>
							)}
						</div>
					</div>
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
					<div className="flex-1">
						<VSCodeSelect
							disabled={disabled}
							id="trigger-agent"
							label="Agent"
							onChange={handleTriggerAgentChange}
							size="sm"
							value={trigger.agent}
						>
							<option value="speckit">SpecKit</option>
							<option value="openspec">OpenSpec</option>
						</VSCodeSelect>
					</div>
					<div className="flex-1">
						<VSCodeSelect
							disabled={disabled}
							id="trigger-operation"
							label="Operation"
							onChange={handleTriggerOperationChange}
							size="sm"
							value={trigger.operation}
						>
							{SPECKIT_OPERATIONS.map((operation) => (
								<option key={operation.value} value={operation.value}>
									{operation.label}
								</option>
							))}
						</VSCodeSelect>
					</div>
				</div>
			</fieldset>

			<fieldset className="flex flex-col gap-3 rounded border border-[color:var(--vscode-panel-border)] p-3">
				<legend className="px-2 font-medium text-[color:var(--vscode-foreground)] text-sm">
					Action
				</legend>
				<VSCodeSelect
					disabled={disabled}
					id="action-type"
					label="Type"
					onChange={handleActionTypeChange}
					size="sm"
					value={action.type}
				>
					<option value="agent">Agent Command</option>
					<option value="git">Git Operation</option>
					<option value="github">GitHub Operation</option>
					<option value="custom">Custom Agent</option>
					<option value="mcp">MCP Action</option>
				</VSCodeSelect>
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
