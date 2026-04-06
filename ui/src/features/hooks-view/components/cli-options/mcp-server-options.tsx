import type { CopilotCliOptions } from "../../types";
import {
	MultiInput,
	InfoTooltip,
	CollapsibleSection,
} from "../../../../components/cli-options";
import "./mcp-server-options.css";

export interface McpServerOptionsProps {
	/** Current CLI options */
	value: CopilotCliOptions;
	/** Called when options change */
	onChange: (value: Partial<CopilotCliOptions>) => void;
	/** Whether the options are disabled */
	disabled?: boolean;
}

const GITHUB_MCP_TOOLS = [
	"issues",
	"pull-requests",
	"repositories",
	"search",
	"actions",
	"projects",
	"discussions",
];

const GITHUB_MCP_TOOLSETS = [
	"core",
	"collaboration",
	"automation",
	"analytics",
];

/**
 * McpServerOptions component for GitHub MCP and MCP server configuration.
 */
export function McpServerOptions({
	value,
	onChange,
	disabled = false,
}: McpServerOptionsProps) {
	const handleGithubToolToggle = (tool: string) => {
		const currentTools = value.addGithubMcpTool || [];
		const newTools = currentTools.includes(tool)
			? currentTools.filter((t) => t !== tool)
			: [...currentTools, tool];
		onChange({
			addGithubMcpTool: newTools.length > 0 ? newTools : undefined,
		});
	};

	const handleGithubToolsetToggle = (toolset: string) => {
		const currentToolsets = value.addGithubMcpToolset || [];
		const newToolsets = currentToolsets.includes(toolset)
			? currentToolsets.filter((t) => t !== toolset)
			: [...currentToolsets, toolset];
		onChange({
			addGithubMcpToolset: newToolsets.length > 0 ? newToolsets : undefined,
		});
	};

	return (
		<div className="mcp-server-options">
			<div className="mcp-server-header">
				<h4>
					MCP Server Configuration
					<InfoTooltip
						description="Configure GitHub MCP tools and manage which MCP servers are available to the agent."
						learnMoreUrl="https://github.com/modelcontextprotocol/specification"
						title="MCP (Model Context Protocol) Settings"
					/>
				</h4>
			</div>

			{/* GitHub MCP Tools */}
			<CollapsibleSection
				badge={
					value.addGithubMcpTool && value.addGithubMcpTool.length > 0
						? `${value.addGithubMcpTool.length} selected`
						: undefined
				}
				defaultOpen={false}
				title="GitHub MCP Tools"
			>
				<div className="mcp-server-option-group">
					<div className="mcp-checkbox-option">
						<input
							checked={value.enableAllGithubMcpTools}
							disabled={disabled}
							id="enable-all-github-tools"
							onChange={(e) =>
								onChange({ enableAllGithubMcpTools: e.target.checked })
							}
							type="checkbox"
						/>
						<label htmlFor="enable-all-github-tools">
							Enable All GitHub Tools
							<InfoTooltip
								description="Enable all available GitHub MCP tools at once. This is convenient but may grant more permissions than needed."
								title="--enable-all-github-mcp-tools"
							/>
						</label>
					</div>

					{!value.enableAllGithubMcpTools && (
						<>
							<div className="mcp-tools-grid">
								{GITHUB_MCP_TOOLS.map((tool) => (
									<div className="mcp-tool-checkbox" key={tool}>
										<input
											checked={value.addGithubMcpTool?.includes(tool)}
											disabled={disabled}
											id={`github-tool-${tool}`}
											onChange={() => handleGithubToolToggle(tool)}
											type="checkbox"
										/>
										<label htmlFor={`github-tool-${tool}`}>{tool}</label>
									</div>
								))}
							</div>

							<div className="mcp-toolsets-section">
								<h5>
									Toolsets
									<InfoTooltip
										description="Select predefined toolset groups that include multiple related tools."
										title="--add-github-mcp-toolset"
									/>
								</h5>
								<div className="mcp-tools-grid">
									{GITHUB_MCP_TOOLSETS.map((toolset) => (
										<div className="mcp-tool-checkbox" key={toolset}>
											<input
												checked={value.addGithubMcpToolset?.includes(toolset)}
												disabled={disabled}
												id={`github-toolset-${toolset}`}
												onChange={() => handleGithubToolsetToggle(toolset)}
												type="checkbox"
											/>
											<label htmlFor={`github-toolset-${toolset}`}>
												{toolset}
											</label>
										</div>
									))}
								</div>
							</div>
						</>
					)}
				</div>
			</CollapsibleSection>

			{/* MCP Server Management */}
			<CollapsibleSection
				badge={
					value.disableBuiltinMcps || (value.disableMcpServer?.length ?? 0) > 0
						? "Custom"
						: undefined
				}
				defaultOpen={false}
				title="MCP Server Management"
			>
				<div className="mcp-server-option-group">
					<div className="mcp-checkbox-option">
						<input
							checked={value.disableBuiltinMcps}
							disabled={disabled}
							id="disable-builtin-mcps"
							onChange={(e) =>
								onChange({ disableBuiltinMcps: e.target.checked })
							}
							type="checkbox"
						/>
						<label htmlFor="disable-builtin-mcps">
							Disable All Built-in MCPs
							<InfoTooltip
								description="Disable all built-in MCP servers. Use this if you want to use only custom MCP servers."
								title="--disable-builtin-mcps"
								warning="Disabling built-in MCPs may limit agent capabilities."
							/>
						</label>
					</div>

					<div className="mcp-server-option">
						<MultiInput
							disabled={disabled}
							label="Disable Specific MCP Servers"
							onChange={(disableMcpServer) =>
								onChange({
									disableMcpServer:
										disableMcpServer.length > 0 ? disableMcpServer : undefined,
								})
							}
							placeholder='e.g., "filesystem", "git"'
							value={value.disableMcpServer || []}
						/>
						<InfoTooltip
							description="List specific MCP server names to disable. Useful for selectively disabling servers while keeping others enabled."
							title="--disable-mcp-server"
						/>
					</div>

					<div className="mcp-server-option">
						<MultiInput
							disabled={disabled}
							label="Additional MCP Configuration"
							onChange={(additionalMcpConfig) =>
								onChange({
									additionalMcpConfig:
										additionalMcpConfig.length > 0
											? additionalMcpConfig
											: undefined,
								})
							}
							placeholder='e.g., "./mcp-servers.json"'
							value={value.additionalMcpConfig || []}
						/>
						<InfoTooltip
							description="Paths to JSON files containing additional MCP server configurations. Use this to add custom MCP servers."
							title="--additional-mcp-config"
						/>
					</div>
				</div>
			</CollapsibleSection>
		</div>
	);
}
