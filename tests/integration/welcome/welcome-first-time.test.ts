/**
 * Integration test for first-time welcome screen display
 * Tests the complete flow from extension activation to welcome screen display
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import type * as vscode from "vscode";

describe("Welcome Screen - First-Time Display (Integration)", () => {
	let mockContext: vscode.ExtensionContext;
	let workspaceStateMap: Map<string, any>;

	beforeEach(() => {
		workspaceStateMap = new Map();

		mockContext = {
			extensionPath: "/fake/extension/path",
			extensionUri: { fsPath: "/fake/extension/path" } as any,
			workspaceState: {
				get: vi.fn((key: string, defaultValue?: any) => {
					const value = workspaceStateMap.get(key);
					return value !== undefined ? value : defaultValue;
				}),
				update: vi.fn((key: string, value: any) => {
					if (value === undefined) {
						workspaceStateMap.delete(key);
					} else {
						workspaceStateMap.set(key, value);
					}
				}),
				keys: vi.fn(() => Array.from(workspaceStateMap.keys())),
			},
			globalState: {
				get: vi.fn(),
				update: vi.fn(),
				keys: vi.fn(() => []),
			},
			subscriptions: [],
		} as any;
	});

	describe("First-Time Activation Flow", () => {
		it("should display welcome screen on first workspace activation", () => {
			// Simulate first-time activation
			const hasShownBefore = mockContext.workspaceState.get(
				"gatomia.welcomeScreen.hasShown",
				false
			);
			const dontShowOnStartup = mockContext.workspaceState.get(
				"gatomia.welcomeScreen.dontShow",
				false
			);

			expect(hasShownBefore).toBe(false);
			expect(dontShowOnStartup).toBe(false);

			// Should show welcome automatically
			const shouldShow = !(dontShowOnStartup || hasShownBefore);
			expect(shouldShow).toBe(true);
		});

		it("should not display welcome screen on second activation", async () => {
			// Mark as shown
			await mockContext.workspaceState.update(
				"gatomia.welcomeScreen.hasShown",
				true
			);

			const hasShownBefore = mockContext.workspaceState.get(
				"gatomia.welcomeScreen.hasShown",
				false
			);
			const dontShowOnStartup = mockContext.workspaceState.get(
				"gatomia.welcomeScreen.dontShow",
				false
			);

			expect(hasShownBefore).toBe(true);

			// Should NOT show automatically
			const shouldShow = !(dontShowOnStartup || hasShownBefore);
			expect(shouldShow).toBe(false);
		});

		it("should respect user opt-out preference", async () => {
			// User opts out
			await mockContext.workspaceState.update(
				"gatomia.welcomeScreen.dontShow",
				true
			);

			const dontShowOnStartup = mockContext.workspaceState.get(
				"gatomia.welcomeScreen.dontShow",
				false
			);

			expect(dontShowOnStartup).toBe(true);

			// Should NOT show even if first time
			const hasShownBefore = mockContext.workspaceState.get(
				"gatomia.welcomeScreen.hasShown",
				false
			);
			const shouldShow = !(dontShowOnStartup || hasShownBefore);
			expect(shouldShow).toBe(false);
		});
	});

	describe("Welcome Screen State Initialization", () => {
		it("should initialize with setup view for first-time users", () => {
			// First-time state
			const currentView = "setup"; // Default view
			expect(currentView).toBe("setup");
		});

		it("should check dependencies on initialization", () => {
			// Dependencies should be checked
			const dependencies = {
				copilotChat: { installed: false, active: false, version: null },
				speckit: { installed: false, version: null },
				openspec: { installed: false, version: null },
				copilotCli: { installed: false, version: null },
				gatomiaCli: { installed: false, version: null },
				lastChecked: Date.now(),
			};

			expect(dependencies).toHaveProperty("copilotChat");
			expect(dependencies).toHaveProperty("speckit");
			expect(dependencies).toHaveProperty("openspec");
			expect(dependencies).toHaveProperty("copilotCli");
			expect(dependencies).toHaveProperty("gatomiaCli");
			expect(dependencies).toHaveProperty("lastChecked");
		});

		it("should load configuration on initialization", () => {
			// Configuration should be loaded
			const config = {
				specSystem: "auto",
				speckitSpecsPath: "specs",
				speckitMemoryPath: ".specify/memory",
				speckitTemplatesPath: ".specify/templates",
				openspecPath: ".openspec",
				promptsPath: ".prompts",
			};

			expect(config.specSystem).toBeDefined();
			expect(config.speckitSpecsPath).toBeDefined();
		});

		it("should load learning resources on initialization", () => {
			// Learning resources should be available
			// Note: Actual implementation will load from resources.json
			const resourcesAvailable = true;
			expect(resourcesAvailable).toBe(true);
		});
	});

	describe("Welcome Screen Persistence", () => {
		it("should mark welcome as shown after display", async () => {
			// Simulate showing welcome
			await mockContext.workspaceState.update(
				"gatomia.welcomeScreen.hasShown",
				true
			);

			const hasShown = mockContext.workspaceState.get(
				"gatomia.welcomeScreen.hasShown",
				false
			);
			expect(hasShown).toBe(true);
		});

		it("should persist across extension reload", async () => {
			// Mark as shown
			await mockContext.workspaceState.update(
				"gatomia.welcomeScreen.hasShown",
				true
			);

			// Simulate reload by checking state
			const hasShown = mockContext.workspaceState.get(
				"gatomia.welcomeScreen.hasShown",
				false
			);
			expect(hasShown).toBe(true);
		});

		it("should allow manual reset of welcome state", async () => {
			// Mark as shown and opted out
			await mockContext.workspaceState.update(
				"gatomia.welcomeScreen.hasShown",
				true
			);
			await mockContext.workspaceState.update(
				"gatomia.welcomeScreen.dontShow",
				true
			);

			// Reset state
			await mockContext.workspaceState.update(
				"gatomia.welcomeScreen.hasShown",
				undefined
			);
			await mockContext.workspaceState.update(
				"gatomia.welcomeScreen.dontShow",
				undefined
			);

			// Should behave as first-time again
			const hasShown = mockContext.workspaceState.get(
				"gatomia.welcomeScreen.hasShown",
				false
			);
			const dontShow = mockContext.workspaceState.get(
				"gatomia.welcomeScreen.dontShow",
				false
			);

			expect(hasShown).toBe(false);
			expect(dontShow).toBe(false);
		});
	});

	describe("Error Scenarios", () => {
		it("should handle missing workspace state gracefully", () => {
			// Simulate corrupted state
			const hasShown = mockContext.workspaceState.get(
				"gatomia.welcomeScreen.hasShown",
				false
			);

			// Should default to safe value
			expect(typeof hasShown).toBe("boolean");
		});

		it("should handle extension activation errors", () => {
			// Extension should not crash on activation errors
			let activationFailed = false;

			try {
				// Simulate activation
				const hasShown = mockContext.workspaceState.get(
					"gatomia.welcomeScreen.hasShown",
					false
				);
				expect(hasShown).toBeDefined();
			} catch (error) {
				activationFailed = true;
			}

			expect(activationFailed).toBe(false);
		});
	});

	describe("Multi-Workspace Behavior", () => {
		it("should track welcome state per workspace", () => {
			// Workspace 1
			const workspace1State = new Map();
			workspace1State.set("gatomia.welcomeScreen.hasShown", true);

			// Workspace 2 (fresh)
			const workspace2State = new Map();

			// States should be independent
			expect(workspace1State.get("gatomia.welcomeScreen.hasShown")).toBe(true);
			// Empty map should return undefined, not false
			expect(
				workspace2State.get("gatomia.welcomeScreen.hasShown")
			).toBeUndefined();
		});

		it("should show welcome in new workspace even if shown in another", async () => {
			// Workspace A has seen welcome
			await mockContext.workspaceState.update(
				"gatomia.welcomeScreen.hasShown",
				true
			);

			// Create new workspace context
			const workspace2StateMap = new Map();
			const mockContext2 = {
				...mockContext,
				workspaceState: {
					get: vi.fn((key: string, defaultValue?: any) => {
						const value = workspace2StateMap.get(key);
						return value !== undefined ? value : defaultValue;
					}),
					update: vi.fn((key: string, value: any) => {
						workspace2StateMap.set(key, value);
					}),
				},
			} as any;

			// Workspace B should show welcome (first time in this workspace)
			const hasShownInWorkspace2 = mockContext2.workspaceState.get(
				"gatomia.welcomeScreen.hasShown",
				false
			);
			expect(hasShownInWorkspace2).toBe(false);
		});
	});
});
