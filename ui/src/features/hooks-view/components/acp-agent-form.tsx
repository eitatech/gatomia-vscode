import { type ChangeEvent, useState } from "react";
import type {
	ACPActionParams,
	ACPAgentDescriptor,
	ActionConfig,
} from "../types";

export interface AcpAgentFormProps {
	action: ActionConfig;
	discoveredAgents: ACPAgentDescriptor[];
	disabled?: boolean;
	actionError?: string;
	onActionChange: (action: ActionConfig) => void;
	onClearActionError?: () => void;
}

const INPUT_CLASS =
	"rounded border border-[color:var(--vscode-input-border)] bg-[color:var(--vscode-input-background)] px-3 py-2 text-[color:var(--vscode-input-foreground)] text-sm focus:border-[color:var(--vscode-focusBorder)] focus:outline-none w-full";

const CUSTOM_VALUE = "__custom__";

export const AcpAgentForm = ({
	action,
	discoveredAgents,
	disabled,
	actionError,
	onActionChange,
	onClearActionError,
}: AcpAgentFormProps) => {
	const params = action.parameters as ACPActionParams;
	const [taskInstruction, setTaskInstruction] = useState(
		params.taskInstruction
	);

	const handleParamChange =
		(field: keyof ACPActionParams) =>
		(
			event: ChangeEvent<
				HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
			>
		) => {
			onActionChange({
				...action,
				parameters: { ...params, [field]: event.target.value },
			});
			onClearActionError?.();
		};

	const handleAgentCommandSelectChange = (
		event: ChangeEvent<HTMLSelectElement>
	): void => {
		const value = event.target.value;
		if (value === CUSTOM_VALUE) {
			onActionChange({
				...action,
				parameters: { ...params, agentCommand: "" },
			});
		} else {
			onActionChange({
				...action,
				parameters: { ...params, agentCommand: value },
			});
		}
		onClearActionError?.();
	};

	const hasDiscoveredAgents = discoveredAgents.length > 0;

	return (
		<>
			<div className="flex flex-col gap-1">
				<span className="font-medium text-[color:var(--vscode-foreground)] text-sm">
					Mode
				</span>
				<span className="text-[color:var(--vscode-foreground)] text-sm">
					Local Agent
				</span>
			</div>

			<div className="flex flex-col gap-2">
				<label
					className="font-medium text-[color:var(--vscode-foreground)] text-sm"
					htmlFor="acp-agent-command"
				>
					Agent Command
				</label>
				{hasDiscoveredAgents ? (
					<select
						className={INPUT_CLASS}
						disabled={disabled}
						id="acp-agent-command"
						onChange={handleAgentCommandSelectChange}
						value={
							discoveredAgents.some(
								(a) => a.agentCommand === params.agentCommand
							)
								? params.agentCommand
								: CUSTOM_VALUE
						}
					>
						{discoveredAgents.map((agent) => (
							<option key={agent.agentCommand} value={agent.agentCommand}>
								{agent.agentDisplayName}
							</option>
						))}
						<option value={CUSTOM_VALUE}>Custom command...</option>
					</select>
				) : (
					<input
						className={INPUT_CLASS}
						disabled={disabled}
						id="acp-agent-command"
						onChange={handleParamChange("agentCommand")}
						placeholder="npx my-acp-agent --acp"
						type="text"
						value={params.agentCommand}
					/>
				)}
			</div>

			<div className="flex flex-col gap-2">
				<label
					className="font-medium text-[color:var(--vscode-foreground)] text-sm"
					htmlFor="acp-task-instruction"
				>
					Task Instruction
				</label>
				<textarea
					className="min-h-[4rem] w-full resize-y rounded border border-[color:var(--vscode-input-border)] bg-[color:var(--vscode-input-background)] px-3 py-2 text-[color:var(--vscode-input-foreground)] text-sm focus:border-[color:var(--vscode-focusBorder)] focus:outline-none"
					disabled={disabled}
					id="acp-task-instruction"
					onChange={(e) => {
						setTaskInstruction(e.target.value);
						onActionChange({
							...action,
							parameters: { ...params, taskInstruction: e.target.value },
						});
						onClearActionError?.();
					}}
					placeholder="Describe the task for the agent..."
					rows={3}
					value={taskInstruction}
				/>
			</div>

			<div className="flex flex-col gap-2">
				<label
					className="font-medium text-[color:var(--vscode-foreground)] text-sm"
					htmlFor="acp-agent-display-name"
				>
					Agent Display Name
				</label>
				<input
					className={INPUT_CLASS}
					disabled={disabled}
					id="acp-agent-display-name"
					onChange={handleParamChange("agentDisplayName")}
					placeholder="My ACP Agent (optional)"
					type="text"
					value={params.agentDisplayName ?? ""}
				/>
			</div>

			<div className="flex flex-col gap-2">
				<label
					className="font-medium text-[color:var(--vscode-foreground)] text-sm"
					htmlFor="acp-cwd"
				>
					Working Directory
				</label>
				<input
					className={INPUT_CLASS}
					disabled={disabled}
					id="acp-cwd"
					onChange={handleParamChange("cwd")}
					placeholder="/path/to/project (optional, defaults to workspace root)"
					type="text"
					value={params.cwd ?? ""}
				/>
			</div>

			{actionError && (
				<span className="text-[color:var(--vscode-errorForeground)] text-xs">
					{actionError}
				</span>
			)}
		</>
	);
};
