import { VSCodeCheckbox } from "@/components/ui/vscode-checkbox";
import { VSCodeSelect } from "@/components/ui/vscode-select";
import { AgentDropdown } from "@/components/hooks/agent-dropdown";
import { AgentTypeSelector } from "./agent-type-selector";
import { AcpAgentForm } from "./acp-agent-form";
import { AcpKnownAgentsPanel } from "./acp-known-agents-panel";
import { GitActionForm } from "./git-action-form";
import { GitHubActionForm } from "./github-action-form";
import type {
	ACPActionParams,
	ACPAgentDescriptor,
	ActionConfig,
	ActionType,
	AgentActionParams,
	AgentType,
	CustomActionParams,
	GitActionParams,
	GitHubActionParams,
	KnownAgentStatus,
	MCPActionParams,
	OperationType,
	SelectedMCPTool,
	TriggerCondition,
} from "../types";
import type { ChangeEvent } from "react";
import { useMCPServers } from "../hooks/use-mcp-servers";
import { useAcpAgents } from "../hooks/use-acp-agents";
import { useKnownAcpAgents } from "../hooks/use-known-acp-agents";
import { MCPToolsSelector } from "./mcp-tools-selector";
import { ArgumentTemplateEditor } from "./argument-template-editor";
import { CopilotCliOptionsPanel } from "./cli-options/copilot-cli-options-panel";

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
		case "acp":
			return {
				mode: "local",
				agentCommand: "",
				taskInstruction: "",
			} as ACPActionParams;
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

interface AcpActionContentProps {
	action: ActionConfig;
	actionError?: string;
	disabled?: boolean;
	discoveredAgents: ACPAgentDescriptor[];
	knownAgents: KnownAgentStatus[];
	onActionChange: (action: ActionConfig) => void;
	onClearActionError?: () => void;
	onToggleKnownAgent: (agentId: string, enabled: boolean) => void;
}

