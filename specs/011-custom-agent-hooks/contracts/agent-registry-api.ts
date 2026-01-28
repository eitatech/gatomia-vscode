/**
 * Agent Registry API Contract
 * 
 * Defines interfaces for agent discovery, registration, and retrieval
 * from both local files and VS Code extensions.
 */

import type {
	AgentRegistryEntry,
	AgentDiscoveryResult,
	AgentAvailabilityCheck,
	AgentSourceEnum,
	AgentTypeEnum,
} from "../../../src/features/hooks/agent-registry-types";

// ============================================================================
// Core Registry Interface
// ============================================================================

/**
 * AgentRegistry - Central service for managing agent discovery and retrieval
 * 
 * Responsibilities:
 * - Discover agents from all sources (files, extensions)
 * - Maintain unified agent registry in memory
 * - Provide query interface for UI components
 * - Handle duplicate name resolution
 * - Monitor agent availability changes
 */
export interface IAgentRegistry {
	/**
	 * Initialize the registry by discovering all available agents
	 * @returns Promise resolving to initial discovery result
	 */
	initialize(): Promise<AgentDiscoveryResult[]>;

	/**
	 * Get all registered agents
	 * @param filter Optional filter criteria
	 * @returns Array of agent registry entries
	 */
	getAllAgents(filter?: AgentFilter): AgentRegistryEntry[];

	/**
	 * Get a single agent by ID
	 * @param agentId Unique agent identifier (format: "source:name")
	 * @returns Agent entry or undefined if not found
	 */
	getAgentById(agentId: string): AgentRegistryEntry | undefined;

	/**
	 * Get agents grouped by type (local vs background)
	 * @returns Grouped agents for UI dropdown rendering
	 */
	getAgentsGroupedByType(): GroupedAgents;

	/**
	 * Check if an agent is currently available for invocation
	 * @param agentId Unique agent identifier
	 * @returns Availability check result with reason if unavailable
	 */
	checkAgentAvailability(agentId: string): Promise<AgentAvailabilityCheck>;

	/**
	 * Force refresh of agent registry from all sources
	 * @returns Promise resolving to new discovery results
	 */
	refresh(): Promise<AgentDiscoveryResult[]>;

	/**
	 * Register callback for registry changes (new agents, removals, updates)
	 * @param callback Function to call when registry changes
	 * @returns Disposable to unregister callback
	 */
	onDidChangeRegistry(
		callback: (event: RegistryChangeEvent) => void
	): { dispose: () => void };
}

// ============================================================================
// Discovery Interfaces
// ============================================================================

/**
 * IAgentDiscoveryService - Unified agent discovery from all sources
 * 
 * Orchestrates discovery from:
 * - Local .agent.md files via FileAgentDiscovery
 * - VS Code extensions via ExtensionAgentDiscovery
 */
export interface IAgentDiscoveryService {
	/**
	 * Discover agents from all configured sources
	 * @returns Promise resolving to array of discovery results (one per source)
	 */
	discoverAll(): Promise<AgentDiscoveryResult[]>;

	/**
	 * Discover agents from a specific source
	 * @param source Source to discover from
	 * @returns Promise resolving to discovery result
	 */
	discoverFromSource(source: AgentSourceEnum): Promise<AgentDiscoveryResult>;
}

/**
 * IFileAgentDiscovery - Discovers agents from .github/agents/*.agent.md files
 * 
 * Responsibilities:
 * - Scan .github/agents/ directory recursively
 * - Parse .agent.md files using gray-matter
 * - Validate agent schema
 * - Convert to AgentRegistryEntry format
 */
export interface IFileAgentDiscovery {
	/**
	 * Discover all agents from local .agent.md files
	 * @param agentsDir Absolute path to agents directory
	 * @returns Promise resolving to discovery result
	 */
	discoverAgents(agentsDir: string): Promise<AgentDiscoveryResult>;

	/**
	 * Parse a single .agent.md file
	 * @param filePath Absolute path to agent file
	 * @returns Promise resolving to agent registry entry
	 */
	parseAgentFile(filePath: string): Promise<AgentRegistryEntry>;

	/**
	 * Validate an agent definition
	 * @param entry Agent registry entry to validate
	 * @returns Validation result with errors if any
	 */
	validateAgent(entry: AgentRegistryEntry): {
		valid: boolean;
		errors: string[];
	};
}

/**
 * IExtensionAgentDiscovery - Discovers agents from VS Code extensions
 * 
 * Responsibilities:
 * - Scan installed VS Code extensions
 * - Identify extensions that register chat participants
 * - Extract agent metadata from extension manifest
 * - Convert to AgentRegistryEntry format
 */
export interface IExtensionAgentDiscovery {
	/**
	 * Discover all agents registered by VS Code extensions
	 * @returns Promise resolving to discovery result
	 */
	discoverAgents(): Promise<AgentDiscoveryResult>;

	/**
	 * Get agent metadata from a specific extension
	 * @param extensionId VS Code extension identifier
	 * @returns Promise resolving to agent registry entry or undefined
	 */
	getAgentFromExtension(
		extensionId: string
	): Promise<AgentRegistryEntry | undefined>;

	/**
	 * Check if an extension provides chat participants
	 * @param extensionId VS Code extension identifier
	 * @returns True if extension has chatParticipants contribution
	 */
	isAgentExtension(extensionId: string): boolean;
}

