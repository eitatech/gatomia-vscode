/**
 * Unit Tests for HookViewProvider — Phase 8 known-agent handlers (T083)
 *
 * TDD: tests written BEFORE implementation.
 *
 * Covers:
 *   - handleACPKnownAgentsRequest → sends ACPKnownAgentsStatusMessage with all 7 agents
 *   - handleACPKnownAgentsToggle  → updates prefs then re-sends status
 *   - ACPAgentsAvailableMessage.source type accepts "known" and "custom"
 *
 * @feature 001-hooks-refactor Phase 8
 */

import {
	beforeEach,
	describe,
	expect,
	it,
	vi,
	type MockedObject,
} from "vitest";
import { HookViewProvider } from "../../../src/providers/hook-view-provider";
import type { HookManager } from "../../../src/features/hooks/hook-manager";
import type { HookExecutor } from "../../../src/features/hooks/hook-executor";
import type { IMCPDiscoveryService } from "../../../src/features/hooks/services/mcp-contracts";
import type { IModelCacheService } from "../../../src/features/hooks/services/model-cache-service";
import type { IAcpAgentDiscoveryService } from "../../../src/features/hooks/services/acp-agent-discovery-service";
import type { IKnownAgentPreferencesService } from "../../../src/features/hooks/services/known-agent-preferences-service";
import type { KnownAgentDetector } from "../../../src/features/hooks/services/known-agent-detector";
import type { KnownAgentId } from "../../../src/features/hooks/services/known-agent-catalog";
import type * as vscode from "vscode";

// ---------------------------------------------------------------------------
// Top-level regex constants (Constitution: no inline regex)
// ---------------------------------------------------------------------------
const KNOWN_AGENTS_STATUS_TYPE = "hooks/acp-known-agents-status";

// ---------------------------------------------------------------------------
// Helpers — minimal mocks
// ---------------------------------------------------------------------------

function makeMockWebview(): {
	postMessage: ReturnType<typeof vi.fn>;
	webview: vscode.Webview;
} {
	const postMessage = vi.fn().mockResolvedValue(undefined);
	const webview = { postMessage } as unknown as vscode.Webview;
	return { postMessage, webview };
}

function makeMockPanel(webview: vscode.Webview): vscode.WebviewPanel {
	return {
		webview,
		reveal: vi.fn(),
		dispose: vi.fn(),
		onDidDispose: vi.fn((cb: () => void) => {
			// Store so tests can trigger disposal
			return { dispose: vi.fn() };
		}),
		onDidChangeViewState: vi.fn(() => ({ dispose: vi.fn() })),
	} as unknown as vscode.WebviewPanel;
}

function makeMockContext(): vscode.ExtensionContext {
	return {
		extensionUri: { fsPath: "/fake" } as vscode.Uri,
		globalState: {
			get: vi.fn().mockReturnValue([]),
			update: vi.fn().mockResolvedValue(undefined),
			keys: vi.fn().mockReturnValue([]),
			setKeysForSync: vi.fn(),
		},
		subscriptions: [],
	} as unknown as vscode.ExtensionContext;
}

function makeMockHookManager(): MockedObject<HookManager> {
	return {
		getAllHooks: vi.fn().mockResolvedValue([]),
		createHook: vi.fn().mockResolvedValue(undefined),
		updateHook: vi.fn().mockResolvedValue(undefined),
		deleteHook: vi.fn().mockResolvedValue(undefined),
		getHook: vi.fn().mockReturnValue(undefined),
		onHooksChanged: vi.fn().mockReturnValue({ dispose: vi.fn() }),
		dispose: vi.fn(),
		exportHooks: vi.fn().mockReturnValue("[]"),
	} as unknown as MockedObject<HookManager>;
}

function makeMockHookExecutor(): MockedObject<HookExecutor> {
	return {
		onExecutionStarted: vi.fn().mockReturnValue({ dispose: vi.fn() }),
		onExecutionCompleted: vi.fn().mockReturnValue({ dispose: vi.fn() }),
		onExecutionFailed: vi.fn().mockReturnValue({ dispose: vi.fn() }),
		getExecutionLogs: vi.fn().mockReturnValue([]),
		getExecutionLogsForHook: vi.fn().mockReturnValue([]),
		initialize: vi.fn(),
		dispose: vi.fn(),
	} as unknown as MockedObject<HookExecutor>;
}

