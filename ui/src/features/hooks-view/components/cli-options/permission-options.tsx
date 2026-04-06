import React from "react";
import type { CopilotCliOptions } from "../../types";
import {
	MultiInput,
	InfoTooltip,
	CollapsibleSection,
} from "../../../../components/cli-options";
import "./permission-options.css";

export interface PermissionOptionsProps {
	/** Current CLI options */
	value: CopilotCliOptions;
	/** Called when options change */
	onChange: (value: Partial<CopilotCliOptions>) => void;
	/** Whether the options are disabled */
	disabled?: boolean;
}

type PresetType = "allow-all" | "safe-mode" | "custom";

/**
 * Compute badge text for tool permissions
 */
function getToolPermissionBadge(value: CopilotCliOptions): string | undefined {
	if (value.allowTool && value.allowTool.length > 0) {
		return `${value.allowTool.length} allowed`;
	}
	if (value.allowAllTools) {
		return "All allowed";
	}
	return;
}

/**
 * Compute badge text for path permissions
 */
function getPathPermissionBadge(value: CopilotCliOptions): string | undefined {
	if (value.addDir && value.addDir.length > 0) {
		return `${value.addDir.length} directories`;
	}
	if (value.allowAllPaths) {
		return "All paths allowed";
	}
	return;
}

/**
 * Compute badge text for URL permissions
 */
function getUrlPermissionBadge(value: CopilotCliOptions): string | undefined {
	if (value.allowUrl && value.allowUrl.length > 0) {
		return `${value.allowUrl.length} URLs`;
	}
	if (value.allowAllUrls) {
		return "All URLs allowed";
	}
	return;
}

/**
 * Apply a permission preset
 */
function applyPermissionPreset(
	preset: PresetType,
	onChange: (value: Partial<CopilotCliOptions>) => void
): void {
	switch (preset) {
		case "allow-all":
			onChange({
				allowAllTools: true,
				allowAllPaths: true,
				allowAllUrls: true,
				allowTool: undefined,
				addDir: undefined,
				allowUrl: undefined,
				denyTool: undefined,
				denyUrl: undefined,
			});
			break;
		case "safe-mode":
			onChange({
				allowAllTools: false,
				allowAllPaths: false,
				allowAllUrls: false,
				allowTool: ["read", "search", "analyze"],
				addDir: ["."],
				allowUrl: undefined,
				denyTool: ["exec", "shell", "write"],
				denyUrl: undefined,
			});
			break;
		default:
			// Don't clear existing values for custom preset
			break;
	}
}

/**
 * PermissionOptions component for configuring tool, path, and URL permissions.
 * Includes preset options for common use cases.
 */
