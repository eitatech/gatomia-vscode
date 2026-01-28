/**
 * Hooks Module Type Definitions
 *
 * This file contains all TypeScript interfaces, types, type guards,
 * and constants for the Hooks Module feature.
 */

// ============================================================================
// Core Entities
// ============================================================================

/**
 * Hook - Represents a configured automation rule that triggers actions
 * based on agent operation events.
 */
export interface Hook {
	// Identity
	id: string; // UUID v4 format
	name: string; // User-friendly name (max 100 chars)

	// Configuration
	enabled: boolean; // Active state (default: true)
	trigger: TriggerCondition; // When to execute
	action: ActionConfig; // What to execute

	// Metadata
	createdAt: number; // Unix timestamp (milliseconds)
	modifiedAt: number; // Unix timestamp (milliseconds)
	lastExecutedAt?: number; // Unix timestamp (milliseconds)
	executionCount: number; // Total executions (default: 0)
}

/**
 * TriggerCondition - Defines the event that activates a hook
 */
export interface TriggerCondition {
	agent: AgentType; // Which agent system
	operation: OperationType; // Which operation
	timing: TriggerTiming; // When to trigger
	waitForCompletion?: boolean; // Only for "before" timing: block operation until hook completes
}

/**
 * AgentType - Supported SDD agent systems
 */
export type AgentType = "speckit" | "openspec";

/**
 * OperationType - Supported agent operations
 */
export type OperationType =
	| "research" // Initial research completed
	| "datamodel" // Data model defined
	| "design" // Design plan completed
	| "specify" // Specification created
	| "clarify" // Clarification completed
	| "plan" // Plan generated
	| "tasks" // Tasks generated/updated
	| "taskstoissues" // Tasks converted to issues
	| "analyze" // Analysis completed
	| "checklist" // Checklist validated
	| "constitution" // Constitution updated
	| "implementation" // Implementation guidance completed
	| "unit-test" // Unit test generation completed
	| "integration-test"; // Integration test generation completed

export const SUPPORTED_SPECKIT_OPERATIONS: OperationType[] = [
	"research",
	"datamodel",
	"design",
	"specify",
	"clarify",
	"plan",
	"tasks",
	"taskstoissues",
	"analyze",
	"checklist",
	"constitution",
	"implementation",
	"unit-test",
	"integration-test",
];

/**
 * TriggerTiming - When the trigger should fire
 */
export type TriggerTiming = "before" | "after";

/**
 * ActionConfig - Defines the operation to execute when triggered
 */
export interface ActionConfig {
	type: ActionType;
	parameters: ActionParameters;
}

/**
 * ActionType - Types of actions that can be executed
 */
export type ActionType =
	| "agent" // Execute SpecKit/OpenSpec command
	| "git" // Git commit/push operation
	| "github" // GitHub via MCP Server
	| "mcp" // MCP server tool execution
	| "custom"; // Custom agent invocation

/**
 * ActionParameters - Union type for all action parameter types
 */
export type ActionParameters =
	| AgentActionParams
	| GitActionParams
	| GitHubActionParams
	| MCPActionParams
	| CustomActionParams;

// ============================================================================
// Action-Specific Parameters
// ============================================================================

/**
 * AgentActionParams - Parameters for executing agent commands
 */
export interface AgentActionParams {
	command: string; // Full agent command (e.g., '/speckit.clarify')
}

/**
 * GitActionParams - Parameters for Git operations
 */
export interface GitActionParams {
	operation: GitOperation;
	messageTemplate: string; // Supports template variables
	pushToRemote?: boolean; // Auto-push after commit (default: false)
}

/**
 * GitOperation - Git operations
 */
export type GitOperation = "commit" | "push";

/**
 * GitHubActionParams - Parameters for GitHub operations via MCP Server
 */
