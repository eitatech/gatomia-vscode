/**
 * Agent Discovery Service Interface
 *
 * Defines the interface for discovering agents from all sources:
 * - Local .agent.md files in .github/agents/
 * - VS Code extensions with chatParticipants contributions
 *
 * @see specs/011-custom-agent-hooks/contracts/agent-registry-api.ts
 */

import type {
	AgentDiscoveryResult,
	AgentSourceEnum,
} from "./agent-registry-types";

// ============================================================================
// Core Discovery Interface
// ============================================================================

/**
 * IAgentDiscoveryService - Unified agent discovery from all sources
 *
 * Orchestrates discovery from:
 * - Local .agent.md files via FileAgentDiscovery
 * - VS Code extensions via ExtensionAgentDiscovery
 *
 * This is an interface definition. Implementation will be added in Phase 3.
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
