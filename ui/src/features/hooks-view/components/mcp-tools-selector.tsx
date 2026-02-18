import { useMemo, useState } from "react";
import { VSCodeCheckbox } from "@/components/ui/vscode-checkbox";
import type {
	MCPProviderGroup,
	MCPToolOption,
	SelectedMCPTool,
} from "../types";
import { groupToolsByProvider } from "../hooks/use-mcp-servers";
import type { MCPServer } from "../hooks/use-mcp-servers";

export interface MCPToolsSelectorProps {
	servers: MCPServer[];
	selectedTools: SelectedMCPTool[];
	onSelectionChange: (selectedTools: SelectedMCPTool[]) => void;
	disabled?: boolean;
}

/**
 * Filters a list of provider groups by a search query.
 * Returns only groups that have at least one matching tool.
 */
const filterGroups = (
	groups: MCPProviderGroup[],
	query: string
): MCPProviderGroup[] => {
	if (!query.trim()) {
		return groups;
	}

	const lowerQuery = query.toLowerCase();

	return groups
		.map((group) => ({
			...group,
			tools: group.tools.filter(
				(tool) =>
					tool.toolDisplayName.toLowerCase().includes(lowerQuery) ||
					tool.toolName.toLowerCase().includes(lowerQuery) ||
					tool.description.toLowerCase().includes(lowerQuery)
			),
		}))
		.filter((group) => group.tools.length > 0);
};

/**
 * Converts an MCPToolOption into a SelectedMCPTool given its parent group.
 */
const toSelectedTool = (
	group: MCPProviderGroup,
	tool: MCPToolOption
): SelectedMCPTool => ({
	serverId: group.serverId,
	serverName: group.serverName,
	toolName: tool.toolName,
	toolDisplayName: tool.toolDisplayName,
});

