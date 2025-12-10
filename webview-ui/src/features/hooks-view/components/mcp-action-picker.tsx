import type { ChangeEvent } from "react";
import { useCallback, useState } from "react";

/**
 * MCP Server representation from discovery
 */
export interface MCPServer {
	id: string;
	name: string;
	description: string;
	status: "available" | "unavailable" | "unknown";
	tools: MCPTool[];
	lastDiscovered: number;
}

/**
 * MCP Tool (action) representation
 */
export interface MCPTool {
	name: string;
	displayName: string;
	description: string;
	inputSchema: JSONSchema;
	serverId: string;
}

/**
 * JSON Schema definition for tool parameters
 */
export interface JSONSchema {
	type: string;
	properties?: Record<string, JSONSchemaProperty>;
	required?: string[];
}

/**
 * JSON Schema property definition
 */
export interface JSONSchemaProperty {
	type: string;
	description?: string;
	enum?: string[];
}

/**
 * Selected MCP action information
 */
export interface MCPActionSelection {
	serverId: string;
	serverName: string;
	toolName: string;
	toolDisplayName: string;
	inputSchema: JSONSchema;
}

export interface MCPActionPickerProps {
	servers?: MCPServer[];
	loading?: boolean;
	error?: string;
	disabled?: boolean;
	onSelectionChange?: (selection: MCPActionSelection | null) => void;
}

/**
 * MCPActionPicker Component
 *
 * Displays a tree view of MCP servers and their available tools.
 * Users can search, expand servers, and select a tool to use as a hook action.
 *
 * Features:
 * - Tree structure with servers as parent nodes, tools as children
 * - Search/filter by server or tool name
 * - Visual status indicators (available/unavailable/unknown)
 * - Selection tracking with callback
 * - Loading and error states
 */
