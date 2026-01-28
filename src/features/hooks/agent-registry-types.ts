/**
 * Agent Registry Type Definitions
 *
 * Defines all TypeScript interfaces, types, and enums for the Agent Registry feature.
 * This file contains types for agent discovery, registration, and retrieval from both
 * local .agent.md files and VS Code extensions.
 *
 * @see specs/011-custom-agent-hooks/data-model.md
 * @see specs/011-custom-agent-hooks/contracts/agent-registry-api.ts
 */

// ============================================================================
// Enumerations
// ============================================================================

/**
 * AgentTypeEnum - Classification of agent execution model
 */
export type AgentTypeEnum = "local" | "background";

/**
 * AgentSourceEnum - Where the agent was discovered from
 */
export type AgentSourceEnum = "file" | "extension";

/**
 * AgentErrorCode - Error codes for agent discovery and validation
 */
export type AgentErrorCode =
	| "PARSE_ERROR" // Failed to parse .agent.md file
	| "INVALID_SCHEMA" // Schema validation failed
	| "DUPLICATE_ID" // Agent ID already exists
	| "FILE_NOT_FOUND" // Agent file missing
	| "EXTENSION_ERROR"; // Extension registration failed

/**
 * AgentUnavailableReason - Why an agent cannot be invoked
 */
export type AgentUnavailableReason =
	| "FILE_DELETED" // .agent.md file no longer exists
	| "EXTENSION_UNINSTALLED" // Extension was removed
	| "CLI_NOT_INSTALLED" // Background CLI tool not found in PATH
	| "INVALID_SCHEMA" // Agent schema became invalid
	| "UNKNOWN"; // Other error

// ============================================================================
// Core Entities
// ============================================================================

/**
 * AgentRegistryEntry - Represents a single agent available for hook selection
 *
 * Discovered from either:
 * - Local .agent.md files in .github/agents/
 * - VS Code extensions with chatParticipants contributions
 */
export interface AgentRegistryEntry {
	// Identity (unique composite key)
	id: string; // Format: "{source}:{name}" (e.g., "local:code-reviewer", "extension:copilot")

	// Display Information
	name: string; // Base agent name (e.g., "Code Reviewer")
	displayName: string; // Name with source indicator if duplicate (e.g., "Code Reviewer (Local)")
	description?: string; // Short description of agent purpose

	// Classification
	type: AgentTypeEnum; // "local" | "background"
	source: AgentSourceEnum; // "file" | "extension"

	// Source-Specific Data
	sourcePath?: string; // Absolute file path (for source="file")
	extensionId?: string; // VS Code extension identifier (for source="extension")

	// Agent Configuration Schema (from .agent.md frontmatter)
	schema?: AgentConfigSchema;

	// Metadata
	discoveredAt: number; // Unix timestamp (milliseconds)
	lastValidated?: number; // Unix timestamp (milliseconds)
	available: boolean; // Runtime availability status
}

/**
 * AgentConfigSchema - Parsed schema from .agent.md file's YAML frontmatter
 */
export interface AgentConfigSchema {
	// From YAML frontmatter
	id: string; // Agent identifier (lowercase-with-hyphens)
	name: string; // Short name
	fullName: string; // Full display name
	description: string; // Purpose and capabilities
	icon?: string; // Icon identifier (optional)

	// Commands supported by agent
	commands: AgentCommand[];

	// Resources available to agent
	resources: AgentResources;

	// Raw markdown content (below frontmatter)
	content: string;
}

/**
 * AgentCommand - Command supported by an agent
 */
export interface AgentCommand {
	name: string; // Command name (e.g., "review", "help")
	description: string; // What the command does
	tool: string; // Tool identifier (e.g., "agent.review")
	parameters?: Record<string, unknown>[]; // Optional parameter definitions
}

/**
 * AgentResources - Resources available to an agent
 */
export interface AgentResources {
	prompts?: string[]; // Available prompt templates
	skills?: string[]; // Available skill modules
	instructions?: string[]; // Additional instruction files
}

// ============================================================================
// Discovery Results
// ============================================================================

/**
 * AgentDiscoveryResult - Result of agent discovery from a single source
 */
export interface AgentDiscoveryResult {
	source: AgentSourceEnum; // Where agents were discovered
	agents: AgentRegistryEntry[]; // Discovered agents
	errors: AgentDiscoveryError[]; // Any errors encountered
	discoveredAt: number; // Unix timestamp (milliseconds)
}

/**
 * AgentDiscoveryError - Error encountered during discovery
 */
export interface AgentDiscoveryError {
	filePath?: string; // File that caused error (if applicable)
	extensionId?: string; // Extension that caused error (if applicable)
	code: AgentErrorCode; // Error type
	message: string; // Human-readable error message
}

// ============================================================================
// Availability Checking
// ============================================================================

/**
 * AgentAvailabilityCheck - Result of agent availability validation
 */
export interface AgentAvailabilityCheck {
	agentId: string; // Reference to AgentRegistryEntry.id
	available: boolean; // Can agent be invoked?
	reason?: AgentUnavailableReason; // Why unavailable (if applicable)
	checkedAt: number; // Unix timestamp (milliseconds)
}

// ============================================================================
// Grouped Agents for UI
// ============================================================================

/**
 * GroupedAgents - Agents grouped by type for UI rendering
 */
export interface GroupedAgents {
	local: AgentRegistryEntry[]; // Local agents from .agent.md files
	background: AgentRegistryEntry[]; // Background CLI/extension agents
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if value is a valid AgentTypeEnum
 */
export function isAgentType(value: unknown): value is AgentTypeEnum {
	return value === "local" || value === "background";
}

/**
 * Check if value is a valid AgentSourceEnum
 */
export function isAgentSource(value: unknown): value is AgentSourceEnum {
	return value === "file" || value === "extension";
}

/**
 * Validate AgentRegistryEntry structure
 */
export function isValidAgentRegistryEntry(
	obj: unknown
): obj is AgentRegistryEntry {
	if (typeof obj !== "object" || obj === null) {
		return false;
	}
	const entry = obj as AgentRegistryEntry;

	return (
		typeof entry.id === "string" &&
		entry.id.length > 0 &&
		typeof entry.name === "string" &&
		entry.name.length > 0 &&
		typeof entry.displayName === "string" &&
		entry.displayName.length > 0 &&
		isAgentType(entry.type) &&
		isAgentSource(entry.source) &&
		typeof entry.discoveredAt === "number" &&
		entry.discoveredAt > 0 &&
		typeof entry.available === "boolean"
	);
}

/**
 * Validate AgentDiscoveryResult structure
 */
export function isValidAgentDiscoveryResult(
	obj: unknown
): obj is AgentDiscoveryResult {
	if (typeof obj !== "object" || obj === null) {
		return false;
	}
	const result = obj as AgentDiscoveryResult;

	return (
		isAgentSource(result.source) &&
		Array.isArray(result.agents) &&
		Array.isArray(result.errors) &&
		typeof result.discoveredAt === "number" &&
		result.discoveredAt > 0
	);
}

/**
 * Validate AgentAvailabilityCheck structure
 */
export function isValidAgentAvailabilityCheck(
	obj: unknown
): obj is AgentAvailabilityCheck {
	if (typeof obj !== "object" || obj === null) {
		return false;
	}
	const check = obj as AgentAvailabilityCheck;

	return (
		typeof check.agentId === "string" &&
		check.agentId.length > 0 &&
		typeof check.available === "boolean" &&
		typeof check.checkedAt === "number" &&
		check.checkedAt > 0
	);
}