const AcpActionContent = ({
	action,
	actionError,
	disabled,
	discoveredAgents,
	knownAgents,
	onActionChange,
	onClearActionError,
	onToggleKnownAgent,
}: AcpActionContentProps) => (
	<>
		{knownAgents.length > 0 && (
			<div className="flex flex-col gap-2">
				<span className="font-medium text-[color:var(--vscode-foreground)] text-sm">
					Known Agents
				</span>
				<AcpKnownAgentsPanel
					agents={knownAgents}
					disabled={disabled}
					onToggle={onToggleKnownAgent}
				/>
			</div>
		)}
		<AcpAgentForm
			action={action}
			actionError={actionError}
			disabled={disabled}
			discoveredAgents={discoveredAgents}
			onActionChange={onActionChange}
			onClearActionError={onClearActionError}
		/>
	</>
);

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
	// ACP workspace-discovered agents
	const discoveredAgents = useAcpAgents();
	// ACP known-agent checklist state
	const { agents: knownAgents, toggle: toggleKnownAgent } = useKnownAcpAgents();

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

	const handleTriggerTimingChange = (event: ChangeEvent<HTMLSelectElement>) => {
		onTriggerChange({
			...trigger,
			timing: event.target.value as "before" | "after",
		});
	};

	const handleWaitForCompletionChange = (
		event: ChangeEvent<HTMLInputElement>
	) => {
		onTriggerChange({
			...trigger,
			waitForCompletion: event.target.checked,
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
							placeholder="/speckit.clarify --spec $specId"
							triggerType={trigger.operation}
							value={params.command || ""}
						/>
					</div>
				);
			}
			case "git": {
				return (
					<GitActionForm
						action={action}
						actionError={actionError}
						disabled={disabled}
						onActionChange={onActionChange}
						onClearActionError={onClearActionError}
					/>
				);
			}
			case "github": {
				return (
					<GitHubActionForm
						action={action}
						actionError={actionError}
						disabled={disabled}
						onActionChange={onActionChange}
						onClearActionError={onClearActionError}
					/>
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
								onAgentSelect={(agentId) => {
									// Extract agent name without prefix for backward compatibility
									const agentName = agentId.includes(":")
										? agentId.split(":")[1]
										: agentId;

									onActionChange({
										...action,
										parameters: {
											...params,
											agentId, // Full ID with prefix (e.g., "local:agent-name")
											agentName, // Just the name without prefix for legacy validation
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
							<div className="flex items-center gap-1">
								<label
									className="font-medium text-[color:var(--vscode-foreground)] text-sm"
									htmlFor="custom-arguments"
								>
									Arguments
								</label>
							</div>
							<ArgumentTemplateEditor
								disabled={disabled}
								error={actionError}
								onChange={(value) => {
									onActionChange({
										...action,
										parameters: {
											...params,
											arguments: value,
										} as CustomActionParams,
									});
									onClearActionError?.();
								}}
								placeholder="--mode=auto --feature=$feature --spec=$specId"
								triggerType={trigger.operation}
								value={params.arguments || ""}
							/>
						</div>

						{/* CLI Options Panel - Only show for background agents */}
						{params.agentType === "background" && (
							<CopilotCliOptionsPanel
								disabled={disabled}
								onChange={(
									cliOptions: import("../types").CopilotCliOptions
								) => {
									onActionChange({
										...action,
										parameters: {
											...params,
											cliOptions,
										} as CustomActionParams,
									});
									onClearActionError?.();
								}}
								value={params.cliOptions || {}}
							/>
						)}
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
						{/* Model Selector */}{" "}
						{/* TODO: Integrate with VS Code Language Model API to show available models from user's GitHub Copilot subscription */}{" "}
						<VSCodeSelect
							description="Select which LLM model to use for executing the instructions (optional, uses default Copilot model if not specified)"
							disabled={disabled}
							id="mcp-model"
							label="Model"
							onChange={(e) => {
								onActionChange({
									...action,
									parameters: {
										...params,
										modelId: e.target.value || undefined,
									} as MCPActionParams,
								});
								onClearActionError?.();
							}}
							size="sm"
							value={params.modelId || ""}
						>
							<option value="">Default Model (Copilot)</option>
							<option value="gpt-4.1">GPT-4.1</option>
							<option value="gpt-5-mini">GPT-5 Mini</option>
							<option value="gpt-5.3-codex">GPT-5.3 Codex</option>
							<option value="claude-4-6-sonnet">Claude 4.6 Sonnet</option>
							<option value="claude-4-6-opus">Claude 4.6 Opus</option>
							<option value="claude-4-5-haiku">Claude 4.5 Haiku</option>
							<option value="gemini-3.0-flash-preview">
								Gemini 3.0 Flash (Preview)
							</option>
							<option value="gemini-3.0-pro-preview">
								Gemini 3.0 Pro (Preview)
							</option>
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
			case "acp": {
				return (
					<AcpActionContent
						action={action}
						actionError={actionError}
						disabled={disabled}
						discoveredAgents={discoveredAgents}
						knownAgents={knownAgents}
						onActionChange={onActionChange}
						onClearActionError={onClearActionError}
						onToggleKnownAgent={toggleKnownAgent}
					/>
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
				<div className="flex gap-3">
					<div className="flex-1">
						<VSCodeSelect
							disabled={disabled}
							id="trigger-timing"
							label="When to Execute"
							onChange={handleTriggerTimingChange}
							size="sm"
							value={trigger.timing}
						>
							<option value="before">Before Operation</option>
							<option value="after">After Operation</option>
						</VSCodeSelect>
					</div>
				</div>
				{trigger.timing === "before" && (
					<div className="flex items-start gap-2">
						<VSCodeCheckbox
							checked={trigger.waitForCompletion ?? false}
							disabled={disabled}
							onChange={handleWaitForCompletionChange}
						>
							Wait for hook to complete before executing operation
						</VSCodeCheckbox>
					</div>
				)}
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
					<option value="mcp">Custom Tools</option>
					<option value="acp">ACP Agent</option>
				</VSCodeSelect>
				{renderActionParameters()}
				{actionError &&
					action.type !== "git" &&
					action.type !== "github" &&
					action.type !== "acp" && (
						<span className="text-[color:var(--vscode-errorForeground)] text-xs">
							{actionError}
						</span>
					)}
			</fieldset>
		</div>
	);
};
