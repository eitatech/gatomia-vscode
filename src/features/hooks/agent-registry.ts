/**
 * Agent Registry Service
 *
 * Central service for managing agent discovery, registration, and retrieval
 * from both local .agent.md files and VS Code extensions.
 *
 * Responsibilities:
 * - Discover agents from all sources (files, extensions)
 * - Maintain unified agent registry in memory
 * - Provide query interface for UI components
 * - Handle duplicate name resolution
 * - Monitor agent availability changes
 *
 * @see specs/011-custom-agent-hooks/contracts/agent-registry-api.ts
 */

import type {
	AgentRegistryEntry,
	AgentDiscoveryResult,
	AgentAvailabilityCheck,
	AgentSourceEnum,
} from "./agent-registry-types";
import { FileAgentDiscovery } from "./file-agent-discovery";
import { AGENTS_DIR_RELATIVE_PATH } from "./agent-registry-constants";

// ============================================================================
// Supporting Types
// ============================================================================

/**
 * AgentFilter - Criteria for filtering agent registry queries
 */
export interface AgentFilter {
	type?: "local" | "background"; // Filter by agent type
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
// Agent Registry Implementation
// ============================================================================

/**
 * AgentRegistry - Central service for agent management
 *
 * This is a skeleton implementation with empty methods.
 * Full implementation will be added in Phase 3 (User Story 1).
 */
export class AgentRegistry {
	// Internal state
	private readonly agents: Map<string, AgentRegistryEntry> = new Map();
	private readonly changeListeners: Array<
		(event: RegistryChangeEvent) => void
	> = [];
	private readonly fileDiscovery: FileAgentDiscovery;
	private readonly workspaceRoot: string;

	constructor(workspaceRoot: string) {
		this.workspaceRoot = workspaceRoot;
		this.fileDiscovery = new FileAgentDiscovery();
	}

	/**
	 * Initialize the registry by discovering all available agents
	 * @returns Promise resolving to initial discovery result
	 */
	async initialize(): Promise<AgentDiscoveryResult[]> {
		const results: AgentDiscoveryResult[] = [];

		// Discover local agents from .github/agents/
		const localResult = await this.discoverLocalAgents();
		results.push(localResult);

		// TODO: Phase 7 (T074) - Discover extension agents
		// const extensionResult = await this.discoverExtensionAgents();
		// results.push(extensionResult);

		// Populate internal registry with all discovered agents
		const allAgents: AgentRegistryEntry[] = [];
		for (const result of results) {
			allAgents.push(...result.agents);
		}

		// Resolve duplicate names and populate registry
		const disambiguatedAgents = this.resolveDuplicateNames(allAgents);
		for (const agent of disambiguatedAgents) {
			this.agents.set(agent.id, agent);
		}

		// Emit registry-changed event
		this.emitChange({
			type: "registry-cleared",
			agentIds: disambiguatedAgents.map((a) => a.id),
			timestamp: Date.now(),
		});

		return results;
	}

	/**
	 * Get all registered agents
	 * @param filter Optional filter criteria
	 * @returns Array of agent registry entries
	 */
	getAllAgents(filter?: AgentFilter): AgentRegistryEntry[] {
		let agents = Array.from(this.agents.values());

		// Apply filters if provided
		if (filter) {
			if (filter.type !== undefined) {
				agents = agents.filter((a) => a.type === filter.type);
			}
			if (filter.source !== undefined) {
				agents = agents.filter((a) => a.source === filter.source);
			}
			if (filter.available !== undefined) {
				agents = agents.filter((a) => a.available === filter.available);
			}
			if (filter.searchTerm !== undefined) {
				const searchLower = filter.searchTerm.toLowerCase();
				agents = agents.filter(
					(a) =>
						a.name.toLowerCase().includes(searchLower) ||
						a.description?.toLowerCase().includes(searchLower)
				);
			}
		}

		return agents;
	}

	/**
	 * Get a single agent by ID
	 * @param agentId Unique agent identifier (format: "source:name")
	 * @returns Agent entry or undefined if not found
	 */
	getAgentById(agentId: string): AgentRegistryEntry | undefined {
		// TODO: Implement in Phase 3 (T019)
		// 1. Lookup agent in internal registry by ID
		// 2. Return agent or undefined
		return this.agents.get(agentId);
	}

