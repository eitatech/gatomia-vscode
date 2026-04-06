/**
 * Configuration Section Component
 * Interactive overview of workspace configuration with inline editing
 */

import type { ConfigurationState, ConfigurationItem } from "../types";

interface ConfigSectionProps {
	configuration: ConfigurationState;
	onUpdateConfig: (key: string, value: string) => void;
	onOpenSettings: () => void;
}

export const ConfigSection = ({
	configuration,
	onUpdateConfig,
	onOpenSettings,
}: ConfigSectionProps) => {
	return (
		<div className="welcome-section">
			<div className="welcome-section-header">
				<h2 className="welcome-section-title">
					<i className="codicon codicon-settings-gear" />
					Configuration Overview
				</h2>
				<button
					aria-label="Open full VS Code settings"
					className="welcome-button welcome-button-secondary"
					onClick={onOpenSettings}
					type="button"
				>
					Open Full Settings
				</button>
			</div>

			<p className="welcome-section-description">
				Configure GatomIA behavior and paths directly from this interface.
				Changes are saved to your workspace settings automatically.
			</p>

			{/* Editable Configuration Group */}
			<div className="config-group">
				<h3 className="config-group-title">
					<i className="codicon codicon-edit" />
					Quick Edit Settings
				</h3>
				<p className="config-group-description">
					These settings can be modified directly below. All changes persist to
					your workspace configuration.
				</p>

				{/* Spec System Selection */}
				<ConfigDropdown
					item={configuration.specSystem}
					onUpdate={onUpdateConfig}
				/>

				{/* Path Configurations */}
				<ConfigTextInput
					item={configuration.speckitSpecsPath}
					onUpdate={onUpdateConfig}
					placeholder="e.g., ./specs or /absolute/path/specs"
				/>
				<ConfigTextInput
					item={configuration.speckitMemoryPath}
					onUpdate={onUpdateConfig}
					placeholder="e.g., ./.specify/memory"
				/>
				<ConfigTextInput
					item={configuration.speckitTemplatesPath}
					onUpdate={onUpdateConfig}
					placeholder="e.g., ./.specify/templates"
				/>
				<ConfigTextInput
					item={configuration.openspecPath}
					onUpdate={onUpdateConfig}
					placeholder="e.g., ./openspec"
				/>
				<ConfigTextInput
					item={configuration.promptsPath}
					onUpdate={onUpdateConfig}
					placeholder="e.g., ./src/prompts"
				/>
			</div>

			{/* Read-Only Configuration Group */}
			{configuration.otherSettings.length > 0 && (
				<div
					className="config-group welcome-subsection-divider"
					style={{
						marginTop: "8px",
					}}
				>
					<h3 className="config-group-title">
						<span>
							<i className="codicon codicon-lock" />
						</span>
						View-Only Settings
					</h3>
					<p className="config-group-description">
						These settings cannot be edited from this interface. Use the full VS
						Code settings editor to modify them.
					</p>

					<div className="config-list">
						{configuration.otherSettings.map((item) => (
							<ConfigReadOnlyItem item={item} key={item.key} />
						))}
					</div>
				</div>
			)}

			{/* Configuration Tips */}
			<div
				className="config-tips"
				style={{
					marginTop: "32px",
					padding: "16px",
					backgroundColor:
						"color-mix(in srgb, var(--vscode-textBlockQuote-background) 50%, transparent)",
					borderRadius: "4px",
					borderLeft: "3px solid var(--vscode-textLink-foreground)",
				}}
			>
				<h4
					style={{
						fontSize: "13px",
						fontWeight: 600,
						marginBottom: "8px",
						color: "var(--vscode-foreground)",
					}}
				>
					Configuration Tips
				</h4>
				<ul
					style={{
						marginLeft: "20px",
						fontSize: "12px",
						color: "var(--vscode-descriptionForeground)",
						lineHeight: "1.8",
					}}
				>
					<li>
						<strong>Spec System:</strong> Choose "auto" to detect the best
						system based on your workspace, or manually select SpecKit or
						OpenSpec.
					</li>
					<li>
						<strong>Paths:</strong> Use relative paths (starting with ./) for
						workspace-relative locations, or absolute paths for fixed locations.
					</li>
					<li>
						<strong>Validation:</strong> Path formats are validated
						automatically. Invalid values will display an error message.
					</li>
					<li>
						<strong>Persistence:</strong> All changes are saved to workspace
						settings and take effect immediately.
					</li>
				</ul>
			</div>
		</div>
	);
};

