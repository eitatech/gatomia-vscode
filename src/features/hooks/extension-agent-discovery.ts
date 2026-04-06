/**
 * Extension Agent Discovery Service
 *
 * Discovers agents from VS Code extensions via the `chatParticipants`
 * contribution point.
 *
 * Responsibilities:
 * - Scan installed VS Code extensions
 * - Identify extensions that register chat participants
 * - Extract agent metadata from extension manifest
 * - Convert to AgentRegistryEntry format
 *
 * Implementation:
 * - Uses vscode.extensions.all to access all installed extensions
 * - Parses package.json contributes.chatParticipants field
 * - Generates agent ID in format: extension:{extensionId}:{participantId}
 * - Sets agent type to "background" for all extension agents
 *
 * @see specs/011-custom-agent-hooks/contracts/agent-registry-api.ts
 * @see specs/011-custom-agent-hooks/research.md
 */

// biome-ignore lint/performance/noNamespaceImport: vscode module requires namespace import
import * as vscode from "vscode";
import type {
	AgentDiscoveryResult,
	AgentRegistryEntry,
} from "./agent-registry-types";

// ============================================================================
// Supporting Types
// ============================================================================

/**
 * Chat Participant definition from VS Code extension manifest
 */
interface ChatParticipant {
	id: string;
	name: string;
	description?: string;
	isSticky?: boolean;
	commands?: ChatParticipantCommand[];
}

/**
 * Chat Participant command definition
 */
interface ChatParticipantCommand {
	name: string;
	description?: string;
}

// ============================================================================
// Extension Agent Discovery Implementation
// ============================================================================

/**
 * ExtensionAgentDiscovery - Discovers agents from VS Code extensions
 *
 * Implements IExtensionAgentDiscovery contract from agent-registry-api.ts
 */
export class ExtensionAgentDiscovery {
	/**
	/**
	 * Discover all agents registered by VS Code extensions
	 * @returns Discovery result with agents and errors
	 */
	discoverAgents(): AgentDiscoveryResult {
		const agents: AgentRegistryEntry[] = [];
		const errors: Array<{ extensionId: string; error: Error }> = [];

		try {
			// Scan all installed extensions
			const allExtensions = vscode.extensions.all;

			for (const extension of allExtensions) {
				try {
					// Check if extension has chatParticipants contribution
					const participants = this.extractChatParticipants(extension);

					if (participants.length > 0) {
						// Convert each participant to AgentRegistryEntry
						for (const participant of participants) {
							const agent = this.convertParticipantToAgent(
								extension,
								participant
							);
							if (agent) {
								agents.push(agent);
							}
						}
					}
				} catch (error) {
					// Log error but continue processing other extensions
					errors.push({
						extensionId: extension.id,
						error: error as Error,
					});
				}
			}
		} catch (error) {
			// Log error but return whatever we discovered
			errors.push({
				extensionId: "unknown",
				error: error as Error,
			});
		}

		return {
			source: "extension",
			agents,
			errors: errors.map((e) => ({
				extensionId: e.extensionId,
				code: "EXTENSION_ERROR",
				message: e.error.message,
			})),
			discoveredAt: Date.now(),
		};
	}

	/**
	/**
	 * Get agent metadata from a specific extension
	 * @param extensionId VS Code extension identifier
	 * @returns Agent registry entry or undefined
	 */
	getAgentFromExtension(extensionId: string): AgentRegistryEntry | undefined {
		try {
			const extension = vscode.extensions.getExtension(extensionId);

			if (!extension) {
				return;
			}

			const participants = this.extractChatParticipants(extension);

			if (participants.length === 0) {
				return;
			}

			// Return first participant
			return this.convertParticipantToAgent(extension, participants[0]);
		} catch (error) {
			return;
		}
	}

	/**
	 * Check if an extension provides chat participants
	 * @param extensionId VS Code extension identifier
	 * @returns True if extension has chatParticipants contribution
	 */
	isAgentExtension(extensionId: string): boolean {
		try {
			const extension = vscode.extensions.getExtension(extensionId);

			if (!extension) {
				return false;
			}

			const participants = this.extractChatParticipants(extension);
			return participants.length > 0;
		} catch (error) {
			return false;
		}
	}

	// ========================================================================
	// Internal Methods
	// ========================================================================

	/**
	 * Extract chatParticipants from extension manifest
	 * @param extension VS Code extension
	 * @returns Array of chat participants
	 */
	private extractChatParticipants(
		extension: vscode.Extension<any>
	): ChatParticipant[] {
		try {
			// Access package.json contributes.chatParticipants
			const packageJSON = extension.packageJSON;

			if (!packageJSON || typeof packageJSON !== "object") {
				return [];
			}

			const contributes = packageJSON.contributes;

			if (!contributes || typeof contributes !== "object") {
				return [];
			}

			const chatParticipants = contributes.chatParticipants;

			// Validate chatParticipants is an array
			if (!Array.isArray(chatParticipants)) {
				return [];
			}

			// Filter out invalid participants
			return chatParticipants.filter(
				(participant) =>
					participant &&
					typeof participant === "object" &&
					typeof participant.id === "string" &&
					typeof participant.name === "string" &&
					participant.id.length > 0 &&
					participant.name.length > 0
			);
		} catch (error) {
			return [];
		}
	}

	/**
	 * Convert chat participant to AgentRegistryEntry
	 * @param extension VS Code extension
	 * @param participant Chat participant from manifest
	 * @returns AgentRegistryEntry or undefined if conversion fails
	 */
	private convertParticipantToAgent(
		extension: vscode.Extension<any>,
		participant: ChatParticipant
	): AgentRegistryEntry | undefined {
		try {
			// Validate required fields
			if (!(participant.id && participant.name)) {
				return;
			}

			// Generate agent ID: extension:{extensionId}:{participantId}
			const agentId = `extension:${extension.id}:${participant.id}`;

			// Get description or use fallback
			const description =
				participant.description ||
				`Chat participant from ${extension.packageJSON.displayName || extension.id}`;

			// Create agent registry entry
			const agent: AgentRegistryEntry = {
				id: agentId,
				name: participant.name,
				displayName: participant.name,
				description,
				type: "background", // All extension agents are background agents
				source: "extension",
				available: true,
				discoveredAt: Date.now(),
				extensionId: extension.id, // Store extension ID at top level
			};

			return agent;
		} catch (error) {
			return;
		}
	}
}
