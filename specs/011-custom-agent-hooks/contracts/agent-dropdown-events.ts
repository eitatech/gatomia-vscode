/**
 * Agent Dropdown Events Contract
 * 
 * Defines message protocol for communication between VS Code webview
 * and extension host for the agent dropdown component.
 * 
 * Architecture:
 * - Webview (React UI) ↔ Extension Host (Node.js)
 * - Communication via postMessage API
 * - Bidirectional: webview requests data, extension sends updates
 */

import type {
	AgentRegistryEntry,
	GroupedAgents,
} from "../../../src/features/hooks/agent-registry-types";

// ============================================================================
// Message Base Types
// ============================================================================

/**
 * Base interface for all messages between webview and extension
 */
export interface BaseMessage {
	type: string; // Message type identifier
	requestId?: string; // Optional correlation ID for request/response
	timestamp: number; // Unix timestamp (milliseconds)
}

/**
 * Request message from webview to extension
 */
export interface RequestMessage extends BaseMessage {
	type: string;
	requestId: string; // Required for requests
}

/**
 * Response message from extension to webview
 */
export interface ResponseMessage extends BaseMessage {
	type: string;
	requestId: string; // Correlates with request
	success: boolean;
	error?: ErrorPayload;
}

/**
 * Event message from extension to webview (no request/response)
 */
export interface EventMessage extends BaseMessage {
	type: string;
	// No requestId for events
}

// ============================================================================
// Webview → Extension (Requests)
// ============================================================================

/**
 * Request all available agents for dropdown population
 */
export interface GetAgentsRequest extends RequestMessage {
	type: "get-agents";
	payload: {
		filter?: {
			type?: "local" | "background"; // Filter by agent type
			searchTerm?: string; // Filter by name/description
		};
		grouped?: boolean; // If true, return grouped by type
	};
}

/**
 * Request agent availability check before hook execution
 */
export interface CheckAgentAvailabilityRequest extends RequestMessage {
	type: "check-agent-availability";
	payload: {
		agentId: string; // Agent to check
	};
}

/**
 * Request agent details (full schema) for display
 */
export interface GetAgentDetailsRequest extends RequestMessage {
	type: "get-agent-details";
	payload: {
		agentId: string; // Agent to retrieve
	};
}

/**
 * Request manual refresh of agent registry
 */
export interface RefreshAgentsRequest extends RequestMessage {
	type: "refresh-agents";
	payload?: {
		source?: "file" | "extension"; // Optional: refresh specific source
	};
}

/**
 * Notify extension that user selected an agent in dropdown
 */
export interface AgentSelectedNotification extends BaseMessage {
	type: "agent-selected";
	payload: {
		agentId: string; // Selected agent ID
		agentName: string; // Selected agent name
		agentType: "local" | "background"; // Selected agent type
	};
}

/**
 * Union type for all webview requests
 */
export type WebviewRequest =
	| GetAgentsRequest
	| CheckAgentAvailabilityRequest
	| GetAgentDetailsRequest
	| RefreshAgentsRequest
	| AgentSelectedNotification;

// ============================================================================
// Extension → Webview (Responses)
// ============================================================================

/**
 * Response to GetAgentsRequest
 */
export interface GetAgentsResponse extends ResponseMessage {
	type: "get-agents-response";
	payload?: {
		agents: AgentRegistryEntry[]; // Flat list
		grouped?: GroupedAgents; // Grouped by type (if requested)
		total: number; // Total count
	};
}

/**
 * Response to CheckAgentAvailabilityRequest
 */
export interface CheckAgentAvailabilityResponse extends ResponseMessage {
	type: "check-agent-availability-response";
	payload?: {
		agentId: string;
		available: boolean;
		reason?: string; // Why unavailable (if applicable)
	};
}

/**
 * Response to GetAgentDetailsRequest
 */
export interface GetAgentDetailsResponse extends ResponseMessage {
	type: "get-agent-details-response";
	payload?: {
		agent: AgentRegistryEntry; // Full agent details
	};
}

