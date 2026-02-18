/**
 * AcpAgentDiscoveryService
 *
 * Scans `.github/agents/*.agent.md` in the workspace, parses YAML frontmatter
 * via gray-matter, and returns ACPAgentDescriptor[] for every file that has
 * `acp: true` in its frontmatter.
 *
 * Never throws — returns an empty array on any error (e.g. directory absent).
 *
 * @feature 001-hooks-refactor Phase 6
 * @see specs/001-hooks-refactor/contracts/acp-messages.ts ACPAgentDescriptor
 */

import { join } from "node:path";
import { readdir, readFile } from "node:fs/promises";
import matter from "gray-matter";

const LOG_PREFIX = "[AcpAgentDiscoveryService]";

const AGENT_FILE_SUFFIX = ".agent.md";
const AGENTS_DIR = join(".github", "agents");

// ============================================================================
// Types
// ============================================================================

export interface ACPAgentDescriptor {
	/** Shell command used to spawn the agent. */
	agentCommand: string;
	/** Human-readable label shown in the dropdown. */
	agentDisplayName: string;
	/** Origin of this descriptor. */
	source: "workspace";
}

export interface IAcpAgentDiscoveryService {
	/**
	 * Discovers ACP-compatible agents in the workspace.
	 * Returns an empty array when the agents directory is absent or no agents
	 * have `acp: true` in their frontmatter. Never throws.
	 */
	discoverAgents(): Promise<ACPAgentDescriptor[]>;
}

// ============================================================================
// Implementation
// ============================================================================

/**
 * AcpAgentDiscoveryService — discovers local ACP agents from workspace files.
 */
export class AcpAgentDiscoveryService implements IAcpAgentDiscoveryService {
	private readonly workspaceRoot: string;

	constructor(workspaceRoot: string) {
		this.workspaceRoot = workspaceRoot;
	}

	async discoverAgents(): Promise<ACPAgentDescriptor[]> {
		const agentsDir = join(this.workspaceRoot, AGENTS_DIR);

		let entries: string[];
		try {
			entries = await readdir(agentsDir);
		} catch (err) {
			// Directory absent or unreadable — not an error condition
			console.log(
				`${LOG_PREFIX} Agents directory not found or unreadable: ${agentsDir}`
			);
			return [];
		}

		const agentFiles = entries.filter((f) => f.endsWith(AGENT_FILE_SUFFIX));

		const results = await Promise.allSettled(
			agentFiles.map((fileName) =>
				this.parseAgentFile(join(agentsDir, fileName), fileName)
			)
		);

		const agents: ACPAgentDescriptor[] = [];
		for (const result of results) {
			if (result.status === "fulfilled" && result.value !== null) {
				agents.push(result.value);
			}
		}

		return agents;
	}

	// -------------------------------------------------------------------------
	// Private helpers
	// -------------------------------------------------------------------------

	private async parseAgentFile(
		filePath: string,
		fileName: string
	): Promise<ACPAgentDescriptor | null> {
		const content = await readFile(filePath, "utf8");
		const parsed = matter(content);
		const data = parsed.data as Record<string, unknown>;

		if (data.acp !== true) {
			return null;
		}

		const agentCommand =
			typeof data.agentCommand === "string" ? data.agentCommand : "";
		if (!agentCommand) {
			console.log(`${LOG_PREFIX} Skipping ${fileName}: missing agentCommand`);
			return null;
		}

		const displayNameFromFile = fileName.replace(AGENT_FILE_SUFFIX, "");
		const agentDisplayName =
			typeof data.agentDisplayName === "string" && data.agentDisplayName
				? data.agentDisplayName
				: displayNameFromFile;

		return {
			agentCommand,
			agentDisplayName,
			source: "workspace",
		};
	}
}
