/**
 * Gatomia-maintained catalog of per-agent mode/model/follow-up defaults used
 * when an ACP agent does not report capabilities via its `initialize`
 * response.
 *
 * @see specs/018-agent-chat-panel/contracts/agent-capabilities-contract.md §5
 *
 * The catalog is compiled into the extension bundle — updates require a code
 * change and a new release. Consumers MUST NOT mutate the exported data.
 */

import type {
	ModeDescriptor,
	ModelDescriptor,
	ResolvedCapabilities,
} from "./types";

/** Version of the catalog schema. Bumped on breaking changes. */
export const CATALOG_SCHEMA_VERSION = 1;

export interface KnownAgentCapabilities {
	/** Empty array = "mode selector hidden for this agent". */
	modes: readonly ModeDescriptor[];
	/** Empty array = "model selector hidden for this agent". */
	models: readonly ModelDescriptor[];
	/** Default: true. Set to false for agents that reject follow-ups. */
	acceptsFollowUp: boolean;
}

export interface AgentCatalogEntry {
	/** Matches `AcpProviderDescriptor.id` in `src/services/acp/providers/descriptors.ts`. */
	id: string;
	capabilities?: KnownAgentCapabilities;
}

/**
 * Seed list for v1. IDs match the existing provider descriptors
 * (`devin`, `gemini`) plus forward-looking entries for agents tracked in the
 * research phase. The catalog is intentionally sparse — agents that already
 * report their modes/models via ACP `initialize` do not need a catalog entry.
 */
export const AGENT_CAPABILITIES_CATALOG: readonly AgentCatalogEntry[] = [
	{
		id: "opencode",
		capabilities: {
			modes: [
				{ id: "code", displayName: "Code", promptPrefix: "[mode: code]\n" },
				{ id: "ask", displayName: "Ask", promptPrefix: "[mode: ask]\n" },
				{ id: "plan", displayName: "Plan", promptPrefix: "[mode: plan]\n" },
			],
			models: [],
			acceptsFollowUp: true,
		},
	},
	{
		id: "claude-code",
		capabilities: {
			modes: [],
			models: [
				{
					id: "sonnet",
					displayName: "Claude Sonnet",
					invocation: "cli-flag",
					invocationTemplate: "--model {id}",
				},
				{
					id: "opus",
					displayName: "Claude Opus",
					invocation: "cli-flag",
					invocationTemplate: "--model {id}",
				},
				{
					id: "haiku",
					displayName: "Claude Haiku",
					invocation: "cli-flag",
					invocationTemplate: "--model {id}",
				},
			],
			acceptsFollowUp: true,
		},
	},
	{
		id: "gemini",
		capabilities: {
			modes: [],
			models: [
				{
					id: "gemini-2.5-pro",
					displayName: "Gemini 2.5 Pro",
					invocation: "cli-flag",
					invocationTemplate: "--model {id}",
				},
				{
					id: "gemini-2.5-flash",
					displayName: "Gemini 2.5 Flash",
					invocation: "cli-flag",
					invocationTemplate: "--model {id}",
				},
			],
			acceptsFollowUp: true,
		},
	},
	{
		id: "devin",
		capabilities: {
			modes: [],
			models: [],
			// Devin CLI ACP sessions deliver a single turn today.
			acceptsFollowUp: false,
		},
	},
	{
		// Catalog id MUST match `AcpProviderDescriptor.id` so
		// `lookupCatalogEntry` resolves. The id was previously
		// `copilot-language-server` (the legacy LSP product) but the live
		// known-agent catalog registers the unified Copilot CLI under
		// `github-copilot`, so the lookup never matched and the model
		// dropdown stayed empty.
		id: "github-copilot",
		capabilities: {
			modes: [],
			// Models surfaced by `copilot --model <id>` on Copilot CLI
			// 1.0.x. Static list — the picker will overlay agent-reported
			// models when ACP `initialize` ever surfaces them.
			models: [
				{
					id: "gpt-5.2",
					displayName: "GPT-5.2 (default)",
					invocation: "cli-flag",
					invocationTemplate: "--model {id}",
				},
				{
					id: "gpt-5.4",
					displayName: "GPT-5.4",
					invocation: "cli-flag",
					invocationTemplate: "--model {id}",
				},
				{
					id: "gpt-5.4-mini",
					displayName: "GPT-5.4 Mini",
					invocation: "cli-flag",
					invocationTemplate: "--model {id}",
				},
				{
					id: "gpt-5-mini",
					displayName: "GPT-5 Mini",
					invocation: "cli-flag",
					invocationTemplate: "--model {id}",
				},
				{
					id: "gpt-5.2-codex",
					displayName: "GPT-5.2 Codex",
					invocation: "cli-flag",
					invocationTemplate: "--model {id}",
				},
				{
					id: "gpt-5.3-codex",
					displayName: "GPT-5.3 Codex",
					invocation: "cli-flag",
					invocationTemplate: "--model {id}",
				},
				{
					id: "gpt-4.1",
					displayName: "GPT-4.1",
					invocation: "cli-flag",
					invocationTemplate: "--model {id}",
				},
				{
					id: "claude-sonnet-4.6",
					displayName: "Claude Sonnet 4.6",
					invocation: "cli-flag",
					invocationTemplate: "--model {id}",
				},
			],
			acceptsFollowUp: true,
		},
	},
] as const;

/**
 * O(1)-ish lookup by id. Returns `undefined` when no entry matches.
 */
export function lookupCatalogEntry(
	agentId: string
): AgentCatalogEntry | undefined {
	return AGENT_CAPABILITIES_CATALOG.find((entry) => entry.id === agentId);
}

/**
 * Resolve purely from the catalog — no agent-reported input. Returns
 * `{ source: "none" }` when the agent is absent or its entry has no
 * `capabilities`. The `AgentCapabilitiesService` wraps this with the
 * agent-wins / catalog-fallback algorithm (see
 * `agent-capabilities-contract.md` §2).
 */
export function resolveFromCatalog(agentId: string): ResolvedCapabilities {
	const entry = lookupCatalogEntry(agentId);
	if (!entry?.capabilities) {
		return { source: "none" };
	}
	return {
		source: "catalog",
		modes: [...entry.capabilities.modes],
		models: [...entry.capabilities.models],
		acceptsFollowUp: entry.capabilities.acceptsFollowUp,
	};
}