export interface GitHubActionParams {
	operation: GitHubOperation;
	repository?: string; // Format: 'owner/repo' (optional, defaults to current)
	titleTemplate?: string; // For issue/PR creation
	bodyTemplate?: string; // For issue/PR creation
	issueNumber?: number; // For close/update operations
}

/**
 * GitHubOperation - GitHub operations
 */
export type GitHubOperation =
	| "open-issue"
	| "close-issue"
	| "create-pr"
	| "add-comment";

/**
 * CustomActionParams - Parameters for custom agent invocations
 */
export interface CustomActionParams {
	// NEW: Agent Registry Integration (for custom-agent-hooks refactoring)
	agentId?: string; // Agent ID from agent registry (format: "source:name")
	agentType?: "local" | "background"; // Explicit type override

	// EXISTING: Legacy GitHub Copilot agent support
	agentName: string; // Custom agent identifier (will be deprecated in favor of agentId)
	prompt?: string; // Instruction/action text for the agent
	selectedTools?: SelectedMCPTool[]; // Optional: MCP tools available to agent
	arguments?: string; // Template string with {variable} syntax for passing trigger context
}

/**
 * MCPActionParams - Parameters for MCP server tool execution
 */
export interface MCPActionParams {
	// Agent and instruction
	agentId?: string; // Optional: GitHub Copilot agent ID (e.g., 'copilot', 'workspace')
	prompt: string; // Instruction/action text for the agent to execute

	// Selected tools (multiple selection supported)
	selectedTools: SelectedMCPTool[]; // Array of selected MCP tools

	// Legacy fields (kept for backward compatibility)
	serverId?: string; // MCP server identifier (deprecated, use selectedTools)
	toolName?: string; // Tool to execute (deprecated, use selectedTools)
	parameterMappings?: ParameterMapping[]; // How to map parameters (optional)
	timeout?: number; // Optional timeout override (1000-300000ms)
}

/**
 * SelectedMCPTool - Represents a selected MCP tool for execution
 */
export interface SelectedMCPTool {
	serverId: string; // Server providing the tool
	serverName: string; // Display name of server
	toolName: string; // Tool identifier
	toolDisplayName: string; // Human-readable tool name
}

/**
 * ParameterMapping - Maps hook context to MCP tool parameters
 */
export interface ParameterMapping {
	toolParam: string; // Parameter name in tool's input schema
	source: "context" | "literal" | "template"; // Where to get the value
	value: string; // Template string or literal value
}

/**
 * ServerStatus - Status of an MCP server
 */
export type ServerStatus = "available" | "unavailable" | "unknown";

/**
 * MCPServer - Represents an MCP server configured in Copilot
 */
export interface MCPServer {
	id: string; // Server identifier
	name: string; // Display name
	description?: string; // Optional description
	status: ServerStatus; // Current availability
	tools: MCPTool[]; // Available tools/actions
	lastDiscovered: number; // Unix timestamp (milliseconds)
}

/**
 * MCPTool - Represents a tool/action provided by an MCP server
 */
export interface MCPTool {
	name: string; // Tool identifier
	displayName: string; // Human-readable name
	description: string; // What the tool does
	inputSchema: JSONSchema; // Parameter definition
	serverId: string; // Parent server reference
}

/**
 * JSONSchema - JSON Schema definition for MCP tool parameters
 */
export interface JSONSchema {
	type: string; // Schema type (e.g., 'object')
	properties?: Record<string, JSONSchemaProperty>; // Parameter definitions
	required?: string[]; // Required parameter names
}

/**
 * JSONSchemaProperty - Individual parameter schema
 */
export interface JSONSchemaProperty {
	type: string; // Parameter type (string, number, boolean, etc.)
	description?: string; // Parameter description
	enum?: unknown[]; // Allowed values (if applicable)
	default?: unknown; // Default value (if applicable)
}

// ============================================================================
// Supporting Entities
// ============================================================================

/**
 * HookExecutionLog - Records hook execution history for debugging
 */
export interface HookExecutionLog {
	// Identity
	id: string; // UUID for this log entry
	hookId: string; // Reference to executed hook

