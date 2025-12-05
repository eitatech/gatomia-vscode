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
export type TriggerTiming = "after"; // MVP: only 'after' supported

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
	| "custom"; // Custom agent invocation

/**
 * ActionParameters - Union type for all action parameter types
 */
export type ActionParameters =
	| AgentActionParams
	| GitActionParams
	| GitHubActionParams
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
	agentName: string; // Custom agent identifier
	arguments?: string; // Arguments to pass to agent
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
}

/**
 * TriggerEvent - Event emitted when a trigger fires
 */
export interface TriggerEvent {
	agent: string; // 'speckit' | 'openspec'
	operation: string; // Operation name
	timestamp: number; // Unix timestamp (milliseconds)
	metadata?: Record<string, unknown>; // Optional context data
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

	return (
		typeof trigger.agent === "string" &&
		validAgents.includes(trigger.agent) &&
		typeof trigger.operation === "string" &&
		SUPPORTED_SPECKIT_OPERATIONS.includes(trigger.operation) &&
		trigger.timing === "after"
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

	const validAgents: AgentType[] = ["speckit", "openspec"];

	return (
		typeof event.agent === "string" &&
		validAgents.includes(event.agent) &&
		typeof event.operation === "string" &&
		SUPPORTED_SPECKIT_OPERATIONS.includes(event.operation as OperationType) &&
		typeof event.timestamp === "number" &&
		event.timestamp > 0
	);
}
