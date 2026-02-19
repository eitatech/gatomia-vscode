/**
 * KnownAgentPreferencesService
 *
 * Reads and writes the user's known-agent enablement preferences in VS Code's
 * `globalState`. Each user checks which of the 7 known ACP agents they have
 * installed; this service persists that choice across sessions.
 *
 * @feature 001-hooks-refactor Phase 8
 */

import type * as vscode from "vscode";
import type { KnownAgentId } from "./known-agent-catalog";

// ============================================================================
// Constants
// ============================================================================

/** globalState key for persisting enabled known-agent ids. */
export const KNOWN_AGENTS_PREFS_KEY = "gatomia.acp.knownAgents.enabled";

// ============================================================================
// Interface
// ============================================================================

export interface IKnownAgentPreferencesService {
	/** Returns the list of agent ids the user has enabled. */
	getEnabledAgents(): KnownAgentId[];
	/** Replaces the full enabled list. */
	setEnabledAgents(ids: KnownAgentId[]): Promise<void>;
	/** Toggles a single agent on or off. */
	toggleAgent(id: KnownAgentId, enabled: boolean): Promise<void>;
	/** Returns true if the agent is in the enabled list. */
	isAgentEnabled(id: KnownAgentId): boolean;
}

// ============================================================================
// Implementation
// ============================================================================

/**
 * Persists which known ACP agents the user has enabled in VS Code globalState.
 */
export class KnownAgentPreferencesService
	implements IKnownAgentPreferencesService
{
	private readonly context: vscode.ExtensionContext;

	constructor(context: vscode.ExtensionContext) {
		this.context = context;
	}

	getEnabledAgents(): KnownAgentId[] {
		const raw = this.context.globalState.get<unknown>(
			KNOWN_AGENTS_PREFS_KEY,
			[]
		);
		if (!Array.isArray(raw)) {
			return [];
		}
		return raw as KnownAgentId[];
	}

	async setEnabledAgents(ids: KnownAgentId[]): Promise<void> {
		await this.context.globalState.update(KNOWN_AGENTS_PREFS_KEY, ids);
	}

	async toggleAgent(id: KnownAgentId, enabled: boolean): Promise<void> {
		const current = this.getEnabledAgents();
		let updated: KnownAgentId[];
		if (enabled) {
			updated = current.includes(id) ? current : [...current, id];
		} else {
			updated = current.filter((a) => a !== id);
		}
		await this.setEnabledAgents(updated);
	}

	isAgentEnabled(id: KnownAgentId): boolean {
		return this.getEnabledAgents().includes(id);
	}
}
