/**
 * AgentCapabilitiesService unit tests (T049).
 *
 * TDD (Constitution III): red before T058.
 *
 * Covers every case in contracts/agent-capabilities-contract.md §7:
 *   - agent reports only modes / only models / only acceptsFollowUp
 *   - agent silent + catalog populated / catalog without capabilities / no entry
 *   - agent wins on conflict
 *   - normalization drops invalid ids, de-dupes ids, fills defaults
 *   - humanize() pure-function cases
 *   - telemetry emission
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
	AgentInitializeCapabilities,
	AgentInitializeCapabilitiesReader,
	CatalogLookup,
} from "../../../../src/features/agent-chat/agent-capabilities-service";
import {
	AgentCapabilitiesService,
	humanize,
} from "../../../../src/features/agent-chat/agent-capabilities-service";
import type {
	ModeDescriptor,
	ModelDescriptor,
} from "../../../../src/features/agent-chat/types";

type TelemetrySink = ReturnType<typeof vi.fn>;

function createService(options: {
	reported?: AgentInitializeCapabilities;
	catalogCapabilities?: {
		modes: readonly ModeDescriptor[];
		models: readonly ModelDescriptor[];
		acceptsFollowUp: boolean;
	};
	telemetry?: TelemetrySink;
}): AgentCapabilitiesService {
	const reader: AgentInitializeCapabilitiesReader = {
		getInitializeCapabilities: (_id: string) => options.reported,
	};
	const lookup: CatalogLookup = {
		lookup: (_id: string) =>
			options.catalogCapabilities
				? {
						id: "test-agent",
						capabilities: {
							modes: [...options.catalogCapabilities.modes],
							models: [...options.catalogCapabilities.models],
							acceptsFollowUp: options.catalogCapabilities.acceptsFollowUp,
						},
					}
				: undefined,
	};
	return new AgentCapabilitiesService({
		reader,
		catalog: lookup,
		telemetry: options.telemetry ?? vi.fn(),
	});
}

describe("humanize()", () => {
	it.each([
		["plan", "Plan"],
		["gpt-4o", "Gpt 4o"],
		["claude_3_opus", "Claude 3 Opus"],
		["", ""],
		["CODE", "Code"],
	])("humanize(%p) === %p", (input, expected) => {
		expect(humanize(input)).toBe(expected);
	});
});

describe("AgentCapabilitiesService.resolve()", () => {
	let telemetry: TelemetrySink;

	beforeEach(() => {
		telemetry = vi.fn();
	});

	it("agent reports only modes => source: agent, modes populated, models empty, follow-up default true", () => {
		const service = createService({
			reported: {
				modes: [{ id: "code", displayName: "Code" }],
			},
			telemetry,
		});
		const result = service.resolve("test-agent");
		expect(result).toStrictEqual({
			source: "agent",
			modes: [{ id: "code", displayName: "Code", promptPrefix: undefined }],
			models: [],
			acceptsFollowUp: true,
		});
	});

	it("agent reports only models => source: agent, models populated, modes empty", () => {
		const service = createService({
			reported: {
				models: [{ id: "gpt-4o" }],
			},
			telemetry,
		});
		const result = service.resolve("test-agent");
		expect(result).toStrictEqual({
			source: "agent",
			modes: [],
			models: [
				{
					id: "gpt-4o",
					displayName: "Gpt 4o",
					invocation: "initial-prompt",
					invocationTemplate: undefined,
				},
			],
			acceptsFollowUp: true,
		});
	});

	it("agent reports acceptsFollowUp=false without modes/models => source: agent", () => {
		const service = createService({
			reported: { acceptsFollowUp: false },
			telemetry,
		});
		const result = service.resolve("test-agent");
		expect(result).toStrictEqual({
			source: "agent",
			modes: [],
			models: [],
			acceptsFollowUp: false,
		});
	});

	it("agent silent + catalog populated => source: catalog", () => {
		const service = createService({
			catalogCapabilities: {
				modes: [{ id: "plan", displayName: "Plan" }],
				models: [
					{
						id: "sonnet",
						displayName: "Sonnet",
						invocation: "cli-flag",
						invocationTemplate: "--model {id}",
					},
				],
				acceptsFollowUp: true,
			},
			telemetry,
		});
		const result = service.resolve("test-agent");
		expect(result).toStrictEqual({
			source: "catalog",
			modes: [{ id: "plan", displayName: "Plan" }],
			models: [
				{
					id: "sonnet",
					displayName: "Sonnet",
					invocation: "cli-flag",
					invocationTemplate: "--model {id}",
				},
			],
			acceptsFollowUp: true,
		});
	});

	it("agent silent + catalog entry without capabilities => source: none", () => {
		const reader: AgentInitializeCapabilitiesReader = {
			// The resolver contract models "agent reports nothing" via a missing
			// return value. We simulate that path by returning the shape-equivalent
			// `{}`, which `hasAgentSignal` MUST treat as silent.
			getInitializeCapabilities: () => ({}) as AgentInitializeCapabilities,
		};
		const lookup: CatalogLookup = {
			lookup: () => ({ id: "test-agent" }),
		};
		const service = new AgentCapabilitiesService({
			reader,
			catalog: lookup,
			telemetry,
		});
		expect(service.resolve("test-agent")).toStrictEqual({ source: "none" });
	});

	it("agent silent + no catalog entry => source: none", () => {
		const service = createService({ telemetry });
		expect(service.resolve("unknown")).toStrictEqual({ source: "none" });
	});

	it("agent reports modes that conflict with catalog => agent wins (FR-011b)", () => {
		const service = createService({
			reported: {
				modes: [{ id: "code" }],
			},
			catalogCapabilities: {
				modes: [{ id: "plan", displayName: "Plan" }],
				models: [],
				acceptsFollowUp: true,
			},
			telemetry,
		});
		const result = service.resolve("test-agent");
		expect(result.source).toBe("agent");
		if (result.source === "agent") {
			expect(result.modes.map((m) => m.id)).toEqual(["code"]);
		}
	});

	it("normalization drops invalid ids (empty, non-string)", () => {
		const service = createService({
			reported: {
				modes: [
					{ id: "code" },
					{ id: "" },
					{ id: null as unknown as string },
					{ id: 42 as unknown as string },
				],
			},
			telemetry,
		});
		const result = service.resolve("test-agent");
		expect(result.source).toBe("agent");
		if (result.source === "agent") {
			expect(result.modes.map((m) => m.id)).toEqual(["code"]);
		}
	});

	it("normalization de-duplicates ids (keeping first)", () => {
		const service = createService({
			reported: {
				modes: [
					{ id: "code", displayName: "First" },
					{ id: "code", displayName: "Second" },
				],
			},
			telemetry,
		});
		const result = service.resolve("test-agent");
		expect(result.source).toBe("agent");
		if (result.source === "agent") {
			expect(result.modes).toHaveLength(1);
			expect(result.modes[0].displayName).toBe("First");
		}
	});

	it("fills displayName from humanize() when missing", () => {
		const service = createService({
			reported: {
				modes: [{ id: "ask_mode" }],
			},
			telemetry,
		});
		const result = service.resolve("test-agent");
		expect(result.source).toBe("agent");
		if (result.source === "agent") {
			expect(result.modes[0].displayName).toBe("Ask Mode");
		}
	});

	it("fills model invocation default to 'initial-prompt' when missing", () => {
		const service = createService({
			reported: {
				models: [{ id: "gpt-4o" }],
			},
			telemetry,
		});
		const result = service.resolve("test-agent");
		expect(result.source).toBe("agent");
		if (result.source === "agent") {
			expect(result.models[0].invocation).toBe("initial-prompt");
		}
	});

	it("inherits catalog acceptsFollowUp when agent reports modes but not the flag", () => {
		const service = createService({
			reported: { modes: [{ id: "code" }] },
			catalogCapabilities: {
				modes: [],
				models: [],
				acceptsFollowUp: false,
			},
			telemetry,
		});
		const result = service.resolve("test-agent");
		expect(result.source).toBe("agent");
		if (result.source === "agent") {
			expect(result.acceptsFollowUp).toBe(false);
		}
	});

	it("emits agent-chat.capabilities.resolved telemetry", () => {
		const service = createService({
			reported: {
				modes: [{ id: "code" }],
				models: [{ id: "gpt-4o" }],
				acceptsFollowUp: false,
			},
			telemetry,
		});
		service.resolve("test-agent");
		expect(telemetry).toHaveBeenCalledWith("agent-chat.capabilities.resolved", {
			agentId: "test-agent",
			source: "agent",
			modeCount: 1,
			modelCount: 1,
			acceptsFollowUp: "false",
		});
	});

	it("emits acceptsFollowUp: 'n/a' when source is none", () => {
		const service = createService({ telemetry });
		service.resolve("unknown");
		expect(telemetry).toHaveBeenCalledWith("agent-chat.capabilities.resolved", {
			agentId: "unknown",
			source: "none",
			modeCount: 0,
			modelCount: 0,
			acceptsFollowUp: "n/a",
		});
	});
});
