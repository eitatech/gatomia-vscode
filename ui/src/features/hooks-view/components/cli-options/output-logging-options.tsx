import type { CopilotCliOptions, CopilotLogLevel } from "../../types";
import { InfoTooltip } from "../../../../components/cli-options";
import "./output-logging-options.css";

export interface OutputLoggingOptionsProps {
	/** Current CLI options */
	value: CopilotCliOptions;
	/** Called when options change */
	onChange: (value: Partial<CopilotCliOptions>) => void;
	/** Whether the options are disabled */
	disabled?: boolean;
}

const LOG_LEVELS: { value: CopilotLogLevel; label: string }[] = [
	{ value: "all", label: "All (Most Verbose)" },
	{ value: "debug", label: "Debug" },
	{ value: "info", label: "Info" },
	{ value: "warning", label: "Warning" },
	{ value: "error", label: "Error" },
	{ value: "none", label: "None (Silent)" },
	{ value: "default", label: "Default" },
];

/**
 * OutputLoggingOptions component for output format and logging configuration.
 */
export function OutputLoggingOptions({
	value,
	onChange,
	disabled = false,
}: OutputLoggingOptionsProps) {
	return (
		<div className="output-logging-options">
			<div className="output-logging-header">
				<h4>
					Output & Logging
					<InfoTooltip
						description="Configure how the agent outputs information and what level of logging to capture."
						title="Output and Logging Settings"
					/>
				</h4>
			</div>

			<div className="output-logging-options-grid">
				{/* Silent Mode */}
				<div className="output-logging-checkbox full-width">
					<input
						checked={value.silent}
						disabled={disabled}
						id="silent-checkbox"
						onChange={(e) => onChange({ silent: e.target.checked })}
						type="checkbox"
					/>
					<label htmlFor="silent-checkbox">
						Silent Mode
						<InfoTooltip
							description="Suppress most output. Only critical errors will be displayed. Useful for background tasks."
							title="--silent"
						/>
					</label>
				</div>

				{/* Log Level */}
				<div className="output-logging-option">
					<label htmlFor="log-level-select">
						Log Level
						<InfoTooltip
							description="Set the verbosity of logging. 'all' provides the most detail, 'none' provides the least."
							title="--log-level"
						/>
					</label>
					<select
						className="output-logging-select"
						disabled={disabled || value.silent}
						id="log-level-select"
						onChange={(e) =>
							onChange({ logLevel: e.target.value as CopilotLogLevel })
						}
						value={value.logLevel || "default"}
					>
						{LOG_LEVELS.map((level) => (
							<option key={level.value} value={level.value}>
								{level.label}
							</option>
						))}
					</select>
				</div>

				{/* Log Directory */}
				<div className="output-logging-option">
					<label htmlFor="log-directory-input">
						Log Directory
						<InfoTooltip
							description="Specify where log files should be written. If not set, logs are written to the default location."
							title="--log-dir"
						/>
					</label>
					<input
						className="output-logging-input"
						disabled={disabled}
						id="log-directory-input"
						onChange={(e) => onChange({ logDir: e.target.value || undefined })}
						placeholder="e.g., ./logs"
						type="text"
						value={value.logDir || ""}
					/>
				</div>

				{/* No Color */}
				<div className="output-logging-checkbox">
					<input
						checked={value.noColor}
						disabled={disabled}
						id="no-color-checkbox"
						onChange={(e) => onChange({ noColor: e.target.checked })}
						type="checkbox"
					/>
					<label htmlFor="no-color-checkbox">
						Disable Colors
						<InfoTooltip
							description="Disable ANSI color codes in output. Useful for piping to files or when colors aren't supported."
							title="--no-color"
						/>
					</label>
				</div>

				{/* Plain Diff */}
				<div className="output-logging-checkbox">
					<input
						checked={value.plainDiff}
						disabled={disabled}
						id="plain-diff-checkbox"
						onChange={(e) => onChange({ plainDiff: e.target.checked })}
						type="checkbox"
					/>
					<label htmlFor="plain-diff-checkbox">
						Plain Diff Format
						<InfoTooltip
							description="Use plain text format for diffs without special formatting. Good for parsing output programmatically."
							title="--plain-diff"
						/>
					</label>
				</div>

				{/* Screen Reader Optimized */}
				<div className="output-logging-checkbox">
					<input
						checked={value.screenReader}
						disabled={disabled}
						id="screen-reader-checkbox"
						onChange={(e) => onChange({ screenReader: e.target.checked })}
						type="checkbox"
					/>
					<label htmlFor="screen-reader-checkbox">
						Screen Reader Optimized
						<InfoTooltip
							description="Optimize output for screen readers by removing visual-only elements and enhancing text descriptions."
							title="--screen-reader"
						/>
					</label>
				</div>

				{/* Streaming Output */}
				<div className="output-logging-option">
					<label htmlFor="stream-select">
						Streaming
						<InfoTooltip
							description="Control whether output is streamed in real-time or batched."
							title="--stream"
						/>
					</label>
					<select
						className="output-logging-select"
						disabled={disabled}
						id="stream-select"
						onChange={(e) =>
							onChange({ stream: e.target.value as "on" | "off" })
						}
						value={value.stream || "on"}
					>
						<option value="on">On (Real-time)</option>
						<option value="off">Off (Batched)</option>
					</select>
				</div>
			</div>
		</div>
	);
}