	/**
	 * Get agents grouped by type (local vs background)
	 * @returns Grouped agents for UI dropdown rendering
	 */
	getAgentsGroupedByType(): GroupedAgents {
		const all = this.getAllAgents();
		const local = all.filter((a) => a.type === "local");
		const background = all.filter((a) => a.type === "background");

		return {
			local,
			background,
		};
	}

	/**
	 * Check if an agent is currently available for invocation
	 * @param agentId Unique agent identifier
	 * @returns Availability check result with reason if unavailable
	 */
	async checkAgentAvailability(
		agentId: string
	): Promise<AgentAvailabilityCheck> {
		const agent = this.agents.get(agentId);

		if (!agent) {
			return {
				agentId,
				available: false,
				reason: "UNKNOWN",
				checkedAt: Date.now(),
			};
		}

		// For file-based agents, check if the file still exists
		if (agent.source === "file" && agent.sourcePath) {
			try {
				const { existsSync } = await import("node:fs");
				const fileExists = existsSync(agent.sourcePath);

				if (!fileExists) {
					return {
						agentId,
						available: false,
						reason: "FILE_DELETED",
						checkedAt: Date.now(),
					};
				}
			} catch (error) {
				return {
					agentId,
					available: false,
					reason: "UNKNOWN",
					checkedAt: Date.now(),
				};
			}
		}

		// Agent exists and file is accessible (or not file-based)
		return {
			agentId,
			available: true,
			checkedAt: Date.now(),
		};
	}

	/**
	 * Force refresh of agent registry from all sources
	 * @returns Promise resolving to new discovery results
	 */
	async refresh(): Promise<AgentDiscoveryResult[]> {
		// Clear internal registry
		this.agents.clear();

		// Re-run discovery from all sources
		const results = await this.initialize();

		return results;
	}

	/**
	 * Register callback for registry changes (new agents, removals, updates)
	 * @param callback Function to call when registry changes
	 * @returns Disposable to unregister callback
	 */
	onDidChangeRegistry(callback: (event: RegistryChangeEvent) => void): {
		dispose: () => void;
	} {
		// TODO: Implement in Phase 6 (T063)
		// 1. Add callback to internal listener list
		// 2. Return disposable that removes callback
		this.changeListeners.push(callback);

		return {
			dispose: () => {
				const index = this.changeListeners.indexOf(callback);
				if (index !== -1) {
					this.changeListeners.splice(index, 1);
				}
			},
		};
	}

	// ========================================================================
	// Internal Methods (to be implemented in later phases)
	// ========================================================================

	/**
	 * Discover local agents from .github/agents/ directory
	 * @returns Discovery result with local agents
	 */
	private async discoverLocalAgents(): Promise<AgentDiscoveryResult> {
		const agentsDir = `${this.workspaceRoot}/${AGENTS_DIR_RELATIVE_PATH}`;
		return await this.fileDiscovery.discoverFromDirectory(agentsDir);
	}

	/**
	 * Emit a registry change event to all listeners
	 * @param event Event to emit
	 */
	private emitChange(event: RegistryChangeEvent): void {
		for (const listener of this.changeListeners) {
			listener(event);
		}
	}

	/**
	 * Detect and resolve duplicate agent names
	 * @param agents List of agents to check for duplicates
	 * @returns Agents with disambiguated display names
	 */
	private resolveDuplicateNames(
		agents: AgentRegistryEntry[]
	): AgentRegistryEntry[] {
		// Group agents by name to find duplicates
		const nameGroups = new Map<string, AgentRegistryEntry[]>();

		for (const agent of agents) {
			const existing = nameGroups.get(agent.name);
			if (existing) {
				existing.push(agent);
			} else {
				nameGroups.set(agent.name, [agent]);
			}
		}

		// Process each group
		const result: AgentRegistryEntry[] = [];

		for (const [name, group] of nameGroups.entries()) {
			if (group.length === 1) {
				// No duplicates - keep original name
				result.push(group[0]);
			} else {
				// Duplicates found - append source indicators
				for (const agent of group) {
					const suffix = agent.source === "file" ? " (Local)" : " (Extension)";
					result.push({
						...agent,
						displayName: agent.name + suffix,
					});
				}
			}
		}

		return result;
	}
}