function makeMockMCPDiscovery(): MockedObject<IMCPDiscoveryService> {
	return {
		discoverServers: vi.fn().mockResolvedValue([]),
	} as unknown as MockedObject<IMCPDiscoveryService>;
}

function makeMockModelCache(): MockedObject<IModelCacheService> {
	return {
		getAvailableModels: vi
			.fn()
			.mockResolvedValue({ models: [], isStale: false }),
		dispose: vi.fn(),
	} as unknown as MockedObject<IModelCacheService>;
}

function makeMockAcpDiscovery(): MockedObject<IAcpAgentDiscoveryService> {
	return {
		discoverAgents: vi.fn().mockResolvedValue([]),
	} as unknown as MockedObject<IAcpAgentDiscoveryService>;
}

function makeMockPrefs(): MockedObject<IKnownAgentPreferencesService> {
	let enabled: KnownAgentId[] = [];
	return {
		getEnabledAgents: vi.fn().mockImplementation(() => enabled),
		setEnabledAgents: vi.fn().mockImplementation((ids: KnownAgentId[]) => {
			enabled = ids;
			return Promise.resolve();
		}),
		toggleAgent: vi.fn().mockImplementation((id: KnownAgentId, on: boolean) => {
			if (on) {
				if (!enabled.includes(id)) {
					enabled = [...enabled, id];
				}
			} else {
				enabled = enabled.filter((a) => a !== id);
			}
			return Promise.resolve();
		}),
		isAgentEnabled: vi
			.fn()
			.mockImplementation((id: KnownAgentId) => enabled.includes(id)),
	} as unknown as MockedObject<IKnownAgentPreferencesService>;
}

function makeMockDetector(): MockedObject<KnownAgentDetector> {
	return {
		isInstalledAny: vi.fn().mockResolvedValue(false),
		preloadAll: vi.fn().mockResolvedValue(undefined),
	} as unknown as MockedObject<KnownAgentDetector>;
}

function makeOutputChannel(): vscode.OutputChannel {
	return {
		appendLine: vi.fn(),
		append: vi.fn(),
		clear: vi.fn(),
		show: vi.fn(),
		hide: vi.fn(),
		dispose: vi.fn(),
		name: "test",
		replace: vi.fn(),
	} as unknown as vscode.OutputChannel;
}

// ---------------------------------------------------------------------------
// Simulate sending a webview message to the provider
// ---------------------------------------------------------------------------

async function sendMessage(
	provider: HookViewProvider,
	message: Record<string, unknown>
): Promise<void> {
	// Access private method via cast to any
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	await (provider as any).handleWebviewMessage(message);
}