export const MCPActionPicker = ({
	servers = [],
	loading = false,
	error,
	disabled = false,
	onSelectionChange,
}: MCPActionPickerProps) => {
	// Search filter state
	const [searchQuery, setSearchQuery] = useState("");

	// Expanded servers state (track which servers are expanded)
	const [expandedServers, setExpandedServers] = useState<Set<string>>(
		new Set()
	);

	// Selected action state
	const [selectedAction, setSelectedAction] =
		useState<MCPActionSelection | null>(null);

	/**
	 * Handle search input change
	 */
	const handleSearchChange = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			setSearchQuery(event.target.value);
		},
		[]
	);

	/**
	 * Toggle server expansion state
	 */
	const toggleServerExpansion = useCallback((serverId: string) => {
		setExpandedServers((prev) => {
			const next = new Set(prev);
			if (next.has(serverId)) {
				next.delete(serverId);
			} else {
				next.add(serverId);
			}
			return next;
		});
	}, []);

	/**
	 * Handle tool selection
	 */
	const handleToolSelection = useCallback(
		(server: MCPServer, tool: MCPTool) => {
			const selection: MCPActionSelection = {
				serverId: server.id,
				serverName: server.name,
				toolName: tool.name,
				toolDisplayName: tool.displayName,
				inputSchema: tool.inputSchema,
			};

			setSelectedAction(selection);
			onSelectionChange?.(selection);
		},
		[onSelectionChange]
	);

	/**
	 * Filter servers and tools based on search query
	 */
	const filteredServers = servers.filter((server) => {
		if (!searchQuery.trim()) {
			return true;
		}

		const query = searchQuery.toLowerCase();
		const serverNameMatch = server.name.toLowerCase().includes(query);
		const serverDescMatch = server.description.toLowerCase().includes(query);
		const toolMatch = server.tools.some(
			(tool) =>
				tool.displayName.toLowerCase().includes(query) ||
				tool.name.toLowerCase().includes(query) ||
				tool.description.toLowerCase().includes(query)
		);

		return serverNameMatch || serverDescMatch || toolMatch;
	});

	/**
	 * Get status badge color
	 */
	const getStatusColor = (status: MCPServer["status"]): string => {
		switch (status) {
			case "available":
				return "bg-green-500";
			case "unavailable":
				return "bg-red-500";
			default:
				return "bg-gray-500";
		}
	};

	// Loading state
	if (loading) {
		return (
			<div className="flex items-center justify-center p-8">
				<div className="text-gray-500 text-sm">Discovering MCP servers...</div>
			</div>
		);
	}

	// Error state
	if (error) {
		return (
			<div className="rounded border border-red-500 bg-red-50 p-4">
				<div className="text-red-700 text-sm">
					<strong>Error:</strong> {error}
				</div>
			</div>
		);
	}

	// Empty state
	if (servers.length === 0) {
		return (
			<div className="rounded border border-gray-300 bg-gray-50 p-8 text-center">
				<div className="text-gray-600 text-sm">
					No MCP servers found. Make sure you have MCP servers configured in
					GitHub Copilot.
				</div>
			</div>
		);
	}

	return (
		<div className="space-y-4">
			{/* Search Input */}
			<div className="relative">
				<input
					className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100"
					disabled={disabled}
					onChange={handleSearchChange}
					placeholder="Search servers and tools..."
					type="text"
					value={searchQuery}
				/>
			</div>

			{/* Server Tree View */}
			<div className="space-y-2">
				{filteredServers.length === 0 ? (
					<div className="py-4 text-center text-gray-500 text-sm">
						No servers or tools match your search.
					</div>
				) : (
					filteredServers.map((server) => (
						<div className="rounded border border-gray-300" key={server.id}>
							{/* Server Header */}
							<button
								className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-gray-50 disabled:cursor-not-allowed disabled:bg-gray-100"
								disabled={disabled}
								onClick={() => toggleServerExpansion(server.id)}
								type="button"
							>
								{/* Expansion Icon */}
								<span className="text-gray-500">
									{expandedServers.has(server.id) ? "▼" : "▶"}
								</span>

								{/* Status Badge */}
								<span
									className={`h-2 w-2 rounded-full ${getStatusColor(server.status)}`}
									title={server.status}
								/>

								{/* Server Name */}
								<span className="flex-1 font-medium text-sm">
									{server.name}
								</span>

								{/* Tool Count */}
								<span className="text-gray-500 text-xs">
									{server.tools.length} tools
								</span>
							</button>

							{/* Tools List (when expanded) */}
							{expandedServers.has(server.id) && (
								<div className="border-gray-300 border-t bg-gray-50">
									{" "}
									{/* Warning for unavailable servers */}
									{server.status === "unavailable" && (
										<div className="mx-3 my-2 rounded border border-yellow-400 bg-yellow-50 px-3 py-2">
											<div className="flex items-start gap-2">
												<span className="text-yellow-600">⚠️</span>
												<div className="flex-1 text-xs text-yellow-800">
													<strong>Server Unavailable</strong>
													<p className="mt-1">
														This MCP server is currently unavailable. Tools may
														not execute properly. Please check your Copilot
														configuration.
													</p>
												</div>
											</div>
										</div>
									)}
									{/* Warning for unknown status servers */}
									{server.status === "unknown" && (
										<div className="mx-3 my-2 rounded border border-gray-400 bg-gray-50 px-3 py-2">
											<div className="flex items-start gap-2">
												<span className="text-gray-600">ℹ️</span>
												<div className="flex-1 text-gray-700 text-xs">
													<strong>Server Status Unknown</strong>
													<p className="mt-1">
														Unable to verify server availability. Proceed with
														caution.
													</p>
												</div>
											</div>
										</div>
									)}
									{server.tools.length === 0 ? (
										<div className="px-8 py-2 text-gray-500 text-sm">
											No tools available
										</div>
									) : (
										<div className="divide-y divide-gray-200">
											{server.tools.map((tool) => {
												const isSelected =
													selectedAction?.serverId === server.id &&
													selectedAction?.toolName === tool.name;

												return (
													<button
														className={`w-full px-8 py-2 text-left text-sm hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 ${
															isSelected
																? "bg-blue-100 font-medium text-blue-700"
																: "text-gray-700"
														}`}
														disabled={
															disabled || server.status === "unavailable"
														}
														key={tool.name}
														onClick={() => handleToolSelection(server, tool)}
														type="button"
													>
														<div className="font-medium">
															{tool.displayName}
														</div>
														{tool.description && (
															<div className="mt-1 text-gray-500 text-xs">
																{tool.description}
															</div>
														)}
													</button>
												);
											})}
										</div>
									)}
								</div>
							)}
						</div>
					))
				)}
			</div>

			{/* Selection Summary */}
			{selectedAction && (
				<div className="rounded border border-blue-300 bg-blue-50 px-3 py-2 text-sm">
					<strong>Selected:</strong> {selectedAction.toolDisplayName} from{" "}
					{selectedAction.serverName}
				</div>
			)}
		</div>
	);
};