export function PermissionOptions({
	value,
	onChange,
	disabled = false,
}: PermissionOptionsProps) {
	const [selectedPreset, setSelectedPreset] =
		React.useState<PresetType>("custom");

	const handlePresetChange = (preset: PresetType) => {
		setSelectedPreset(preset);
		applyPermissionPreset(preset, onChange);
	};

	return (
		<div className="permission-options">
			<div className="permission-options-header">
				<h4>
					Permissions
					<InfoTooltip
						description="Control what tools, file paths, and URLs the agent can access during execution. This is critical for security when running autonomous agents."
						title="--allow-tool, --add-dir, --allow-url"
						warning="Using 'Allow All' gives the agent unrestricted access. Only use in trusted environments."
					/>
				</h4>
			</div>

			{/* Preset Selector */}
			<div className="permission-preset-buttons">
				<button
					className={`preset-button ${selectedPreset === "safe-mode" ? "active" : ""}`}
					disabled={disabled}
					onClick={() => handlePresetChange("safe-mode")}
					type="button"
				>
					<span className="preset-button-icon">🛡️</span>
					<span className="preset-button-label">Safe Mode (Recommended)</span>
				</button>
				<button
					className={`preset-button ${selectedPreset === "allow-all" ? "active" : ""}`}
					disabled={disabled}
					onClick={() => handlePresetChange("allow-all")}
					type="button"
				>
					<span className="preset-button-icon">🔓</span>
					<span className="preset-button-label">Allow All</span>
				</button>
				<button
					className={`preset-button ${selectedPreset === "custom" ? "active" : ""}`}
					disabled={disabled}
					onClick={() => {
						setSelectedPreset("custom");
					}}
					type="button"
				>
					<span className="preset-button-icon">⚙️</span>
					<span className="preset-button-label">Custom</span>
				</button>
			</div>

			{/* Tool Permissions */}
			<CollapsibleSection
				badge={getToolPermissionBadge(value)}
				defaultOpen={selectedPreset === "custom"}
				title="Tool Permissions"
			>
				<div className="permission-option-group">
					<div className="permission-checkbox-row">
						<input
							checked={value.allowAllTools}
							disabled={disabled}
							id="allow-all-tools-checkbox"
							onChange={(e) => {
								onChange({ allowAllTools: e.target.checked });
								setSelectedPreset("custom");
							}}
							type="checkbox"
						/>
						<label htmlFor="allow-all-tools-checkbox">
							Allow All Tools
							<InfoTooltip
								description="Enable all available MCP tools at once. This is convenient but grants maximum permissions."
								title="--allow-all-tools"
								warning="This gives the agent access to all tools, including potentially dangerous ones."
							/>
						</label>
					</div>

					{!value.allowAllTools && (
						<>
							<div className="permission-option-row">
								<MultiInput
									disabled={disabled}
									label="Allow Tools"
									onChange={(allowTool) => {
										onChange({ allowTool });
										setSelectedPreset("custom");
									}}
									placeholder='e.g., "git", "npm"'
									value={value.allowTool || []}
								/>
								<InfoTooltip
									description='Whitelist specific MCP tools the agent can use. Examples: "git", "github", "web-search"'
									title="--allow-tool"
								/>
							</div>

							<div className="permission-option-row">
								<MultiInput
									disabled={disabled}
									label="Deny Tools"
									onChange={(denyTool) => {
										onChange({ denyTool });
										setSelectedPreset("custom");
									}}
									placeholder='e.g., "exec", "shell"'
									value={value.denyTool || []}
								/>
								<InfoTooltip
									description='Blacklist specific tools. This takes precedence over allow rules. Examples: "exec", "shell", "write"'
									title="--deny-tool"
									warning="Deny rules override allow rules."
								/>
							</div>
						</>
					)}
				</div>
			</CollapsibleSection>

			{/* File/Directory Access */}
			<CollapsibleSection
				badge={getPathPermissionBadge(value)}
				defaultOpen={selectedPreset === "custom"}
				title="File & Directory Access"
			>
				<div className="permission-option-group">
					<div className="permission-checkbox-row">
						<input
							checked={value.allowAllPaths}
							disabled={disabled}
							id="allow-all-paths-checkbox"
							onChange={(e) => {
								onChange({ allowAllPaths: e.target.checked });
								setSelectedPreset("custom");
							}}
							type="checkbox"
						/>
						<label htmlFor="allow-all-paths-checkbox">
							Allow All Paths
							<InfoTooltip
								description="Grant access to all file system paths. Use with caution."
								title="--allow-all-paths"
								warning="This allows access to the entire file system."
							/>
						</label>
					</div>

					{!value.allowAllPaths && (
						<>
							<div className="permission-option-row">
								<MultiInput
									disabled={disabled}
									label="Add Directories"
									onChange={(addDir) => {
										onChange({ addDir });
										setSelectedPreset("custom");
									}}
									placeholder='e.g., ".", "./src", "/tmp"'
									value={value.addDir || []}
								/>
								<InfoTooltip
									description='Add directories the agent can access. Use "." for current directory. Supports glob patterns.'
									title="--add-dir"
								/>
							</div>

							<div className="permission-checkbox-row">
								<input
									checked={value.disallowTempDir}
									disabled={disabled}
									id="disallow-temp-dir-checkbox"
									onChange={(e) => {
										onChange({ disallowTempDir: e.target.checked });
										setSelectedPreset("custom");
									}}
									type="checkbox"
								/>
								<label htmlFor="disallow-temp-dir-checkbox">
									Disallow Temp Directory
									<InfoTooltip
										description="Prevent access to temporary directories. Improves security by blocking temp file operations."
										title="--disallow-temp-dir"
									/>
								</label>
							</div>
						</>
					)}
				</div>
			</CollapsibleSection>

			{/* URL Access */}
			<CollapsibleSection
				badge={getUrlPermissionBadge(value)}
				defaultOpen={selectedPreset === "custom"}
				title="URL Access"
			>
				<div className="permission-option-group">
					<div className="permission-checkbox-row">
						<input
							checked={value.allowAllUrls}
							disabled={disabled}
							id="allow-all-urls-checkbox"
							onChange={(e) => {
								onChange({ allowAllUrls: e.target.checked });
								setSelectedPreset("custom");
							}}
							type="checkbox"
						/>
						<label htmlFor="allow-all-urls-checkbox">
							Allow All URLs
							<InfoTooltip
								description="Allow fetching from any URL. Use with caution in trusted environments."
								title="--allow-all-urls"
								warning="This allows the agent to access any external URL."
							/>
						</label>
					</div>

					{!value.allowAllUrls && (
						<>
							<div className="permission-option-row">
								<MultiInput
									disabled={disabled}
									label="Allow URLs"
									onChange={(allowUrl) => {
										onChange({ allowUrl });
										setSelectedPreset("custom");
									}}
									placeholder='e.g., "https://api.github.com"'
									value={value.allowUrl || []}
								/>
								<InfoTooltip
									description="Whitelist URLs the agent can fetch from. Supports wildcards. Examples: https://api.github.com, https://*.example.com"
									title="--allow-url"
								/>
							</div>

							<div className="permission-option-row">
								<MultiInput
									disabled={disabled}
									label="Deny URLs"
									onChange={(denyUrl) => {
										onChange({ denyUrl });
										setSelectedPreset("custom");
									}}
									placeholder='e.g., "http://localhost"'
									value={value.denyUrl || []}
								/>
								<InfoTooltip
									description="Blacklist specific URLs or patterns. Use this to block access to internal services or sensitive endpoints."
									title="--deny-url"
									warning="Deny rules override allow rules."
								/>
							</div>
						</>
					)}
				</div>
			</CollapsibleSection>
		</div>
	);
}
