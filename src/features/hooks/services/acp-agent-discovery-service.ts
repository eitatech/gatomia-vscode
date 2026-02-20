/**
 * AcpAgentDiscoveryService
 *
 * Discovers ACP-compatible agents from two sources (merged):
 *   1. Workspace files: `.github/agents/*.agent.md` with `acp: true` frontmatter
 *   2. Known agents: 7 pre-configured agents that the user has enabled
 *      and that are detected as installed on the system.
 *
 * Never throws — returns an empty array on any error.
 *
 * @feature 001-hooks-refactor Phase 6 (workspace) + Phase 8 (known agents)
 * @see specs/001-hooks-refactor/contracts/acp-messages.ts ACPAgentDescriptor
 */

import { join } from "node:path";
import { readdir, readFile } from "node:fs/promises";
import matter from "gray-matter";
import { KNOWN_AGENTS } from "./known-agent-catalog";
import type { KnownAgentDetector } from "./known-agent-detector";
import type { IKnownAgentPreferencesService } from "./known-agent-preferences-service";

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
	/** Where this descriptor originated. */
	source: "workspace" | "known" | "custom";
	/**
	 * For `source: "known"` agents — the catalog id (e.g. "gemini", "opencode").
	 * Undefined for workspace and custom agents.
	 */
	knownAgentId?: string;
}

export interface IAcpAgentDiscoveryService {
	/**
	 * Discovers ACP-compatible agents from all available sources.
	 * Returns an empty array when no agents are found. Never throws.
	 */
	discoverAgents(): Promise<ACPAgentDescriptor[]>;
}

// ============================================================================
// Implementation
// ============================================================================

/**
 * AcpAgentDiscoveryService — discovers local ACP agents from workspace files
 * and from the known-agent catalog (user preferences + system detection).
 */
export class AcpAgentDiscoveryService implements IAcpAgentDiscoveryService {
	private readonly workspaceRoot: string;
	private readonly detector: KnownAgentDetector | undefined;
	private readonly prefs: IKnownAgentPreferencesService | undefined;

	constructor(
		workspaceRoot: string,
		detector?: KnownAgentDetector,
		prefs?: IKnownAgentPreferencesService
	) {
		this.workspaceRoot = workspaceRoot;
		this.detector = detector;
		this.prefs = prefs;
	}

	async discoverAgents(): Promise<ACPAgentDescriptor[]> {
		const [workspaceAgents, knownAgents] = await Promise.allSettled([
			this.discoverWorkspaceAgents(),
			this.discoverKnownAgents(),
		]);

		const result: ACPAgentDescriptor[] = [];

		if (workspaceAgents.status === "fulfilled") {
			result.push(...workspaceAgents.value);
		} else {
			console.log(
				`${LOG_PREFIX} Workspace discovery failed: ${workspaceAgents.reason}`
			);
		}

		if (knownAgents.status === "fulfilled") {
			result.push(...knownAgents.value);
		} else {
			console.log(
				`${LOG_PREFIX} Known agent discovery failed: ${knownAgents.reason}`
			);
		}

		return result;
	}

	// -------------------------------------------------------------------------
	// Workspace discovery
	// -------------------------------------------------------------------------

	private async discoverWorkspaceAgents(): Promise<ACPAgentDescriptor[]> {
		const agentsDir = join(this.workspaceRoot, AGENTS_DIR);

		let entries: string[];
		try {
			entries = await readdir(agentsDir);
		} catch (err) {
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

	// -------------------------------------------------------------------------
	// Known agent discovery
	// -------------------------------------------------------------------------

	private async discoverKnownAgents(): Promise<ACPAgentDescriptor[]> {
		if (!(this.prefs && this.detector)) {
			return [];
		}

		const enabledIds = this.prefs.getEnabledAgents();
		if (enabledIds.length === 0) {
			return [];
		}

		const results = await Promise.allSettled(
			enabledIds.map((id) => this.resolveKnownAgent(id))
		);

		const agents: ACPAgentDescriptor[] = [];
		for (const result of results) {
			if (result.status === "fulfilled" && result.value !== null) {
				agents.push(result.value);
			} else if (result.status === "rejected") {
				console.log(`${LOG_PREFIX} Known agent check failed: ${result.reason}`);
			}
		}

		return agents;
	}

	private async resolveKnownAgent(
		id: string
	): Promise<ACPAgentDescriptor | null> {
		const entry = KNOWN_AGENTS.find((a) => a.id === id);
		if (!(entry && this.detector)) {
			return null;
		}

		const detected = await this.detector.isInstalledAny(entry.installChecks);
		if (!detected) {
			console.log(`${LOG_PREFIX} Known agent '${id}' not detected on system`);
			return null;
		}

		return {
			agentCommand: entry.agentCommand,
			agentDisplayName: entry.displayName,
			source: "known",
			knownAgentId: entry.id,
		};
	}
}