export function MCPToolsSelector({
	servers,
	selectedTools,
	onSelectionChange,
	disabled = false,
}: MCPToolsSelectorProps): JSX.Element {
	const [searchQuery, setSearchQuery] = useState("");
	const [expandedServers, setExpandedServers] = useState<Set<string>>(
		new Set()
	);

	const groups = useMemo(
		() => groupToolsByProvider(servers, selectedTools),
		[servers, selectedTools]
	);

	const filteredGroups = useMemo(
		() => filterGroups(groups, searchQuery),
		[groups, searchQuery]
	);

	const toggleServer = (serverId: string): void => {
		const newExpanded = new Set(expandedServers);
		if (newExpanded.has(serverId)) {
			newExpanded.delete(serverId);
		} else {
			newExpanded.add(serverId);
		}
		setExpandedServers(newExpanded);
	};

	const getGroupSelectionState = (
		group: MCPProviderGroup
	): "all" | "some" | "none" => {
		if (group.tools.length === 0) {
			return "none";
		}

		const selectedCount = group.tools.filter((t) => t.isSelected).length;

		if (selectedCount === 0) {
			return "none";
		}
		if (selectedCount === group.tools.length) {
			return "all";
		}
		return "some";
	};

	const handleToolToggle = (
		group: MCPProviderGroup,
		tool: MCPToolOption
	): void => {
		if (disabled) {
			return;
		}

		let newSelection: SelectedMCPTool[];

		if (tool.isSelected) {
			newSelection = selectedTools.filter(
				(t) => !(t.serverId === group.serverId && t.toolName === tool.toolName)
			);
		} else {
			newSelection = [...selectedTools, toSelectedTool(group, tool)];
		}

		onSelectionChange(newSelection);
	};

	const handleGroupToggle = (group: MCPProviderGroup): void => {
		if (disabled) {
			return;
		}

		const state = getGroupSelectionState(group);
		let newSelection: SelectedMCPTool[];

		if (state === "all") {
			newSelection = selectedTools.filter((t) => t.serverId !== group.serverId);
		} else {
			const toolsToAdd = group.tools
				.filter((tool) => !tool.isSelected)
				.map((tool) => toSelectedTool(group, tool));

			newSelection = [...selectedTools, ...toolsToAdd];
		}

		onSelectionChange(newSelection);
	};

	const totalSelected = selectedTools.length;

	return (
		<div className="flex flex-col gap-3">
			<div className="flex items-center justify-between">
				<span
					className="font-medium text-sm"
					style={{ color: "var(--vscode-foreground)" }}
				>
					Select MCP Tools
				</span>
				{totalSelected > 0 && (
					<span
						className="rounded px-2 py-1 text-xs"
						style={{
							backgroundColor: "var(--vscode-badge-background)",
							color: "var(--vscode-badge-foreground)",
						}}
					>
						{totalSelected} selected
					</span>
				)}
			</div>

			<input
				className="w-full rounded border px-3 py-2 text-sm"
				disabled={disabled}
				onChange={(e) => setSearchQuery(e.target.value)}
				placeholder="Search tools..."
				style={{
					backgroundColor: "var(--vscode-input-background)",
					color: "var(--vscode-input-foreground)",
					borderColor: "var(--vscode-input-border)",
				}}
				type="text"
				value={searchQuery}
			/>

			<div
				className="max-h-96 overflow-y-auto rounded border"
				style={{
					borderColor: "var(--vscode-panel-border)",
				}}
			>
				{filteredGroups.length === 0 ? (
					<div
						className="p-4 text-center text-sm"
						style={{ color: "var(--vscode-descriptionForeground)" }}
					>
						{searchQuery
							? "No tools match your search"
							: "No MCP tools available"}
					</div>
				) : (
					<div
						className="divide-y"
						style={{ borderColor: "var(--vscode-panel-border)" }}
					>
						{filteredGroups.map((group) => {
							const selectionState = getGroupSelectionState(group);
							const isExpanded = expandedServers.has(group.serverId);
							const selectedCount = group.tools.filter(
								(t) => t.isSelected
							).length;

							return (
								<div key={group.serverId}>
									<div
										className="flex items-center gap-2 px-3 py-2 transition-colors hover:bg-opacity-50"
										style={{
											backgroundColor: isExpanded
												? "var(--vscode-list-activeSelectionBackground)"
												: "transparent",
										}}
									>
										<VSCodeCheckbox
											checked={selectionState === "all"}
											disabled={disabled}
											indeterminate={selectionState === "some"}
											onChange={() => handleGroupToggle(group)}
										/>

										<button
											className="flex flex-1 items-center gap-2 text-left font-medium text-sm"
											disabled={disabled}
											onClick={() => toggleServer(group.serverId)}
											style={{
												color: "var(--vscode-foreground)",
											}}
											type="button"
										>
											<span className="text-xs">{isExpanded ? "▼" : "▶"}</span>
											<span>{group.serverName}</span>
											<span
												className="text-xs"
												style={{
													color: "var(--vscode-descriptionForeground)",
												}}
											>
												({selectedCount}/{group.tools.length})
											</span>
										</button>
									</div>

									{isExpanded && (
										<div
											className="divide-y"
											style={{ borderColor: "var(--vscode-panel-border)" }}
										>
											{group.tools.map((tool) => {
												const toolId = `tool-${group.serverId}-${tool.toolName}`;

												return (
													<label
														className="flex cursor-pointer items-start gap-2 px-3 py-2 pl-10 transition-colors hover:bg-opacity-50"
														htmlFor={toolId}
														key={tool.toolName}
														style={{
															backgroundColor: tool.isSelected
																? "var(--vscode-list-hoverBackground)"
																: "transparent",
														}}
													>
														<VSCodeCheckbox
															checked={tool.isSelected}
															className="mt-0.5"
															disabled={disabled}
															id={toolId}
															onChange={() => handleToolToggle(group, tool)}
														/>

														<span className="min-w-0 flex-1">
															<span
																className="block font-medium text-sm"
																style={{ color: "var(--vscode-foreground)" }}
															>
																{tool.toolDisplayName}
															</span>
															{tool.description && (
																<span
																	className="mt-1 block text-xs"
																	style={{
																		color:
																			"var(--vscode-descriptionForeground)",
																	}}
																>
																	{tool.description}
																</span>
															)}
														</span>
													</label>
												);
											})}
										</div>
									)}
								</div>
							);
						})}
					</div>
				)}
			</div>
		</div>
	);
}
