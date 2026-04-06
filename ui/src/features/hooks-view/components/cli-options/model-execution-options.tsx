import type { CopilotCliOptions, CopilotModel } from "../../types";
import { InfoTooltip } from "../../../../components/cli-options";
import { useAvailableModels } from "../../hooks/use-available-models";
import "./model-execution-options.css";

export interface ModelExecutionOptionsProps {
	/** Current CLI options */
	value: CopilotCliOptions;
	/** Called when options change */
	onChange: (value: Partial<CopilotCliOptions>) => void;
	/** Whether the options are disabled */
	disabled?: boolean;
}

/**
 * ModelExecutionOptions component for AI model and execution configuration.
 * Model list is fetched dynamically from the extension via useAvailableModels.
 */
export function ModelExecutionOptions({
	value,
	onChange,
	disabled = false,
}: ModelExecutionOptionsProps) {
	const { models, isStale, error } = useAvailableModels();

	const selectorDisabled = disabled || !!error || models.length === 0;

	return (
		<div className="model-execution-options">
			<div className="model-execution-header">
				<h4>
					Model &amp; Execution
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

					{isStale && (
						<span
							className="models-stale-warning"
							data-testid="models-stale-warning"
						>
							Model list may be outdated
						</span>
					)}

					{error && (
						<span
							className="models-error-notice"
							data-testid="models-error-notice"
						>
							{error}
						</span>
					)}

					<select
						aria-label="AI Model"
						className="model-select"
						disabled={selectorDisabled}
						id="model-select"
						onChange={(e) =>
							onChange({ modelId: e.target.value as CopilotModel })
						}
						value={value.modelId || ""}
					>
						{models.map((model) => (
							<option key={model.id} value={model.id}>
								{model.name}
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
