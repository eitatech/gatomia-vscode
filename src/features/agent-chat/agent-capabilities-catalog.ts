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
			// OpenCode routes prompts through configured providers; the
			// CLI flag is `--model <provider>/<id>`. The seed list below
			// covers the providers OpenCode ships with by default — the
			// user can override via `opencode.json` and the picker will
			// still send the chosen value verbatim. Picker may overlay
			// agent-reported models when ACP `initialize` surfaces them.
			models: [
				{
					id: "anthropic/claude-sonnet-4-5",
					displayName: "Claude Sonnet 4.5 (default)",
					invocation: "cli-flag",
					invocationTemplate: "--model {id}",
				},
				{
					id: "anthropic/claude-opus-4-5",
					displayName: "Claude Opus 4.5",
					invocation: "cli-flag",
					invocationTemplate: "--model {id}",
				},
				{
					id: "anthropic/claude-haiku-4-5",
					displayName: "Claude Haiku 4.5",
					invocation: "cli-flag",
					invocationTemplate: "--model {id}",
				},
				{
					id: "openai/gpt-5",
					displayName: "OpenAI GPT-5",
					invocation: "cli-flag",
					invocationTemplate: "--model {id}",
				},
				{
					id: "openai/gpt-5-mini",
					displayName: "OpenAI GPT-5 Mini",
					invocation: "cli-flag",
					invocationTemplate: "--model {id}",
				},
				{
					id: "openai/gpt-5-codex",
					displayName: "OpenAI GPT-5 Codex",
					invocation: "cli-flag",
					invocationTemplate: "--model {id}",
				},
				{
					id: "google/gemini-2.5-pro",
					displayName: "Gemini 2.5 Pro",
					invocation: "cli-flag",
					invocationTemplate: "--model {id}",
				},
				{
					id: "google/gemini-2.5-flash",
					displayName: "Gemini 2.5 Flash",
					invocation: "cli-flag",
					invocationTemplate: "--model {id}",
				},
				{
					id: "xai/grok-4",
					displayName: "xAI Grok 4",
					invocation: "cli-flag",
					invocationTemplate: "--model {id}",
				},
				{
					id: "deepseek/deepseek-v3.2",
					displayName: "DeepSeek V3.2",
					invocation: "cli-flag",
					invocationTemplate: "--model {id}",
				},
			],
			acceptsFollowUp: true,
		},
	},
	{
		// Catalog id MUST match `AcpProviderDescriptor.id` so
		// `lookupCatalogEntry` resolves. The known-agent catalog
		// registers the Zed-published ACP wrapper under `claude-acp`
		// (`@zed-industries/claude-agent-acp`); using `claude-code`
		// here made the lookup miss and the model dropdown stayed
		// empty.
		id: "claude-acp",
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
	{
		// Catalog id MUST match `AcpProviderDescriptor.id` so
		// `lookupCatalogEntry` resolves. The known-agent catalog
		// registers JetBrains Junie under `junie`; without an entry
		// here the model dropdown stayed empty after the user picked
		// "JetBrains Junie" in the composer.
		id: "junie",
		capabilities: {
			modes: [],
			// Junie ships with the JetBrains AI provider stack — the
			// effective model list depends on the user's JetBrains AI
			// subscription. The seed below covers the providers Junie
			// exposes by default; the picker sends the chosen value
			// verbatim and Junie surfaces an error if the model is not
			// available in the user's plan.
			models: [
				{
					id: "anthropic/claude-sonnet-4-5",
					displayName: "Claude Sonnet 4.5 (default)",
					invocation: "cli-flag",
					invocationTemplate: "--model {id}",
				},
				{
					id: "anthropic/claude-opus-4-5",
					displayName: "Claude Opus 4.5",
					invocation: "cli-flag",
					invocationTemplate: "--model {id}",
				},
				{
					id: "openai/gpt-5",
					displayName: "OpenAI GPT-5",
					invocation: "cli-flag",
					invocationTemplate: "--model {id}",
				},
				{
					id: "openai/gpt-5-mini",
					displayName: "OpenAI GPT-5 Mini",
					invocation: "cli-flag",
					invocationTemplate: "--model {id}",
				},
				{
					id: "google/gemini-2.5-pro",
					displayName: "Gemini 2.5 Pro",
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
