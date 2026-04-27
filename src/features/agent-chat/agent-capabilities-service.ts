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
	AgentRoleDescriptor,
	ModeDescriptor,
	ModelDescriptor,
	ResolvedCapabilities,
	ThinkingLevelDescriptor,
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
	/**
	 * Optional reasoning effort tiers (e.g. low/medium/high) reported
	 * by the agent. When the agent does not surface this field the
	 * resolver falls back to the catalog entry, which may also be
	 * empty/undefined — in which case the chip stays hidden.
	 */
	thinkingLevels?: Array<{
		id: string;
		displayName?: string;
		description?: string;
	}>;
	/** Optional agent role / type list (Cursor-style Agent / Plan / Ask). */
	agentRoles?: Array<{
		id: string;
		displayName?: string;
		description?: string;
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
			// Agent reports what it knows; we top up with the catalog
			// so a partial agent payload still benefits from any tiers
			// the catalog has (e.g. agent surfaces models but not
			// thinking levels, so the catalog fills that gap). The
			// optional fields stay OFF the result entirely when neither
			// source supplied a list — keeps existing
			// `toStrictEqual({ … })` tests valid and the JSON payload
			// crossing the bridge a touch smaller.
			const thinkingLevels = pickThinkingLevels(reported, cataloged);
			const agentRoles = pickAgentRoles(reported, cataloged);
			return {
				source: "agent",
				modes: normalizeModes(reported.modes ?? []),
				models: normalizeModels(reported.models ?? []),
				...(thinkingLevels ? { thinkingLevels } : {}),
				...(agentRoles ? { agentRoles } : {}),
				acceptsFollowUp:
					reported.acceptsFollowUp ??
					cataloged?.capabilities?.acceptsFollowUp ??
					DEFAULT_ACCEPTS_FOLLOW_UP,
			};
		}

		if (cataloged?.capabilities) {
			// Use the injected catalog's result directly so tests that inject a
			// stub lookup don't require mutating the module-level seed list.
			const thinkingLevels = cataloged.capabilities.thinkingLevels
				? [...cataloged.capabilities.thinkingLevels]
				: undefined;
			const agentRoles = cataloged.capabilities.agentRoles
				? [...cataloged.capabilities.agentRoles]
				: undefined;
			return {
				source: "catalog",
				modes: [...cataloged.capabilities.modes],
				models: [...cataloged.capabilities.models],
				...(thinkingLevels ? { thinkingLevels } : {}),
				...(agentRoles ? { agentRoles } : {}),
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

function normalizeThinkingLevels(
	raw: NonNullable<AgentInitializeCapabilities["thinkingLevels"]>
): ThinkingLevelDescriptor[] {
	const seen = new Set<string>();
	const out: ThinkingLevelDescriptor[] = [];
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
			description: entry.description,
		});
	}
	return out;
}

function normalizeAgentRoles(
	raw: NonNullable<AgentInitializeCapabilities["agentRoles"]>
): AgentRoleDescriptor[] {
	const seen = new Set<string>();
	const out: AgentRoleDescriptor[] = [];
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
			description: entry.description,
		});
	}
	return out;
}

/**
 * Decide which thinking-level list wins on a hybrid resolution. Agents
 * that surface their own list always take precedence; otherwise we
 * inherit the catalog list so a partial ACP payload doesn't accidentally
 * hide the chip.
 */
function pickThinkingLevels(
	reported: AgentInitializeCapabilities,
	cataloged: AgentCatalogEntry | undefined
): ThinkingLevelDescriptor[] | undefined {
	if (reported.thinkingLevels && reported.thinkingLevels.length > 0) {
		return normalizeThinkingLevels(reported.thinkingLevels);
	}
	const fromCatalog = cataloged?.capabilities?.thinkingLevels;
	return fromCatalog ? [...fromCatalog] : undefined;
}

function pickAgentRoles(
	reported: AgentInitializeCapabilities,
	cataloged: AgentCatalogEntry | undefined
): AgentRoleDescriptor[] | undefined {
	if (reported.agentRoles && reported.agentRoles.length > 0) {
		return normalizeAgentRoles(reported.agentRoles);
	}
	const fromCatalog = cataloged?.capabilities?.agentRoles;
	return fromCatalog ? [...fromCatalog] : undefined;
}