/**
 * Response to RefreshAgentsRequest
 */
export interface RefreshAgentsResponse extends ResponseMessage {
	type: "refresh-agents-response";
	payload?: {
		addedCount: number; // New agents discovered
		removedCount: number; // Agents removed
		updatedCount: number; // Agents updated
	};
}

/**
 * Union type for all extension responses
 */
export type ExtensionResponse =
	| GetAgentsResponse
	| CheckAgentAvailabilityResponse
	| GetAgentDetailsResponse
	| RefreshAgentsResponse;

// ============================================================================
// Extension → Webview (Events - Proactive Updates)
// ============================================================================

/**
 * Event: Agent registry changed (new agents, removals, updates)
 */
export interface AgentsChangedEvent extends EventMessage {
	type: "agents-changed";
	payload: {
		changeType: "added" | "removed" | "updated";
		agentIds: string[]; // Affected agent IDs
		agents?: AgentRegistryEntry[]; // New/updated agents (if applicable)
	};
}

/**
 * Event: Agent availability changed
 */
export interface AgentAvailabilityChangedEvent extends EventMessage {
	type: "agent-availability-changed";
	payload: {
		agentId: string;
		available: boolean;
		reason?: string; // Why unavailable (if applicable)
	};
}

/**
 * Event: Registry refresh started
 */
export interface RefreshStartedEvent extends EventMessage {
	type: "refresh-started";
	payload: {
		source?: "file" | "extension"; // Source being refreshed
	};
}

/**
 * Event: Registry refresh completed
 */
export interface RefreshCompletedEvent extends EventMessage {
	type: "refresh-completed";
	payload: {
		success: boolean;
		addedCount: number;
		removedCount: number;
		updatedCount: number;
		errors?: string[]; // Any errors during refresh
	};
}

/**
 * Union type for all extension events
 */
export type ExtensionEvent =
	| AgentsChangedEvent
	| AgentAvailabilityChangedEvent
	| RefreshStartedEvent
	| RefreshCompletedEvent;

// ============================================================================
// Supporting Types
// ============================================================================

/**
 * Error payload for failed requests
 */
export interface ErrorPayload {
	code: string; // Error code (e.g., "AGENT_NOT_FOUND")
	message: string; // Human-readable error message
	details?: unknown; // Additional error context
}

/**
 * Message envelope for type-safe postMessage
 */
export type Message = WebviewRequest | ExtensionResponse | ExtensionEvent;

// ============================================================================
// Message Type Guards
// ============================================================================

/**
 * Type guard for request messages
 */
export function isRequestMessage(message: Message): message is WebviewRequest {
	return "requestId" in message && message.requestId !== undefined;
}

/**
 * Type guard for response messages
 */
export function isResponseMessage(
	message: Message
): message is ExtensionResponse {
	return (
		"requestId" in message &&
		message.requestId !== undefined &&
		"success" in message
	);
}

/**
 * Type guard for event messages
 */
export function isEventMessage(message: Message): message is ExtensionEvent {
	return !("requestId" in message);
}

/**
 * Type guard for GetAgentsRequest
 */
export function isGetAgentsRequest(
	message: Message
): message is GetAgentsRequest {
	return message.type === "get-agents";
}

/**
 * Type guard for CheckAgentAvailabilityRequest
 */
export function isCheckAgentAvailabilityRequest(
	message: Message
): message is CheckAgentAvailabilityRequest {
	return message.type === "check-agent-availability";
}

/**
 * Type guard for AgentsChangedEvent
 */
export function isAgentsChangedEvent(
	message: Message
): message is AgentsChangedEvent {
	return message.type === "agents-changed";
}

// ============================================================================
// Message Factory Functions
// ============================================================================

/**
 * Create a GetAgentsRequest message
 */
export function createGetAgentsRequest(
	filter?: GetAgentsRequest["payload"]["filter"],
	grouped?: boolean
): GetAgentsRequest {
	return {
		type: "get-agents",
		requestId: generateRequestId(),
		timestamp: Date.now(),
		payload: {
			filter,
			grouped,
		},
	};
}

