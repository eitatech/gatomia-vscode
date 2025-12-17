import { vscode } from "@/bridge/vscode";
import { useCallback, useEffect, useState } from "react";

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
 * Message sent from webview to extension to request MCP server discovery
 */
export interface MCPDiscoveryRequest {
	type: "hooks/mcp-discover";
	payload?: {
		forceRefresh?: boolean;
	};
}

/**
 * Message sent from extension to webview with MCP server data
 */
export interface MCPDiscoveryResponse {
	type: "hooks/mcp-servers" | "hooks.mcp-servers";
	payload: {
		servers: MCPServer[];
	};
}

/**
 * Message sent from extension to webview when discovery fails
 */
export interface MCPDiscoveryError {
	type: "hooks/mcp-error" | "hooks.mcp-error";
	payload: {
		message: string;
	};
}

/**
 * State returned by the useMCPServers hook
 */
export interface UseMCPServersState {
	servers: MCPServer[];
	loading: boolean;
	error: string | undefined;
	discover: (forceRefresh?: boolean) => void;
	clearError: () => void;
}

/**
 * Custom hook for managing MCP server discovery state
 *
 * Handles:
 * - Automatic discovery on mount
 * - Manual discovery with optional cache refresh
 * - Loading, error, and data state management
 * - Message handling from extension
 *
 * @returns State and methods for MCP server discovery
 *
 * @example
 * ```tsx
 * const { servers, loading, error, discover } = useMCPServers();
 *
 * // Force refresh from Copilot
 * discover(true);
 * ```
 */
export const useMCPServers = (): UseMCPServersState => {
	// State management
	const [servers, setServers] = useState<MCPServer[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | undefined>();

	/**
	 * Request MCP server discovery from extension
	 */
	const discover = useCallback((forceRefresh = false) => {
		setLoading(true);
		setError(undefined);

		const message: MCPDiscoveryRequest = {
			type: "hooks/mcp-discover",
			payload: { forceRefresh },
		};

		vscode.postMessage({
			...message,
			command: message.type.replace(/\//g, "."),
		});
	}, []);

	/**
	 * Clear error state
	 */
	const clearError = useCallback(() => {
		setError(undefined);
	}, []);

	/**
	 * Handle incoming messages from extension
	 */
	useEffect(() => {
		const isServersMessage = (type: string | undefined) =>
			type === "hooks/mcp-servers" || type === "hooks.mcp-servers";
		const isErrorMessage = (type: string | undefined) =>
			type === "hooks/mcp-error" || type === "hooks.mcp-error";
		const extractBody = (payload: Record<string, unknown>) =>
			(payload as Record<string, unknown>).payload ??
			(payload as Record<string, unknown>).data;

		const handleServersMessage = (body: Record<string, unknown>) => {
			const discoveredServers = Array.isArray((body as any).servers)
				? ((body as any).servers as unknown[])
				: [];
			setServers(discoveredServers);
			setLoading(false);
			setError(undefined);
		};

		const handleErrorMessage = (body: Record<string, unknown>) => {
			const message = (body as MCPDiscoveryError["payload"])?.message;
			if (!message) {
				return;
			}
			setError(message);
			setLoading(false);
		};

		const handleMessage = (
			event: MessageEvent<
				MCPDiscoveryResponse | MCPDiscoveryError | Record<string, unknown>
			>
		) => {
			const payload = event.data;
			if (!payload || typeof payload !== "object") {
				return;
			}

			const messageType = (payload as any).type ?? (payload as any).command;
			const body = extractBody(payload as Record<string, unknown>);

			if (isServersMessage(messageType) && body) {
				handleServersMessage(body as Record<string, unknown>);
				return;
			}

			if (isErrorMessage(messageType) && body) {
				handleErrorMessage(body as Record<string, unknown>);
			}
		};

		window.addEventListener("message", handleMessage);

		return () => {
			window.removeEventListener("message", handleMessage);
		};
	}, []);

	/**
	 * Auto-discover on mount
	 */
	useEffect(() => {
		discover();
	}, [discover]);

	return {
		servers,
		loading,
		error,
		discover,
		clearError,
	};
};