	// Execution context
	executionId: string; // UUID for this execution chain
	chainDepth: number; // Position in hook chain (0-based)

	// Timing
	triggeredAt: number; // Unix timestamp (milliseconds)
	completedAt?: number; // Unix timestamp (milliseconds)
	duration?: number; // Milliseconds (completedAt - triggeredAt)

	// Result
	status: ExecutionStatus;
	error?: ExecutionError;

	// Context snapshot
	contextSnapshot: TemplateContext;
}

/**
 * ExecutionStatus - Status of hook execution
 */
export type ExecutionStatus =
	| "success" // Action completed successfully
	| "failure" // Action failed with error
	| "skipped" // Hook was disabled or filtered
	| "timeout"; // Action exceeded timeout

/**
 * ExecutionError - Error information from failed execution
 */
export interface ExecutionError {
	code: string; // Error code (e.g., 'GIT_COMMIT_FAILED')
	message: string; // Human-readable error message
	stack?: string; // Stack trace (for debugging)
}

/**
 * ExecutionContext - Tracks hook execution chains to prevent circular dependencies
 */
export interface ExecutionContext {
	executionId: string; // UUID for entire execution chain
	chainDepth: number; // Current depth (0 = root trigger)
	executedHooks: Set<string>; // Hook IDs already executed in this chain
	startedAt: number; // Unix timestamp when chain started
}

/**
 * TemplateContext - Provides dynamic values for template variable expansion
 */
export interface TemplateContext {
	feature?: string; // Current feature name (e.g., 'hooks-module')
	branch?: string; // Current git branch (e.g., '001-hooks-module')
	timestamp?: string; // ISO 8601 format
	user?: string; // Git user name from config
	// Output capture variables
	agentOutput?: string; // Output content from triggering agent
	clipboardContent?: string; // Current clipboard content
	outputPath?: string; // Path to output file
}

/**
 * TriggerEvent - Event emitted when a trigger fires
 */
export interface TriggerEvent {
	agent: string; // 'speckit' | 'openspec'
	operation: string; // Operation name
	timestamp: number; // Unix timestamp (milliseconds)
	timing?: TriggerTiming; // When the trigger fired (before/after)
	metadata?: Record<string, unknown>; // Optional context data
	// Output capture fields
	outputPath?: string; // Path to generated file (for file operations)
	outputContent?: string; // File content or captured output
}

// ============================================================================
// Constants
// ============================================================================

// Limits
export const MAX_HOOK_NAME_LENGTH = 100;
export const MAX_COMMAND_LENGTH = 200;
export const MAX_MESSAGE_TEMPLATE_LENGTH = 500;
export const MAX_TITLE_TEMPLATE_LENGTH = 200;
export const MAX_BODY_TEMPLATE_LENGTH = 5000;
export const MAX_AGENT_NAME_LENGTH = 50;
export const MAX_ARGUMENTS_LENGTH = 1000;

// Execution
export const MAX_CHAIN_DEPTH = 10;
export const MAX_EXECUTION_LOGS = 100;
export const ACTION_TIMEOUT_MS = 30_000; // 30 seconds

// Storage
export const HOOKS_STORAGE_KEY = "gatomia.hooks.configurations";
export const LOGS_STORAGE_KEY = "gatomia.hooks.execution-logs";

// Trigger History
export const MAX_TRIGGER_HISTORY = 50;

// MCP-specific limits
export const MCP_DISCOVERY_CACHE_TTL = 300_000; // 5 minutes
export const MCP_DEFAULT_TIMEOUT = 30_000; // 30 seconds
export const MCP_MIN_TIMEOUT = 1000; // 1 second
export const MCP_MAX_TIMEOUT = 300_000; // 5 minutes
export const MCP_MAX_CONCURRENT_ACTIONS = 5; // Concurrency pool size
export const MAX_SERVER_NAME_LENGTH = 100;
export const MAX_TOOL_NAME_LENGTH = 100;

