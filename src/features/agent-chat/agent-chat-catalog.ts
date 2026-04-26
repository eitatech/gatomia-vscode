/**
 * AgentChatCatalog — feeds the sidebar webview the lists it needs to render
 * the provider / model / agent-file pickers.
 *
 * The catalog is composed at request time from three already-existing sources:
 *
 *   - {@link AcpProviderRegistry}: the live ACP provider list (built-in +
 *     remote-merged), with each entry tagged `installed` / `available-via-npx`
 *     / `install-required` so the picker can disable unreachable items.
 *   - {@link AGENT_CAPABILITIES_CATALOG}: per-provider model catalogue used
 *     when the agent does not report `models` via its ACP `initialize`
 *     handshake. The picker only needs static descriptors here — the runtime
 *     `AcpChatRunner` is the one that applies the user's choice.
 *   - {@link AgentRegistry} (hooks): workspace `.github/agents/` markdown
 *     files. Treated as the "agent file" preset that gets injected as the
 *     initial prompt for new sessions.
 *
 * No state is owned here — `buildAgentChatCatalog` is a pure projection that
 * the view provider re-runs whenever it broadcasts `agent-chat/catalog/loaded`.
 */

import type { AcpProviderRegistry } from "../../services/acp/acp-provider-registry";
import type { AgentRegistry } from "../hooks/agent-registry";
import type {
	AgentRegistryEntry,
	AgentSourceEnum,
} from "../hooks/agent-registry-types";
import { lookupCatalogEntry } from "./agent-capabilities-catalog";
import type { ModelDescriptor } from "./types";

// ---------------------------------------------------------------------------
// Public shapes (mirrored on the webview side via postMessage payloads)
// ---------------------------------------------------------------------------

export type ProviderAvailability =
	| "installed"
	| "available-via-npx"
	| "install-required";

export interface AgentChatProviderOption {
	readonly id: string;
	readonly displayName: string;
	readonly description?: string;
	readonly availability: ProviderAvailability;
	/** True when the provider is selectable from the picker without onboarding. */
	readonly enabled: boolean;
	/** Source tier — built-in/local providers are surfaced first in the picker. */
	readonly source: "built-in" | "local" | "remote";
	/** Pre-resolved npx package id (when applicable) so the UI can show "via npx". */
	readonly npxPackage?: string;
	/** External URL to install the provider when `availability === "install-required"`. */
	readonly installUrl?: string;
	/** Static model catalogue from `agent-capabilities-catalog.ts`. */
	readonly models: readonly ModelDescriptor[];
}

export interface AgentChatAgentFileOption {
	readonly id: string;
	readonly displayName: string;
	readonly description?: string;
	readonly source: AgentSourceEnum;
	readonly absolutePath?: string;
}

export interface AgentChatCatalog {
	readonly providers: readonly AgentChatProviderOption[];
	readonly agentFiles: readonly AgentChatAgentFileOption[];
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

export interface AgentChatCatalogSources {
	readonly acpProviderRegistry: AcpProviderRegistry | null | undefined;
	readonly agentRegistry: AgentRegistry | null | undefined;
}

export function buildAgentChatCatalog(
	sources: AgentChatCatalogSources
): AgentChatCatalog {
	const providers = projectProviders(sources.acpProviderRegistry);
	const agentFiles = projectAgentFiles(sources.agentRegistry);
	return { providers, agentFiles };
}

function projectProviders(
	registry: AcpProviderRegistry | null | undefined
): AgentChatProviderOption[] {
	if (!registry) {
		return [];
	}
	return registry.list().map((descriptor): AgentChatProviderOption => {
		const source = descriptor.source ?? "built-in";
		const availability = classifyAvailability(descriptor);
		const npxPackage =
			descriptor.spawnCommand === "npx" && descriptor.spawnArgs[0] === "-y"
				? descriptor.spawnArgs[1]
				: undefined;
		const catalogEntry = lookupCatalogEntry(descriptor.id);
		return {
			id: descriptor.id,
			displayName: descriptor.displayName,
			description: descriptor.description,
			availability,
			enabled: availability !== "install-required",
			source,
			npxPackage,
			installUrl: descriptor.installUrl || undefined,
			models: catalogEntry?.capabilities?.models ?? [],
		};
	});
}

function classifyAvailability(descriptor: {
	source?: "built-in" | "local" | "remote";
	spawnCommand: string;
	spawnArgs: string[];
}): ProviderAvailability {
	const source = descriptor.source ?? "built-in";
	if (source === "built-in" || source === "local") {
		return "installed";
	}
	if (descriptor.spawnCommand === "npx") {
		return "available-via-npx";
	}
	return "install-required";
}

function projectAgentFiles(
	agentRegistry: AgentRegistry | null | undefined
): AgentChatAgentFileOption[] {
	if (!agentRegistry) {
		return [];
	}
	let entries: AgentRegistryEntry[];
	try {
		entries = agentRegistry.getAllAgents();
	} catch {
		return [];
	}
	return entries
		.filter((entry) => entry.available)
		.map(
			(entry): AgentChatAgentFileOption => ({
				id: entry.id,
				displayName: entry.displayName,
				description: entry.description,
				source: entry.source,
				absolutePath: entry.sourcePath,
			})
		);
}