// Simulate marking webview as ready and set a mock webview
function markReady(provider: HookViewProvider, webview: vscode.Webview): void {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	(provider as any).isWebviewReady = true;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	(provider as any).panel = { webview } as unknown as vscode.WebviewPanel;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("HookViewProvider — Phase 8 known-agent handlers", () => {
	let provider: HookViewProvider;
	let mockPrefs: MockedObject<IKnownAgentPreferencesService>;
	let mockDetector: MockedObject<KnownAgentDetector>;
	let postMessage: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		const { postMessage: pm, webview } = makeMockWebview();
		postMessage = pm;

		mockPrefs = makeMockPrefs();
		mockDetector = makeMockDetector();

		provider = new HookViewProvider({
			context: makeMockContext(),
			hookManager: makeMockHookManager(),
			hookExecutor: makeMockHookExecutor(),
			mcpDiscoveryService: makeMockMCPDiscovery(),
			modelCacheService: makeMockModelCache(),
			acpAgentDiscoveryService: makeMockAcpDiscovery(),
			outputChannel: makeOutputChannel(),
			knownAgentPreferencesService: mockPrefs,
			knownAgentDetector: mockDetector,
		});

		markReady(provider, webview);
	});

	// -----------------------------------------------------------------------
	// hooks/acp-known-agents-request
	// -----------------------------------------------------------------------

	describe("hooks/acp-known-agents-request", () => {
		it("sends a hooks/acp-known-agents-status message", async () => {
			await sendMessage(provider, { type: "hooks/acp-known-agents-request" });

			expect(postMessage).toHaveBeenCalledWith(
				expect.objectContaining({ type: KNOWN_AGENTS_STATUS_TYPE })
			);
		});

		it("includes all 7 known agents in the response", async () => {
			await sendMessage(provider, { type: "hooks/acp-known-agents-request" });

			const call = postMessage.mock.calls.find(
				([msg]) => msg.type === KNOWN_AGENTS_STATUS_TYPE
			);
			expect(call).toBeDefined();
			const agents = call?.[0]?.agents as unknown[];
			expect(agents).toHaveLength(7);
		});

		it("marks each agent as not enabled by default (empty prefs)", async () => {
			await sendMessage(provider, { type: "hooks/acp-known-agents-request" });

			const call = postMessage.mock.calls.find(
				([msg]) => msg.type === KNOWN_AGENTS_STATUS_TYPE
			);
			const agents = call?.[0]?.agents as Array<{ enabled: boolean }>;
			expect(agents.every((a) => !a.enabled)).toBe(true);
		});

		it("marks an agent as enabled when it is in prefs", async () => {
			mockPrefs.getEnabledAgents.mockReturnValue(["gemini"]);
			mockPrefs.isAgentEnabled.mockImplementation((id) => id === "gemini");

			await sendMessage(provider, { type: "hooks/acp-known-agents-request" });

			const call = postMessage.mock.calls.find(
				([msg]) => msg.type === KNOWN_AGENTS_STATUS_TYPE
			);
			const agents = call?.[0]?.agents as Array<{
				id: string;
				enabled: boolean;
			}>;
			const gemini = agents.find((a) => a.id === "gemini");
			expect(gemini?.enabled).toBe(true);
		});

		it("marks agent as detected when detector returns true", async () => {
			mockDetector.isInstalledAny.mockResolvedValue(true);
			mockPrefs.getEnabledAgents.mockReturnValue(["opencode"]);
			mockPrefs.isAgentEnabled.mockImplementation((id) => id === "opencode");

			await sendMessage(provider, { type: "hooks/acp-known-agents-request" });

			const call = postMessage.mock.calls.find(
				([msg]) => msg.type === KNOWN_AGENTS_STATUS_TYPE
			);
			const agents = call?.[0]?.agents as Array<{
				id: string;
				isDetected: boolean;
			}>;
			const opencode = agents.find((a) => a.id === "opencode");
			expect(opencode?.isDetected).toBe(true);
		});

		it("includes non-null descriptor for agent that is enabled AND detected", async () => {
			mockDetector.isInstalledAny.mockResolvedValue(true);
			mockPrefs.getEnabledAgents.mockReturnValue(["opencode"]);
			mockPrefs.isAgentEnabled.mockImplementation((id) => id === "opencode");

			await sendMessage(provider, { type: "hooks/acp-known-agents-request" });

			const call = postMessage.mock.calls.find(
				([msg]) => msg.type === KNOWN_AGENTS_STATUS_TYPE
			);
			const agents = call?.[0]?.agents as Array<{
				id: string;
				descriptor: unknown;
			}>;
			const opencode = agents.find((a) => a.id === "opencode");
			expect(opencode?.descriptor).not.toBeNull();
		});

		it("includes null descriptor for agent that is enabled but NOT detected", async () => {
			mockDetector.isInstalledAny.mockResolvedValue(false);
			mockPrefs.getEnabledAgents.mockReturnValue(["gemini"]);

			await sendMessage(provider, { type: "hooks/acp-known-agents-request" });

			const call = postMessage.mock.calls.find(
				([msg]) => msg.type === KNOWN_AGENTS_STATUS_TYPE
			);
			const agents = call?.[0]?.agents as Array<{
				id: string;
				descriptor: unknown;
			}>;
			const gemini = agents.find((a) => a.id === "gemini");
			expect(gemini?.descriptor).toBeNull();
		});

		it("sends status even when no prefs/detector provided (graceful fallback)", async () => {
			// Provider without knownAgentPreferencesService / detector
			const minimalProvider = new HookViewProvider({
				context: makeMockContext(),
				hookManager: makeMockHookManager(),
				hookExecutor: makeMockHookExecutor(),
				mcpDiscoveryService: makeMockMCPDiscovery(),
				modelCacheService: makeMockModelCache(),
				acpAgentDiscoveryService: makeMockAcpDiscovery(),
				outputChannel: makeOutputChannel(),
			});

			const { postMessage: pm2, webview: wv2 } = makeMockWebview();
			markReady(minimalProvider, wv2);

			await expect(
				sendMessage(minimalProvider, { type: "hooks/acp-known-agents-request" })
			).resolves.not.toThrow();
			expect(pm2).toHaveBeenCalledWith(
				expect.objectContaining({ type: KNOWN_AGENTS_STATUS_TYPE })
			);
		});
	});

	// -----------------------------------------------------------------------
	// hooks/acp-known-agents-toggle
	// -----------------------------------------------------------------------

	describe("hooks/acp-known-agents-toggle", () => {
		it("calls toggleAgent on the prefs service", async () => {
			await sendMessage(provider, {
				type: "hooks/acp-known-agents-toggle",
				agentId: "gemini",
				enabled: true,
			});

			expect(mockPrefs.toggleAgent).toHaveBeenCalledWith("gemini", true);
		});

		it("sends a status update after toggling", async () => {
			await sendMessage(provider, {
				type: "hooks/acp-known-agents-toggle",
				agentId: "opencode",
				enabled: true,
			});

			const calls = postMessage.mock.calls.filter(
				([msg]) => msg.type === KNOWN_AGENTS_STATUS_TYPE
			);
			expect(calls.length).toBeGreaterThanOrEqual(1);
		});

		it("reflects the toggled agent as enabled in the subsequent status message", async () => {
			// After toggle, prefs will return ["gemini"]
			mockPrefs.getEnabledAgents.mockReturnValue(["gemini"]);

			await sendMessage(provider, {
				type: "hooks/acp-known-agents-toggle",
				agentId: "gemini",
				enabled: true,
			});

			const call = postMessage.mock.calls.find(
				([msg]) => msg.type === KNOWN_AGENTS_STATUS_TYPE
			);
			const agents = call?.[0]?.agents as Array<{
				id: string;
				enabled: boolean;
			}>;
			const gemini = agents.find((a) => a.id === "gemini");
			expect(gemini?.enabled).toBe(true);
		});

		it("does nothing fatal when no prefs service configured", async () => {
			const minimalProvider = new HookViewProvider({
				context: makeMockContext(),
				hookManager: makeMockHookManager(),
				hookExecutor: makeMockHookExecutor(),
				mcpDiscoveryService: makeMockMCPDiscovery(),
				modelCacheService: makeMockModelCache(),
				acpAgentDiscoveryService: makeMockAcpDiscovery(),
				outputChannel: makeOutputChannel(),
			});

			const { webview: wv2 } = makeMockWebview();
			markReady(minimalProvider, wv2);

			await expect(
				sendMessage(minimalProvider, {
					type: "hooks/acp-known-agents-toggle",
					agentId: "gemini",
					enabled: true,
				})
			).resolves.not.toThrow();
		});
	});

	// -----------------------------------------------------------------------
	// ACPAgentsAvailableMessage source type
	// -----------------------------------------------------------------------

	describe("ACPAgentsAvailableMessage source compatibility", () => {
		it("includes 'known' source agents in the acp-agents-available response", async () => {
			const mockAcpDiscovery = makeMockAcpDiscovery();
			mockAcpDiscovery.discoverAgents.mockResolvedValue([
				{
					agentCommand: "opencode acp",
					agentDisplayName: "OpenCode",
					source: "known",
					knownAgentId: "opencode",
				},
			]);

			const p2 = new HookViewProvider({
				context: makeMockContext(),
				hookManager: makeMockHookManager(),
				hookExecutor: makeMockHookExecutor(),
				mcpDiscoveryService: makeMockMCPDiscovery(),
				modelCacheService: makeMockModelCache(),
				acpAgentDiscoveryService: mockAcpDiscovery,
				outputChannel: makeOutputChannel(),
				knownAgentPreferencesService: mockPrefs,
				knownAgentDetector: mockDetector,
			});

			const { postMessage: pm2, webview: wv2 } = makeMockWebview();
			markReady(p2, wv2);

			await sendMessage(p2, { type: "hooks/acp-agents-request" });

			const call = pm2.mock.calls.find(
				([msg]) => msg.type === "hooks/acp-agents-available"
			);
			expect(call).toBeDefined();
			const agents = call?.[0]?.agents as Array<{ source: string }>;
			expect(agents.some((a) => a.source === "known")).toBe(true);
		});
	});
});
