import {
	VSCodeButton,
	VSCodeDropdown,
	VSCodeOption,
} from "@vscode/ui-toolkit/react";
import { useState, useEffect, useCallback } from "react";
import type { HookTrigger, HookAction } from "../../types/hooks";
import "./trigger-action-selector.css";

interface TriggerActionSelectorProps {
	trigger: HookTrigger;
	actions: HookAction[];
	onTriggerChange: (trigger: HookTrigger) => void;
	onActionsChange: (actions: HookAction[]) => void;
	disabled?: boolean;
}

// Available trigger types
const TRIGGER_AGENTS = [
	{ value: "speckit", label: "SpecKit" },
	{ value: "openspec", label: "OpenSpec" },
	{ value: "git", label: "Git" },
	{ value: "task", label: "Task" },
	{ value: "custom", label: "Custom" },
];

// Available operations by agent
const OPERATIONS_BY_AGENT: Record<
	string,
	Array<{ value: string; label: string }>
> = {
	speckit: [
		{ value: "specify", label: "Specify" },
		{ value: "clarify", label: "Clarify" },
		{ value: "plan", label: "Plan" },
		{ value: "analyze", label: "Analyze" },
		{ value: "checklist", label: "Checklist" },
		{ value: "tasks", label: "Tasks" },
		{ value: "implement", label: "Implement" },
	],
	openspec: [
		{ value: "create", label: "Create" },
		{ value: "update", label: "Update" },
		{ value: "delete", label: "Delete" },
	],
	git: [
		{ value: "commit", label: "Commit" },
		{ value: "push", label: "Push" },
		{ value: "pull", label: "Pull" },
		{ value: "branch", label: "Branch" },
	],
	task: [
		{ value: "complete", label: "Task Complete" },
		{ value: "start", label: "Task Start" },
		{ value: "fail", label: "Task Fail" },
	],
	custom: [{ value: "custom", label: "Custom Event" }],
};

// Available action types
const ACTION_TYPES = [
	{ value: "agent", label: "Agent" },
	{ value: "git", label: "Git" },
	{ value: "github", label: "GitHub (MCP)" },
	{ value: "notification", label: "Notification" },
	{ value: "custom", label: "Custom" },
];

// Agent action configurations
const AGENT_ACTIONS = [
	{ value: "speckit.specify", label: "SpecKit: Specify" },
	{ value: "speckit.clarify", label: "SpecKit: Clarify" },
	{ value: "speckit.plan", label: "SpecKit: Plan" },
	{ value: "speckit.analyze", label: "SpecKit: Analyze" },
	{ value: "speckit.checklist", label: "SpecKit: Checklist" },
	{ value: "speckit.tasks", label: "SpecKit: Tasks" },
	{ value: "openspec.create", label: "OpenSpec: Create" },
	{ value: "openspec.update", label: "OpenSpec: Update" },
];

// Git action configurations
const GIT_ACTIONS = [
	{ value: "git.commit", label: "Git: Commit" },
	{ value: "git.push", label: "Git: Push" },
	{ value: "git.createBranch", label: "Git: Create Branch" },
];

// GitHub MCP action configurations
const GITHUB_ACTIONS = [
	{ value: "github.createIssue", label: "GitHub: Create Issue" },
	{ value: "github.closeIssue", label: "GitHub: Close Issue" },
	{ value: "github.createPR", label: "GitHub: Create PR" },
	{ value: "github.addComment", label: "GitHub: Add Comment" },
];