/**
 * Create a CheckAgentAvailabilityRequest message
 */
export function createCheckAgentAvailabilityRequest(
	agentId: string
): CheckAgentAvailabilityRequest {
	return {
		type: "check-agent-availability",
		requestId: generateRequestId(),
		timestamp: Date.now(),
		payload: {
			agentId,
		},
	};
}

/**
 * Create a RefreshAgentsRequest message
 */
export function createRefreshAgentsRequest(
	source?: "file" | "extension"
): RefreshAgentsRequest {
	return {
		type: "refresh-agents",
		requestId: generateRequestId(),
		timestamp: Date.now(),
		payload: source ? { source } : undefined,
	};
}

/**
 * Create an AgentSelectedNotification message
 */
export function createAgentSelectedNotification(
	agentId: string,
	agentName: string,
	agentType: "local" | "background"
): AgentSelectedNotification {
	return {
		type: "agent-selected",
		timestamp: Date.now(),
		payload: {
			agentId,
			agentName,
			agentType,
		},
	};
}

/**
 * Create a GetAgentsResponse message
 */
export function createGetAgentsResponse(
	requestId: string,
	agents: AgentRegistryEntry[],
	grouped?: GroupedAgents
): GetAgentsResponse {
	return {
		type: "get-agents-response",
		requestId,
		timestamp: Date.now(),
		success: true,
		payload: {
			agents,
			grouped,
			total: agents.length,
		},
	};
}

/**
 * Create an error response message
 */
export function createErrorResponse<T extends ResponseMessage>(
	type: T["type"],
	requestId: string,
	error: ErrorPayload
): T {
	return {
		type,
		requestId,
		timestamp: Date.now(),
		success: false,
		error,
	} as T;
}

/**
 * Create an AgentsChangedEvent message
 */
export function createAgentsChangedEvent(
	changeType: "added" | "removed" | "updated",
	agentIds: string[],
	agents?: AgentRegistryEntry[]
): AgentsChangedEvent {
	return {
		type: "agents-changed",
		timestamp: Date.now(),
		payload: {
			changeType,
			agentIds,
			agents,
		},
	};
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Generate unique request ID for correlation
 */
function generateRequestId(): string {
	return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Validate message structure
 */
export function isValidMessage(obj: unknown): obj is Message {
	if (typeof obj !== "object" || obj === null) {
		return false;
	}

	const message = obj as Message;

	return (
		typeof message.type === "string" &&
		typeof message.timestamp === "number" &&
		message.timestamp > 0
	);
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Message type constants for easy reference
 */
export const MESSAGE_TYPES = {
	// Requests
	GET_AGENTS: "get-agents",
	CHECK_AGENT_AVAILABILITY: "check-agent-availability",
	GET_AGENT_DETAILS: "get-agent-details",
	REFRESH_AGENTS: "refresh-agents",
	AGENT_SELECTED: "agent-selected",

	// Responses
	GET_AGENTS_RESPONSE: "get-agents-response",
	CHECK_AGENT_AVAILABILITY_RESPONSE: "check-agent-availability-response",
	GET_AGENT_DETAILS_RESPONSE: "get-agent-details-response",
	REFRESH_AGENTS_RESPONSE: "refresh-agents-response",

	// Events
	AGENTS_CHANGED: "agents-changed",
	AGENT_AVAILABILITY_CHANGED: "agent-availability-changed",
	REFRESH_STARTED: "refresh-started",
	REFRESH_COMPLETED: "refresh-completed",
} as const;

/**
 * Message timeout constants
 */
export const MESSAGE_TIMEOUTS = {
	GET_AGENTS: 5000, // 5 seconds
	CHECK_AVAILABILITY: 3000, // 3 seconds
	GET_DETAILS: 2000, // 2 seconds
	REFRESH: 10000, // 10 seconds
} as const;