/**
 * Dropdown Input Component
 * For spec system selection with predefined options
 */
interface ConfigDropdownProps {
	item: ConfigurationItem & { options?: string[] };
	onUpdate: (key: string, value: string) => void;
}

const ConfigDropdown = ({ item, onUpdate }: ConfigDropdownProps) => {
	const options = item.options || [];

	return (
		<div className="config-item">
			<label className="config-label" htmlFor={`config-${item.key}`}>
				{item.label}
				{!item.editable && (
					<span className="config-readonly-badge">Read-only</span>
				)}
			</label>
			<select
				aria-describedby={`config-${item.key}-description`}
				className="config-input"
				disabled={!item.editable}
				id={`config-${item.key}`}
				onChange={(e) => onUpdate(item.key, e.target.value)}
				value={String(item.currentValue)}
			>
				{options.map((option) => (
					<option key={option} value={option}>
						{option.charAt(0).toUpperCase() + option.slice(1)}
					</option>
				))}
			</select>
			<p className="config-description" id={`config-${item.key}-description`}>
				{getSpecSystemDescription(String(item.currentValue))}
			</p>
		</div>
	);
};

/**
 * Text Input Component
 * For path configuration with validation
 */
interface ConfigTextInputProps {
	item: ConfigurationItem;
	onUpdate: (key: string, value: string) => void;
	placeholder?: string;
}

const ConfigTextInput = ({
	item,
	onUpdate,
	placeholder,
}: ConfigTextInputProps) => (
	<div className="config-item">
		<label className="config-label" htmlFor={`config-${item.key}`}>
			{item.label}
			{!item.editable && (
				<span className="config-readonly-badge">Read-only</span>
			)}
		</label>
		<input
			aria-describedby={`config-${item.key}-description`}
			className="config-input"
			disabled={!item.editable}
			id={`config-${item.key}`}
			onChange={(e) => onUpdate(item.key, e.target.value)}
			placeholder={placeholder}
			type="text"
			value={String(item.currentValue)}
		/>
		<p className="config-description" id={`config-${item.key}-description`}>
			{getPathDescription(item.key)}
		</p>
	</div>
);

/**
 * Read-Only Item Component
 * For non-editable configuration display
 */
interface ConfigReadOnlyItemProps {
	item: ConfigurationItem;
}

const ConfigReadOnlyItem = ({ item }: ConfigReadOnlyItemProps) => {
	let displayValue: string;
	if (typeof item.currentValue === "boolean") {
		displayValue = item.currentValue ? "Enabled" : "Disabled";
	} else {
		displayValue = String(item.currentValue);
	}

	return (
		<div className="config-readonly-item">
			<div className="config-readonly-label">
				{item.label}
				<span className="config-readonly-badge">Read-only</span>
			</div>
			<div className="config-readonly-value">{displayValue}</div>
		</div>
	);
};

/**
 * Get description for spec system option
 */
function getSpecSystemDescription(value: string): string {
	switch (value) {
		case "auto":
			return "Automatically detect the best specification system based on workspace files.";
		case "speckit":
			return "Use GitHub SpecKit for structured specification management.";
		case "openspec":
			return "Use OpenSpec standard for flexible specification workflows.";
		default:
			return "Select a specification system for your workspace.";
	}
}

/**
 * Get description for path configuration
 */
function getPathDescription(key: string): string {
	switch (key) {
		case "gatomia.speckit.specsPath":
			return "Directory where SpecKit specifications are stored.";
		case "gatomia.speckit.memoryPath":
			return "Directory for SpecKit memory files (context and history).";
		case "gatomia.speckit.templatesPath":
			return "Directory containing SpecKit templates for new specifications.";
		case "gatomia.openspec.path":
			return "Directory where OpenSpec specifications are stored.";
		case "gatomia.prompts.path":
			return "Directory containing prompt templates for AI assistance.";
		default:
			return "Configuration path for GatomIA workspace.";
	}
}