// ============================================================================
// Type Guards
// ============================================================================

/**
 * UUID v4 regex pattern
 */
const UUID_V4_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Repository name pattern (owner/repo)
 */
const REPOSITORY_PATTERN = /^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+$/;

/**
 * Agent name pattern (alphanumeric and hyphens)
 */
const AGENT_NAME_PATTERN = /^[a-zA-Z0-9-]+$/;

/**
 * MCP tool name pattern (alphanumeric and underscores)
 */
const TOOL_NAME_PATTERN = /^[a-zA-Z0-9_]+$/;

/**
 * Check if a string is a valid UUID v4
 */
export function isValidUUID(id: string): boolean {
	return UUID_V4_PATTERN.test(id);
}

/**
 * Validate hook structure
 */
export function isValidHook(obj: unknown): obj is Hook {
	if (typeof obj !== "object" || obj === null) {
		return false;
	}
	const hook = obj as Hook;

	return (
		typeof hook.id === "string" &&
		isValidUUID(hook.id) &&
		typeof hook.name === "string" &&
		hook.name.length > 0 &&
		hook.name.length <= MAX_HOOK_NAME_LENGTH &&
		typeof hook.enabled === "boolean" &&
		isValidTrigger(hook.trigger) &&
		isValidAction(hook.action) &&
		typeof hook.createdAt === "number" &&
		typeof hook.modifiedAt === "number" &&
		typeof hook.executionCount === "number"
	);
}

/**
 * Validate trigger condition
 */
export function isValidTrigger(obj: unknown): obj is TriggerCondition {
	if (typeof obj !== "object" || obj === null) {
		return false;
	}
	const trigger = obj as TriggerCondition;

	const validAgents: AgentType[] = ["speckit", "openspec"];
	const validTimings: TriggerTiming[] = ["before", "after"];

	return (
		typeof trigger.agent === "string" &&
		validAgents.includes(trigger.agent) &&
		typeof trigger.operation === "string" &&
		SUPPORTED_SPECKIT_OPERATIONS.includes(trigger.operation) &&
		typeof trigger.timing === "string" &&
		validTimings.includes(trigger.timing) &&
		(trigger.waitForCompletion === undefined ||
			typeof trigger.waitForCompletion === "boolean")
	);
}

/**
 * Validate action config
 */
export function isValidAction(obj: unknown): obj is ActionConfig {
	if (typeof obj !== "object" || obj === null) {
		return false;
	}
	const action = obj as ActionConfig;

	if (typeof action.type !== "string") {
		return false;
	}

	switch (action.type) {
		case "agent":
			return isValidAgentParams(action.parameters);
		case "git":
			return isValidGitParams(action.parameters);
		case "github":
			return isValidGitHubParams(action.parameters);
		case "mcp":
			return isValidMCPParams(action.parameters);
		case "custom":
			return isValidCustomParams(action.parameters);
		default:
			return false;
	}
}

/**
 * Validate agent action parameters
 */
export function isValidAgentParams(obj: unknown): obj is AgentActionParams {
	if (typeof obj !== "object" || obj === null) {
		return false;
	}
	const params = obj as AgentActionParams;

	return (
		typeof params.command === "string" &&
		params.command.length > 0 &&
		params.command.length <= MAX_COMMAND_LENGTH &&
		(params.command.startsWith("/speckit.") ||
			params.command.startsWith("/openspec."))
	);
}

/**
 * Validate git action parameters
 */
export function isValidGitParams(obj: unknown): obj is GitActionParams {
	if (typeof obj !== "object" || obj === null) {
		return false;
	}
	const params = obj as GitActionParams;

	const validOperations: GitOperation[] = ["commit", "push"];

	return (
		typeof params.operation === "string" &&
		validOperations.includes(params.operation) &&
		typeof params.messageTemplate === "string" &&
		params.messageTemplate.length > 0 &&
		params.messageTemplate.length <= MAX_MESSAGE_TEMPLATE_LENGTH &&
		(params.pushToRemote === undefined ||
			typeof params.pushToRemote === "boolean")
	);
}