// ============================================================================
// File Watching Interface
// ============================================================================

/**
 * IFileWatcherService - Monitors .github/agents/ directory for changes
 * 
 * Responsibilities:
 * - Watch for agent file creation/modification/deletion
 * - Debounce rapid changes to prevent excessive re-scanning
 * - Emit events to trigger registry refresh
 */
export interface IFileWatcherService {
	/**
	 * Start watching the agents directory
	 * @param agentsDir Absolute path to agents directory
	 */
	startWatching(agentsDir: string): void;

	/**
	 * Stop watching the agents directory
	 */
	stopWatching(): void;

	/**
	 * Register callback for file change events
	 * @param callback Function to call when files change
	 * @returns Disposable to unregister callback
	 */
	onDidChangeFiles(
		callback: (event: FileChangeEvent) => void
	): { dispose: () => void };
}

/**
 * FileChangeEvent - Event emitted when agent files change
 */
export interface FileChangeEvent {
	type: "created" | "modified" | "deleted";
	filePath: string; // Absolute path
	affectedAgentIds: string[]; // Agent IDs that need refresh
	timestamp: number; // Unix timestamp (milliseconds)
}

// ============================================================================
// Extension Monitoring Interface
// ============================================================================

/**
 * IExtensionMonitorService - Monitors VS Code extension changes
 * 
 * Responsibilities:
 * - Listen for extension install/uninstall events
 * - Listen for extension enable/disable events
 * - Emit events to trigger registry refresh
 */
export interface IExtensionMonitorService {
	/**
	 * Start monitoring extension changes
	 */
	startMonitoring(): void;

	/**
	 * Stop monitoring extension changes
	 */
	stopMonitoring(): void;

	/**
	 * Register callback for extension change events
	 * @param callback Function to call when extensions change
	 * @returns Disposable to unregister callback
	 */
	onDidChangeExtensions(
		callback: (event: ExtensionChangeEvent) => void
	): { dispose: () => void };
}

/**
 * ExtensionChangeEvent - Event emitted when extensions change
 */
export interface ExtensionChangeEvent {
	type: "installed" | "uninstalled" | "enabled" | "disabled";
	extensionId: string; // VS Code extension identifier
	affectedAgentIds: string[]; // Agent IDs that need refresh
	timestamp: number; // Unix timestamp (milliseconds)
}

// ============================================================================
// Supporting Types
// ============================================================================

/**
 * AgentFilter - Criteria for filtering agent registry queries
 */
export interface AgentFilter {
	type?: AgentTypeEnum; // Filter by agent type
	source?: AgentSourceEnum; // Filter by discovery source
	available?: boolean; // Filter by availability status
	searchTerm?: string; // Filter by name/description text match
}

/**
 * GroupedAgents - Agents grouped by type for UI rendering
 */
export interface GroupedAgents {
	local: AgentRegistryEntry[]; // Local agents from .agent.md files
	background: AgentRegistryEntry[]; // Background CLI/extension agents
}

/**
 * RegistryChangeEvent - Event emitted when registry changes
 */
export interface RegistryChangeEvent {
	type: RegistryChangeType;
	agentIds: string[]; // Affected agent IDs
	timestamp: number; // Unix timestamp (milliseconds)
}

/**
 * RegistryChangeType - Type of registry change
 */
export type RegistryChangeType =
	| "agents-added" // New agents discovered
	| "agents-removed" // Agents removed (file deleted, extension uninstalled)
	| "agents-updated" // Agent metadata or availability changed
	| "registry-cleared"; // Entire registry cleared and reloaded

// ============================================================================
// Error Types
// ============================================================================

/**
 * AgentRegistryError - Base error for agent registry operations
 */
export class AgentRegistryError extends Error {
	constructor(
		message: string,
		public readonly code: AgentRegistryErrorCode,
		public readonly details?: unknown
	) {
		super(message);
		this.name = "AgentRegistryError";
	}
}

/**
 * AgentRegistryErrorCode - Error codes for agent registry operations
 */
export type AgentRegistryErrorCode =
	| "DISCOVERY_FAILED" // Failed to discover agents from source
	| "PARSE_ERROR" // Failed to parse agent file
	| "VALIDATION_ERROR" // Agent schema validation failed
	| "FILE_NOT_FOUND" // Agent file doesn't exist
	| "EXTENSION_NOT_FOUND" // Extension doesn't exist
	| "DUPLICATE_ID" // Agent ID already registered
	| "AGENT_UNAVAILABLE" // Agent cannot be invoked
	| "REGISTRY_NOT_INITIALIZED" // Registry not initialized yet
	| "UNKNOWN_ERROR"; // Unexpected error

// ============================================================================
// Constants
// ============================================================================

/**
 * Registry configuration constants
 */
export const REGISTRY_CONSTANTS = {
	// Discovery
	DISCOVERY_TIMEOUT_MS: 5000, // 5 seconds
	MAX_AGENTS_PER_SOURCE: 100,
	MAX_TOTAL_AGENTS: 200,

	// File watching
	FILE_WATCH_DEBOUNCE_MS: 500, // 0.5 seconds
	FILE_WATCH_GLOB_PATTERN: "**/*.agent.md",

	// Extension scanning
	EXTENSION_SCAN_INTERVAL_MS: 10000, // 10 seconds

	// Storage
	STORAGE_KEY: "gatomia.agents.registry",
	STORAGE_VERSION: 1,
} as const;
