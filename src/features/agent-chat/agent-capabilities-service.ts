/**
 * Hybrid capability resolver for ACP agents (T058).
 *
 * @see specs/018-agent-chat-panel/contracts/agent-capabilities-contract.md
 *
 * Resolver semantics:
 *   1. If the agent reported at least one of `modes`, `models`, or
 *      `acceptsFollowUp`, the agent-reported source wins (FR-011b).
 *   2. Otherwise, fall back to the catalog entry's `capabilities` (if any).
 *   3. Otherwise, return `{ source: "none" }`.
 *
 * Pure-function contract: the resolver depends only on its inputs (agent
 * initialize response + catalog lookup) and has no side effects other than
 * emitting a telemetry event.
 */

import { lookupCatalogEntry } from "./agent-capabilities-catalog";
import type { AgentCatalogEntry } from "./agent-capabilities-catalog";
import { AGENT_CHAT_TELEMETRY_EVENTS, logTelemetry } from "./telemetry";
import type {
	ModeDescriptor,
	ModelDescriptor,
	ResolvedCapabilities,
} from "./types";

/** ACP `AgentCapabilities` subset consumed by the resolver. */
export interface AgentInitializeCapabilities {
	modes?: Array<{
		id: string;
		displayName?: string;
		promptPrefix?: string;
	}>;
	models?: Array<{
		id: string;
		displayName?: string;
		invocation?: "initial-prompt" | "cli-flag";
		invocationTemplate?: string;
	}>;
	acceptsFollowUp?: boolean;
}

/**
 * Source of the agent's `initialize` response. Injected so tests and
 * production wire-up can plug different backends (real `AcpClient`,
 * fake, etc.).
 */
export interface AgentInitializeCapabilitiesReader {
	getInitializeCapabilities(
		agentId: string
	): AgentInitializeCapabilities | undefined;
}

/** Catalog accessor. Defaults to the in-process catalog export. */
export interface CatalogLookup {
	lookup(agentId: string): AgentCatalogEntry | undefined;
}

/** Telemetry sink matching the project-wide `logTelemetry` signature. */
export type TelemetryFn = (
	event: string,
	properties: Record<string, string | number | boolean>
) => void;

export interface AgentCapabilitiesServiceOptions {
	reader: AgentInitializeCapabilitiesReader;
	catalog?: CatalogLookup;
	telemetry?: TelemetryFn;
}

/** Default follow-up acceptance when neither source specifies. */
export const DEFAULT_ACCEPTS_FOLLOW_UP = true;

const HUMANIZE_SEPARATOR_PATTERN = /[-_]/;

/**
 * Convert a kebab- or snake-cased id into a human-readable display name.
 *
 * Rules:
 *   1. Split on `-` and `_`.
 *   2. Lower-case every segment.
 *   3. Upper-case the first character of every non-empty segment.
 *   4. Join with a single space.
 */
export function humanize(id: string): string {
	if (id.length === 0) {
		return "";
	}
	return id
		.split(HUMANIZE_SEPARATOR_PATTERN)
		.filter((segment) => segment.length > 0)
		.map((segment) => {
			const lower = segment.toLowerCase();
			return lower.charAt(0).toUpperCase() + lower.slice(1);
		})
		.join(" ");
}

export class AgentCapabilitiesService {
	private readonly reader: AgentInitializeCapabilitiesReader;
	private readonly catalog: CatalogLookup;
	private readonly telemetry: TelemetryFn;

	constructor(options: AgentCapabilitiesServiceOptions) {
		this.reader = options.reader;
		this.catalog = options.catalog ?? {
			lookup: (id) => lookupCatalogEntry(id),
		};
		this.telemetry = options.telemetry ?? logTelemetry;
	}

	/**
	 * Resolve the effective capabilities for an agent id. Emits one
	 * `agent-chat.capabilities.resolved` telemetry event per call.
	 */
	resolve(agentId: string): ResolvedCapabilities {
		const result = this.computeResolution(agentId);
		this.emitTelemetry(agentId, result);
		return result;
	}

	private computeResolution(agentId: string): ResolvedCapabilities {
		const reported = this.reader.getInitializeCapabilities(agentId);
		const cataloged = this.catalog.lookup(agentId);

		if (reported && hasAgentSignal(reported)) {
			return {
				source: "agent",
				modes: normalizeModes(reported.modes ?? []),
				models: normalizeModels(reported.models ?? []),
				acceptsFollowUp:
					reported.acceptsFollowUp ??
					cataloged?.capabilities?.acceptsFollowUp ??
					DEFAULT_ACCEPTS_FOLLOW_UP,
			};
		}

		if (cataloged?.capabilities) {
			// Use the injected catalog's result directly so tests that inject a
			// stub lookup don't require mutating the module-level seed list.
			return {
				source: "catalog",
				modes: [...cataloged.capabilities.modes],
				models: [...cataloged.capabilities.models],
				acceptsFollowUp: cataloged.capabilities.acceptsFollowUp,
			};
		}

		return { source: "none" };
	}

	private emitTelemetry(agentId: string, result: ResolvedCapabilities): void {
		const modeCount = result.source === "none" ? 0 : result.modes.length;
		const modelCount = result.source === "none" ? 0 : result.models.length;
		const acceptsFollowUp =
			result.source === "none" ? "n/a" : String(result.acceptsFollowUp);
		this.telemetry(AGENT_CHAT_TELEMETRY_EVENTS.CAPABILITIES_RESOLVED, {
			agentId,
			source: result.source,
			modeCount,
			modelCount,
			acceptsFollowUp,
		});
	}
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function hasAgentSignal(reported: AgentInitializeCapabilities): boolean {
	const hasModes = (reported.modes?.length ?? 0) > 0;
	const hasModels = (reported.models?.length ?? 0) > 0;
	const hasFollowUpFlag = reported.acceptsFollowUp !== undefined;
	return hasModes || hasModels || hasFollowUpFlag;
}

function normalizeModes(
	raw: NonNullable<AgentInitializeCapabilities["modes"]>
): ModeDescriptor[] {
	const seen = new Set<string>();
	const out: ModeDescriptor[] = [];
	for (const entry of raw) {
		if (typeof entry.id !== "string" || entry.id.length === 0) {
			continue;
		}
		if (seen.has(entry.id)) {
			continue;
		}
		seen.add(entry.id);
		out.push({
			id: entry.id,
			displayName: entry.displayName ?? humanize(entry.id),
			promptPrefix: entry.promptPrefix,
		});
	}
	return out;
}

function normalizeModels(
	raw: NonNullable<AgentInitializeCapabilities["models"]>
): ModelDescriptor[] {
	const seen = new Set<string>();
	const out: ModelDescriptor[] = [];
	for (const entry of raw) {
		if (typeof entry.id !== "string" || entry.id.length === 0) {
			continue;
		}
		if (seen.has(entry.id)) {
			continue;
		}
		seen.add(entry.id);
		out.push({
			id: entry.id,
			displayName: entry.displayName ?? humanize(entry.id),
			invocation: entry.invocation ?? "initial-prompt",
			invocationTemplate: entry.invocationTemplate,
		});
	}
	return out;
}