/**
 * Validate github operation
 */
function isValidGitHubOperation(
	operation: unknown
): operation is GitHubOperation {
	const validOperations: GitHubOperation[] = [
		"open-issue",
		"close-issue",
		"create-pr",
		"add-comment",
	];
	return (
		typeof operation === "string" &&
		validOperations.includes(operation as GitHubOperation)
	);
}

/**
 * Validate repository format
 */
function isValidRepository(repository: unknown): boolean {
	if (repository === undefined) {
		return true;
	}
	return typeof repository === "string" && REPOSITORY_PATTERN.test(repository);
}

/**
 * Validate title template for GitHub operations
 */
function isValidTitleTemplate(
	operation: GitHubOperation,
	titleTemplate: unknown
): boolean {
	const requiresTitle = operation === "open-issue" || operation === "create-pr";
	if (!requiresTitle) {
		return true;
	}
	return (
		typeof titleTemplate === "string" &&
		titleTemplate.length > 0 &&
		titleTemplate.length <= MAX_TITLE_TEMPLATE_LENGTH
	);
}

/**
 * Validate body template for GitHub operations
 */
function isValidBodyTemplate(bodyTemplate: unknown): boolean {
	if (bodyTemplate === undefined) {
		return true;
	}
	return (
		typeof bodyTemplate === "string" &&
		bodyTemplate.length <= MAX_BODY_TEMPLATE_LENGTH
	);
}

/**
 * Validate issue number for GitHub operations
 */
function isValidIssueNumber(
	operation: GitHubOperation,
	issueNumber: unknown
): boolean {
	const requiresIssueNumber =
		operation === "close-issue" || operation === "add-comment";
	if (!requiresIssueNumber) {
		return true;
	}
	return typeof issueNumber === "number" && issueNumber > 0;
}

/**
 * Validate github action parameters
 */
export function isValidGitHubParams(obj: unknown): obj is GitHubActionParams {
	if (typeof obj !== "object" || obj === null) {
		return false;
	}
	const params = obj as GitHubActionParams;

	return (
		isValidGitHubOperation(params.operation) &&
		isValidRepository(params.repository) &&
		isValidTitleTemplate(params.operation, params.titleTemplate) &&
		isValidBodyTemplate(params.bodyTemplate) &&
		isValidIssueNumber(params.operation, params.issueNumber)
	);
}

/**
 * Validate custom action parameters
 */
export function isValidCustomParams(obj: unknown): obj is CustomActionParams {
	if (typeof obj !== "object" || obj === null) {
		return false;
	}
	const params = obj as CustomActionParams;

	return (
		typeof params.agentName === "string" &&
		params.agentName.length > 0 &&
		params.agentName.length <= MAX_AGENT_NAME_LENGTH &&
		AGENT_NAME_PATTERN.test(params.agentName) &&
		(params.arguments === undefined ||
			(typeof params.arguments === "string" &&
				params.arguments.length <= MAX_ARGUMENTS_LENGTH))
	);
}

/**
 * Validate trigger event
 */
export function isValidTriggerEvent(obj: unknown): obj is TriggerEvent {
	if (typeof obj !== "object" || obj === null) {
		return false;
	}
	const event = obj as TriggerEvent;

	const validAgents: string[] = ["speckit", "openspec"];

	return (
		typeof event.agent === "string" &&
		validAgents.includes(event.agent) &&
		typeof event.operation === "string" &&
		SUPPORTED_SPECKIT_OPERATIONS.includes(event.operation as OperationType) &&
		typeof event.timestamp === "number" &&
		event.timestamp > 0
	);
}

/**
 * Validate MCP action parameters
 */
