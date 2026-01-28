import type { CopilotCliOptions, CopilotModel } from "../../types";
import { InfoTooltip } from "../../../../components/cli-options";
import "./model-execution-options.css";

export interface ModelExecutionOptionsProps {
	/** Current CLI options */
	value: CopilotCliOptions;
	/** Called when options change */
	onChange: (value: Partial<CopilotCliOptions>) => void;
	/** Whether the options are disabled */
	disabled?: boolean;
}

const AVAILABLE_MODELS: { value: CopilotModel; label: string }[] = [
	{ value: "claude-sonnet-4.5", label: "Claude Sonnet 4.5 (Recommended)" },
	{ value: "claude-opus-4.5", label: "Claude Opus 4.5" },
	{ value: "claude-haiku-4.5", label: "Claude Haiku 4.5" },
	{ value: "claude-sonnet-4", label: "Claude Sonnet 4" },
	{ value: "gpt-5.2-codex", label: "GPT-5.2 Codex" },
	{ value: "gpt-5.1-codex-max", label: "GPT-5.1 Codex Max" },
	{ value: "gpt-5.2", label: "GPT-5.2" },
	{ value: "gpt-5.1", label: "GPT-5.1" },
	{ value: "gpt-5", label: "GPT-5" },
];

/**
 * ModelExecutionOptions component for AI model and execution configuration.
 */
export function ModelExecutionOptions({
	value,
	onChange,
	disabled = false,
}: ModelExecutionOptionsProps) {
	return (
		<div className="model-execution-options">
			<div className="model-execution-header">
				<h4>
					Model & Execution
					<InfoTooltip
						description="Configure which AI model to use and how it should execute tasks. These settings control the agent's behavior and capabilities."
						title="Model and Execution Settings"
					/>
				</h4>
			</div>

			<div className="model-execution-options-grid">
				{/* Model Selection */}
				<div className="model-execution-option">
					<label htmlFor="model-select">
						AI Model
						<InfoTooltip
							description="Select which AI model to use for the agent. Different models have different capabilities, speeds, and cost profiles."
							title="--model"
						/>
					</label>
					<select
						className="model-select"
						disabled={disabled}
						id="model-select"
						onChange={(e) =>
							onChange({ model: e.target.value as CopilotModel })
						}
						value={value.model || "claude-sonnet-4.5"}
					>
						{AVAILABLE_MODELS.map((model) => (
							<option key={model.value} value={model.value}>
								{model.label}
							</option>
						))}
					</select>
				</div>

				{/* Custom Agent */}
				<div className="model-execution-option">
					<label htmlFor="custom-agent-input">
						Custom Agent Override
						<InfoTooltip
							description="Override the default agent with a custom agent ID. Use this to specify a specialized agent configuration."
							title="--agent"
						/>
					</label>
					<input
						className="model-execution-input"
						disabled={disabled}
						id="custom-agent-input"
						onChange={(e) => onChange({ agent: e.target.value || undefined })}
						placeholder="e.g., my-custom-agent"
						type="text"
						value={value.agent || ""}
					/>
				</div>

				{/* No Ask User (Autonomous Mode) */}
				<div className="model-execution-checkbox-row">
					<input
						checked={value.noAskUser}
						disabled={disabled}
						id="no-ask-user-checkbox"
						onChange={(e) => onChange({ noAskUser: e.target.checked })}
						type="checkbox"
					/>
					<label htmlFor="no-ask-user-checkbox">
						Autonomous Mode (No Ask User)
						<InfoTooltip
							description="Enable autonomous mode where the agent can make decisions and take actions without asking for confirmation for each step."
							title="--no-ask-user"
							warning="Autonomous mode gives the agent more control. Ensure proper permissions are configured."
						/>
					</label>
				</div>

				{/* Parallel Execution */}
				<div className="model-execution-checkbox-row">
					<input
						checked={!value.disableParallelToolsExecution}
						disabled={disabled}
						id="parallel-checkbox"
						onChange={(e) =>
							onChange({ disableParallelToolsExecution: !e.target.checked })
						}
						type="checkbox"
					/>
					<label htmlFor="parallel-checkbox">
						Enable Parallel Tool Execution
						<InfoTooltip
							description="Allow the agent to execute multiple tools in parallel when possible. This can significantly speed up execution."
							title="--disable-parallel-tools-execution"
						/>
					</label>
				</div>

				{/* Use Custom Instructions */}
				<div className="model-execution-checkbox-row">
					<input
						checked={!value.noCustomInstructions}
						disabled={disabled}
						id="use-custom-instructions-checkbox"
						onChange={(e) =>
							onChange({ noCustomInstructions: !e.target.checked })
						}
						type="checkbox"
					/>
					<label htmlFor="use-custom-instructions-checkbox">
						Use Custom Instructions
						<InfoTooltip
							description="Apply custom instructions from your Copilot configuration. This includes any personalized prompts or guidelines you've configured."
							title="--no-custom-instructions"
						/>
					</label>
				</div>
			</div>
		</div>
	);
}