export function TriggerActionSelector({
	trigger,
	actions,
	onTriggerChange,
	onActionsChange,
	disabled = false,
}: TriggerActionSelectorProps) {
	const [selectedAgent, setSelectedAgent] = useState(trigger.agent);
	const [selectedOperation, setSelectedOperation] = useState(trigger.operation);
	const [availableOperations, setAvailableOperations] = useState<
		Array<{ value: string; label: string }>
	>([]);

	// Update available operations when agent changes
	useEffect(() => {
		const operations = OPERATIONS_BY_AGENT[selectedAgent] || [];
		setAvailableOperations(operations);

		// Reset operation if not valid for new agent
		if (!operations.find((op) => op.value === selectedOperation)) {
			setSelectedOperation(operations[0]?.value || "");
		}
	}, [selectedAgent, selectedOperation]);

	// Update parent when trigger changes
	const handleTriggerUpdate = useCallback(() => {
		onTriggerChange({
			agent: selectedAgent,
			operation: selectedOperation,
			condition: trigger.condition,
		});
	}, [selectedAgent, selectedOperation, trigger.condition, onTriggerChange]);

	useEffect(() => {
		handleTriggerUpdate();
	}, [handleTriggerUpdate]);

	const handleAgentChange = (e: Event | React.FormEvent<HTMLElement>) => {
		const target = e.target as HTMLSelectElement;
		setSelectedAgent(target.value);
	};

	const handleOperationChange = (e: Event | React.FormEvent<HTMLElement>) => {
		const target = e.target as HTMLSelectElement;
		setSelectedOperation(target.value);
	};

	const handleAddAction = () => {
		const newAction: HookAction = {
			type: "agent",
			config: {},
		};
		onActionsChange([...actions, newAction]);
	};

	const handleRemoveAction = (index: number) => {
		onActionsChange(actions.filter((_, i) => i !== index));
	};

	const handleActionTypeChange = (index: number, type: string) => {
		const updatedActions = [...actions];
		updatedActions[index] = {
			...updatedActions[index],
			type: type as HookAction["type"],
			config: {},
		};
		onActionsChange(updatedActions);
	};

	const handleActionConfigChange = (
		index: number,
		field: string,
		value: string
	) => {
		const updatedActions = [...actions];
		updatedActions[index] = {
			...updatedActions[index],
			config: {
				...updatedActions[index].config,
				[field]: value,
			},
		};
		onActionsChange(updatedActions);
	};

	const getActionOptions = (actionType: string) => {
		switch (actionType) {
			case "agent":
				return AGENT_ACTIONS;
			case "git":
				return GIT_ACTIONS;
			case "github":
				return GITHUB_ACTIONS;
			default:
				return [];
		}
	};

	return (
		<div className="trigger-action-selector">
			<div className="trigger-section">
				<h3>Trigger</h3>
				<div className="trigger-config">
					<div className="form-field">
						<label htmlFor="trigger-agent">Agent</label>
						<VSCodeDropdown
							disabled={disabled}
							id="trigger-agent"
							onChange={handleAgentChange}
							value={selectedAgent}
						>
							{TRIGGER_AGENTS.map((agent) => (
								<VSCodeOption key={agent.value} value={agent.value}>
									{agent.label}
								</VSCodeOption>
							))}
						</VSCodeDropdown>
					</div>

					<div className="form-field">
						<label htmlFor="trigger-operation">Operation</label>
						<VSCodeDropdown
							disabled={disabled || availableOperations.length === 0}
							id="trigger-operation"
							onChange={handleOperationChange}
							value={selectedOperation}
						>
							{availableOperations.map((op) => (
								<VSCodeOption key={op.value} value={op.value}>
									{op.label}
								</VSCodeOption>
							))}
						</VSCodeDropdown>
					</div>
				</div>
			</div>

			<div className="actions-section">
				<div className="actions-header">
					<h3>Actions</h3>
					<VSCodeButton
						appearance="icon"
						disabled={disabled}
						onClick={handleAddAction}
						title="Add Action"
					>
						<span className="codicon codicon-add" />
					</VSCodeButton>
				</div>

				{actions.length === 0 && (
					<div className="empty-state">
						<p>No actions configured. Click + to add an action.</p>
					</div>
				)}

				{actions.map((action, index) => (
					<div className="action-item" key={`action-${action.type}-${index}`}>
						<div className="action-header">
							<span className="action-number">#{index + 1}</span>
							<VSCodeButton
								appearance="icon"
								disabled={disabled}
								onClick={() => handleRemoveAction(index)}
								title="Remove Action"
							>
								<span className="codicon codicon-trash" />
							</VSCodeButton>
						</div>

						<div className="action-config">
							<div className="form-field">
								<label htmlFor={`action-type-${index}`}>Type</label>
								<VSCodeDropdown
									disabled={disabled}
									id={`action-type-${index}`}
									onChange={(e) => {
										const target = e.target as HTMLSelectElement;
										handleActionTypeChange(index, target.value);
									}}
									value={action.type}
								>
									{ACTION_TYPES.map((type) => (
										<VSCodeOption key={type.value} value={type.value}>
											{type.label}
										</VSCodeOption>
									))}
								</VSCodeDropdown>
							</div>

							{action.type !== "notification" && (
								<div className="form-field">
									<label htmlFor={`action-command-${index}`}>Action</label>
									<VSCodeDropdown
										disabled={disabled}
										id={`action-command-${index}`}
										onChange={(e) => {
											const target = e.target as HTMLSelectElement;
											handleActionConfigChange(index, "command", target.value);
										}}
										value={action.config.command || ""}
									>
										<VSCodeOption value="">Select action...</VSCodeOption>
										{getActionOptions(action.type).map((opt) => (
											<VSCodeOption key={opt.value} value={opt.value}>
												{opt.label}
											</VSCodeOption>
										))}
									</VSCodeDropdown>
								</div>
							)}
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