export function isValidMCPParams(obj: unknown): obj is MCPActionParams {
	if (typeof obj !== "object" || obj === null) {
		return false;
	}
	const params = obj as MCPActionParams;

	// New structure: requires prompt and selectedTools
	const hasNewStructure =
		typeof params.prompt === "string" &&
		params.prompt.length > 0 &&
		Array.isArray(params.selectedTools) &&
		params.selectedTools.length > 0 &&
		params.selectedTools.every(isValidSelectedMCPTool);

	// Legacy structure: requires serverId and toolName
	const hasLegacyStructure =
		typeof params.serverId === "string" &&
		params.serverId.length > 0 &&
		typeof params.toolName === "string" &&
		params.toolName.length > 0;

	// Accept either new or legacy structure
	const hasValidStructure = hasNewStructure || hasLegacyStructure;

	// Validate optional fields
	const hasValidOptionalFields =
		(params.agentId === undefined || typeof params.agentId === "string") &&
		(params.parameterMappings === undefined ||
			(Array.isArray(params.parameterMappings) &&
				params.parameterMappings.every(isValidParameterMapping))) &&
		(params.timeout === undefined ||
			(typeof params.timeout === "number" &&
				params.timeout >= MCP_MIN_TIMEOUT &&
				params.timeout <= MCP_MAX_TIMEOUT));

	return hasValidStructure && hasValidOptionalFields;
}

/**
 * Validate selected MCP tool
 */
export function isValidSelectedMCPTool(obj: unknown): obj is SelectedMCPTool {
	if (typeof obj !== "object" || obj === null) {
		return false;
	}
	const tool = obj as SelectedMCPTool;

	return (
		typeof tool.serverId === "string" &&
		tool.serverId.length > 0 &&
		typeof tool.serverName === "string" &&
		tool.serverName.length > 0 &&
		typeof tool.toolName === "string" &&
		tool.toolName.length > 0 &&
		typeof tool.toolDisplayName === "string" &&
		tool.toolDisplayName.length > 0
	);
}

/**
 * Validate parameter mapping
 */
export function isValidParameterMapping(obj: unknown): obj is ParameterMapping {
	if (typeof obj !== "object" || obj === null) {
		return false;
	}
	const mapping = obj as ParameterMapping;

	const validSources = ["context", "literal", "template"];

	return (
		typeof mapping.toolParam === "string" &&
		mapping.toolParam.length > 0 &&
		typeof mapping.source === "string" &&
		validSources.includes(mapping.source) &&
		typeof mapping.value === "string"
	);
}

/**
 * Validate MCP server
 */
export function isValidMCPServer(obj: unknown): obj is MCPServer {
	if (typeof obj !== "object" || obj === null) {
		return false;
	}
	const server = obj as MCPServer;

	const validStatuses: ServerStatus[] = ["available", "unavailable", "unknown"];

	return (
		typeof server.id === "string" &&
		server.id.length > 0 &&
		typeof server.name === "string" &&
		server.name.length > 0 &&
		server.name.length <= MAX_SERVER_NAME_LENGTH &&
		typeof server.status === "string" &&
		validStatuses.includes(server.status) &&
		Array.isArray(server.tools) &&
		typeof server.lastDiscovered === "number" &&
		server.lastDiscovered > 0
	);
}

/**
 * Validate MCP tool
 */
export function isValidMCPTool(obj: unknown): obj is MCPTool {
	if (typeof obj !== "object" || obj === null) {
		return false;
	}
	const tool = obj as MCPTool;

	return (
		typeof tool.name === "string" &&
		tool.name.length > 0 &&
		TOOL_NAME_PATTERN.test(tool.name) &&
		typeof tool.displayName === "string" &&
		tool.displayName.length > 0 &&
		tool.displayName.length <= MAX_TOOL_NAME_LENGTH &&
		typeof tool.description === "string" &&
		typeof tool.inputSchema === "object" &&
		tool.inputSchema !== null &&
		typeof tool.serverId === "string" &&
		tool.serverId.length > 0
	);
}
