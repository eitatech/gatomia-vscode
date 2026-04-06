import { useState } from "react";
import type { CopilotCliOptions } from "../../../types";
import { CollapsibleSection } from "../../../../components/cli-options";
import { PermissionOptions } from "./permission-options";
import { ModelExecutionOptions } from "./model-execution-options";
import { McpServerOptions } from "./mcp-server-options";
import { OutputLoggingOptions } from "./output-logging-options";
import { SessionConfigOptions } from "./session-config-options";
import "./copilot-cli-options-panel.css";

export interface CopilotCliOptionsPanelProps {
	/** Current CLI options */
	value: CopilotCliOptions;
	/** Called when options change */
	onChange: (value: CopilotCliOptions) => void;
	/** Whether the options are disabled */
	disabled?: boolean;
}

type TabId = "permissions" | "model" | "mcp" | "output" | "session";

const TABS: { id: TabId; label: string }[] = [
	{ id: "permissions", label: "Permissions" },
	{ id: "model", label: "Model & Execution" },
	{ id: "mcp", label: "MCP Servers" },
	{ id: "output", label: "Output & Logging" },
	{ id: "session", label: "Session & Config" },
];

/**
 * CopilotCliOptionsPanel - Main component for configuring GitHub Copilot CLI options.
 * Provides a tabbed interface for organizing all CLI configuration options.
 */
export function CopilotCliOptionsPanel({
	value,
	onChange,
	disabled = false,
}: CopilotCliOptionsPanelProps) {
	const [activeTab, setActiveTab] = useState<TabId>("permissions");
	const [isOpen, setIsOpen] = useState(false);

	const handlePartialChange = (partial: Partial<CopilotCliOptions>) => {
		onChange({ ...value, ...partial });
	};

	// Count how many options are set
	const hasOptions = Object.keys(value).length > 0;
	const optionsCount = Object.keys(value).filter(
		(key) => value[key as keyof CopilotCliOptions] !== undefined
	).length;

	return (
		<div className="copilot-cli-options-panel">
			<CollapsibleSection
				badge={hasOptions ? `${optionsCount} set` : undefined}
				defaultOpen={isOpen}
				onToggle={setIsOpen}
				title="Advanced CLI Options"
			>
				<div className="copilot-cli-options-content">
					{/* Tab Navigation */}
					<div className="copilot-cli-options-tabs" role="tablist">
						{TABS.map((tab) => (
							<button
								aria-selected={activeTab === tab.id}
								className={`copilot-cli-tab ${activeTab === tab.id ? "active" : ""}`}
								disabled={disabled}
								key={tab.id}
								onClick={() => setActiveTab(tab.id)}
								role="tab"
								type="button"
							>
								{tab.label}
							</button>
						))}
					</div>

					{/* Tab Panels */}
					<div className="copilot-cli-options-tab-content">
						{activeTab === "permissions" && (
							<PermissionOptions
								disabled={disabled}
								onChange={handlePartialChange}
								value={value}
							/>
						)}
						{activeTab === "model" && (
							<ModelExecutionOptions
								disabled={disabled}
								onChange={handlePartialChange}
								value={value}
							/>
						)}
						{activeTab === "mcp" && (
							<McpServerOptions
								disabled={disabled}
								onChange={handlePartialChange}
								value={value}
							/>
						)}
						{activeTab === "output" && (
							<OutputLoggingOptions
								disabled={disabled}
								onChange={handlePartialChange}
								value={value}
							/>
						)}
						{activeTab === "session" && (
							<SessionConfigOptions
								disabled={disabled}
								onChange={handlePartialChange}
								value={value}
							/>
						)}
					</div>
				</div>
			</CollapsibleSection>
		</div>
	);
}
