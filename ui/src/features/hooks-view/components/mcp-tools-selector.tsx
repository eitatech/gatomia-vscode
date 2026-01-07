import { useMemo, useState } from "react";
import { VSCodeCheckbox } from "@/components/ui/vscode-checkbox";
import type { SelectedMCPTool } from "../types";
import type { MCPServer } from "../hooks/use-mcp-servers";

export interface MCPToolsSelectorProps {
	servers: MCPServer[];
	selectedTools: SelectedMCPTool[];
	onSelectionChange: (selectedTools: SelectedMCPTool[]) => void;
	disabled?: boolean;
}

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

	// Servers já vêm agrupados do backend, apenas ordenamos por nome
	const sortedServers = useMemo(
		() => [...servers].sort((a, b) => a.name.localeCompare(b.name)),
		[servers]
	);

	const filteredServers = useMemo(() => {
		if (!searchQuery.trim()) {
			return sortedServers;
		}

		const query = searchQuery.toLowerCase();
		return sortedServers
			.map((server) => ({
				...server,
				tools: server.tools.filter(
					(tool) =>
						tool.displayName.toLowerCase().includes(query) ||
						tool.name.toLowerCase().includes(query) ||
						tool.description?.toLowerCase().includes(query)
				),
			}))
			.filter((server) => server.tools.length > 0);
	}, [sortedServers, searchQuery]);

	const toggleServer = (serverId: string): void => {
		const newExpanded = new Set(expandedServers);
		if (newExpanded.has(serverId)) {
			newExpanded.delete(serverId);
		} else {
			newExpanded.add(serverId);
		}
		setExpandedServers(newExpanded);
	};

	const isToolSelected = (serverId: string, toolName: string): boolean =>
		selectedTools.some(
			(t) => t.serverId === serverId && t.toolName === toolName
		);

	const getServerSelectionState = (
		serverId: string
	): "all" | "some" | "none" => {
		const server = servers.find((s) => s.id === serverId);
		if (!server || server.tools.length === 0) {
			return "none";
		}

		const selectedCount = server.tools.filter((tool) =>
			isToolSelected(serverId, tool.name)
		).length;

		if (selectedCount === 0) {
			return "none";
		}
		if (selectedCount === server.tools.length) {
			return "all";
		}
		return "some";
	};

	const handleToolToggle = (
		serverId: string,
		serverName: string,
		toolName: string,
		toolDisplayName: string
	): void => {
		if (disabled) {
			return;
		}

		const isSelected = isToolSelected(serverId, toolName);
		let newSelection: SelectedMCPTool[];

		if (isSelected) {
			newSelection = selectedTools.filter(
				(t) => !(t.serverId === serverId && t.toolName === toolName)
			);
		} else {
			newSelection = [
				...selectedTools,
				{ serverId, serverName, toolName, toolDisplayName },
			];
		}

		onSelectionChange(newSelection);
	};

	const handleServerToggle = (serverId: string, serverName: string): void => {
		if (disabled) {
			return;
		}

		const server = servers.find((s) => s.id === serverId);
		if (!server) {
			return;
		}

		const state = getServerSelectionState(serverId);
		let newSelection: SelectedMCPTool[];

		if (state === "all") {
			// Deselecionar todas as tools deste servidor
			newSelection = selectedTools.filter((t) => t.serverId !== serverId);
		} else {
			// Selecionar todas as tools deste servidor
			const toolsToAdd = server.tools
				.filter((tool) => !isToolSelected(serverId, tool.name))
				.map((tool) => ({
					serverId,
					serverName,
					toolName: tool.name,
					toolDisplayName: tool.displayName,
				}));

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
				{filteredServers.length === 0 ? (
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
						{filteredServers.map((server) => {
							const selectionState = getServerSelectionState(server.id);
							const isExpanded = expandedServers.has(server.id);
							const selectedCount = server.tools.filter((tool) =>
								isToolSelected(server.id, tool.name)
							).length;

							return (
								<div key={server.id}>
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
											onChange={() =>
												handleServerToggle(server.id, server.name)
											}
										/>

										<button
											className="flex flex-1 items-center gap-2 text-left font-medium text-sm"
											disabled={disabled}
											onClick={() => toggleServer(server.id)}
											style={{
												color: "var(--vscode-foreground)",
											}}
											type="button"
										>
											<span className="text-xs">{isExpanded ? "▼" : "▶"}</span>
											<span>{server.name}</span>
											<span
												className="text-xs"
												style={{ color: "var(--vscode-descriptionForeground)" }}
											>
												({selectedCount}/{server.tools.length})
											</span>
										</button>
									</div>

									{isExpanded && (
										<div
											className="divide-y"
											style={{ borderColor: "var(--vscode-panel-border)" }}
										>
											{server.tools.map((tool) => {
												const isSelected = isToolSelected(server.id, tool.name);
												const toolId = `tool-${server.id}-${tool.name}`;

												return (
													<label
														className="flex cursor-pointer items-start gap-2 px-3 py-2 pl-10 transition-colors hover:bg-opacity-50"
														htmlFor={toolId}
														key={tool.name}
														style={{
															backgroundColor: isSelected
																? "var(--vscode-list-hoverBackground)"
																: "transparent",
														}}
													>
														<VSCodeCheckbox
															checked={isSelected}
															className="mt-0.5"
															disabled={disabled}
															id={toolId}
															onChange={() =>
																handleToolToggle(
																	server.id,
																	server.name,
																	tool.name,
																	tool.displayName
																)
															}
														/>

														<span className="min-w-0 flex-1">
															<span
																className="block font-medium text-sm"
																style={{ color: "var(--vscode-foreground)" }}
															>
																{tool.displayName}
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
