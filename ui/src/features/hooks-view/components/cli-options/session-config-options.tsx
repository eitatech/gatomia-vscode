import type { CopilotCliOptions } from "../../types";
import { InfoTooltip } from "../../../../components/cli-options";
import "./session-config-options.css";

export interface SessionConfigOptionsProps {
	/** Current CLI options */
	value: CopilotCliOptions;
	/** Called when options change */
	onChange: (value: Partial<CopilotCliOptions>) => void;
	/** Whether the options are disabled */
	disabled?: boolean;
}

/**
 * Converts a boolean|string|undefined value to a string for input display
 */
function boolOrStringToInputValue(val: boolean | string | undefined): string {
	if (typeof val === "string") {
		return val;
	}
	if (val === true) {
		return "true";
	}
	return "";
}

/**
 * Converts an input string to boolean|string|undefined
 */
function inputValueToBoolOrString(val: string): boolean | string | undefined {
	if (val === "") {
		return;
	}
	if (val === "true") {
		return true;
	}
	return val;
}

/**
 * SessionConfigOptions component for session management and configuration.
 */
export function SessionConfigOptions({
	value,
	onChange,
	disabled = false,
}: SessionConfigOptionsProps) {
	return (
		<div className="session-config-options">
			<div className="session-config-header">
				<h4>
					Session & Configuration
					<InfoTooltip
						description="Manage session persistence, sharing, and configuration directories."
						title="Session and Configuration Settings"
					/>
				</h4>
			</div>

			<div className="session-config-options-grid">
				{/* Resume Session */}
				<div className="session-config-option">
					<label htmlFor="resume-session-input">
						Resume Session
						<InfoTooltip
							description="Resume a previous session. Can be true to resume the last session, or a session ID string."
							title="--resume"
						/>
					</label>
					<input
						className="session-config-input"
						disabled={disabled}
						id="resume-session-input"
						onChange={(e) => {
							onChange({
								resume: inputValueToBoolOrString(e.target.value),
							});
						}}
						placeholder="e.g., session-abc123 or 'true'"
						type="text"
						value={boolOrStringToInputValue(value.resume)}
					/>
				</div>

				{/* Config Directory */}
				<div className="session-config-option">
					<label htmlFor="config-dir-input">
						Config Directory
						<InfoTooltip
							description="Specify a custom configuration directory instead of the default location."
							title="--config-dir"
						/>
					</label>
					<input
						className="session-config-input"
						disabled={disabled}
						id="config-dir-input"
						onChange={(e) =>
							onChange({ configDir: e.target.value || undefined })
						}
						placeholder="e.g., ~/.config/copilot"
						type="text"
						value={value.configDir || ""}
					/>
				</div>

				{/* Continue Session */}
				<div className="session-config-checkbox">
					<input
						checked={value.continue}
						disabled={disabled}
						id="continue-session-checkbox"
						onChange={(e) => onChange({ continue: e.target.checked })}
						type="checkbox"
					/>
					<label htmlFor="continue-session-checkbox">
						Continue Session
						<InfoTooltip
							description="Continue from the previous session automatically."
							title="--continue"
						/>
					</label>
				</div>

				{/* Share Session */}
				<div className="session-config-option">
					<label htmlFor="share-session-input">
						Share Session
						<InfoTooltip
							description="Share the session. Can be true for default sharing, or a custom share URL."
							title="--share"
						/>
					</label>
					<input
						className="session-config-input"
						disabled={disabled}
						id="share-session-input"
						onChange={(e) => {
							onChange({
								share: inputValueToBoolOrString(e.target.value),
							});
						}}
						placeholder="e.g., 'true' or custom URL"
						type="text"
						value={boolOrStringToInputValue(value.share)}
					/>
				</div>

				{/* Share to Gist */}
				<div className="session-config-checkbox">
					<input
						checked={value.shareGist}
						disabled={disabled}
						id="share-gist-checkbox"
						onChange={(e) => onChange({ shareGist: e.target.checked })}
						type="checkbox"
					/>
					<label htmlFor="share-gist-checkbox">
						Share to GitHub Gist
						<InfoTooltip
							description="Automatically create a GitHub Gist with the session transcript when complete."
							title="--share-gist"
							warning="This will make the session publicly accessible on GitHub."
						/>
					</label>
				</div>

				{/* Enable Banner */}
				<div className="session-config-checkbox">
					<input
						checked={value.banner !== false}
						disabled={disabled}
						id="banner-checkbox"
						onChange={(e) => onChange({ banner: e.target.checked })}
						type="checkbox"
					/>
					<label htmlFor="banner-checkbox">
						Show Welcome Banner
						<InfoTooltip
							description="Show the welcome banner and version information at startup."
							title="--banner"
						/>
					</label>
				</div>

				{/* Enable Auto-Update Check */}
				<div className="session-config-checkbox">
					<input
						checked={!value.noAutoUpdate}
						disabled={disabled}
						id="auto-update-checkbox"
						onChange={(e) => onChange({ noAutoUpdate: !e.target.checked })}
						type="checkbox"
					/>
					<label htmlFor="auto-update-checkbox">
						Enable Auto-Update Check
						<InfoTooltip
							description="Check for CLI updates at startup."
							title="--no-auto-update"
						/>
					</label>
				</div>
			</div>
		</div>
	);
}
