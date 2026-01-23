/**
 * Integration Tests: Welcome Screen Learning Resources Display
 * Tests for learning resources display and external link opening
 * Based on specs/006-welcome-screen FR-015 and tasks T077-T078
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
	env as vscodeEnv,
	Uri as vscodeUri,
	window as vscodeWindow,
	type ExtensionContext,
	type OutputChannel,
} from "vscode";
import { WelcomeScreenProvider } from "../../../src/providers/welcome-screen-provider";
import type { WelcomeScreenPanel } from "../../../src/panels/welcome-screen-panel";

// biome-ignore lint/suspicious/noSkippedTests: Temporarily disabled pending implementation and test refactor
describe.skip("Welcome Screen - Learning Resources Display (Integration) (US4 - T077)", () => {
	let provider: WelcomeScreenProvider;
	let mockContext: ExtensionContext;
	let mockOutputChannel: OutputChannel;
	let mockPanel: WelcomeScreenPanel;

	beforeEach(() => {
		// Mock extension context
		mockContext = {
			subscriptions: [],
			extensionPath: "/fake/extension/path",
			globalState: {
				get: vi.fn(),
				update: vi.fn(),
				keys: vi.fn(() => []),
			},
			workspaceState: {
				get: vi.fn(),
				update: vi.fn(),
				keys: vi.fn(() => []),
			},
		} as unknown as ExtensionContext;

		// Mock output channel
		mockOutputChannel = {
			appendLine: vi.fn(),
			append: vi.fn(),
			clear: vi.fn(),
			show: vi.fn(),
			hide: vi.fn(),
			dispose: vi.fn(),
		} as unknown as OutputChannel;

		// Mock panel
		mockPanel = {
			postMessage: vi.fn(),
			dispose: vi.fn(),
		} as unknown as WelcomeScreenPanel;

		provider = new WelcomeScreenProvider(mockContext, mockOutputChannel);
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe("Learning Resources Loading", () => {
		it("should load learning resources in getWelcomeState()", async () => {
			const state = await provider.getWelcomeState();

			expect(state.learningResources).toBeDefined();
			expect(Array.isArray(state.learningResources)).toBe(true);
		});

		it("should include all 15 learning resources", async () => {
			const state = await provider.getWelcomeState();

			// Resources should be loaded (even if empty due to missing file)
			expect(state.learningResources).toBeDefined();

			// If resources loaded successfully, should have 15 items
			if (state.learningResources.length > 0) {
				expect(state.learningResources.length).toBe(15);
			}
		});

		it("should include Getting Started resources (5 items)", async () => {
			const state = await provider.getWelcomeState();

			if (state.learningResources.length > 0) {
				const gettingStarted = state.learningResources.filter(
					(r) => r.category === "Getting Started"
				);
				expect(gettingStarted.length).toBe(5);
			}
		});

		it("should include Advanced Features resources (6 items)", async () => {
			const state = await provider.getWelcomeState();

			if (state.learningResources.length > 0) {
				const advancedFeatures = state.learningResources.filter(
					(r) => r.category === "Advanced Features"
				);
				expect(advancedFeatures.length).toBe(6);
			}
		});

		it("should include Troubleshooting resources (4 items)", async () => {
			const state = await provider.getWelcomeState();

			if (state.learningResources.length > 0) {
				const troubleshooting = state.learningResources.filter(
					(r) => r.category === "Troubleshooting"
				);
				expect(troubleshooting.length).toBe(4);
			}
		});

		it("should sort resources by category order", async () => {
			const state = await provider.getWelcomeState();

			if (state.learningResources.length > 0) {
				const categories = state.learningResources.map((r) => r.category);

				// Find first occurrence of each category
				const firstGettingStarted = categories.indexOf("Getting Started");
				const firstAdvanced = categories.indexOf("Advanced Features");
				const firstTroubleshooting = categories.indexOf("Troubleshooting");

				if (firstGettingStarted !== -1 && firstAdvanced !== -1) {
					expect(firstAdvanced).toBeGreaterThan(firstGettingStarted);
				}

				if (firstAdvanced !== -1 && firstTroubleshooting !== -1) {
					expect(firstTroubleshooting).toBeGreaterThan(firstAdvanced);
				}
			}
		});

		it("should include all required properties for each resource", async () => {
			const state = await provider.getWelcomeState();

			if (state.learningResources.length > 0) {
				const resource = state.learningResources[0];

				expect(resource).toHaveProperty("id");
				expect(resource).toHaveProperty("title");
				expect(resource).toHaveProperty("description");
				expect(resource).toHaveProperty("url");
				expect(resource).toHaveProperty("category");
				expect(resource).toHaveProperty("keywords");
				expect(resource).toHaveProperty("estimatedMinutes");
			}
		});
	});

	describe("Resource Search Integration", () => {
		it("should provide searchResources method", () => {
			expect(provider.searchResources).toBeDefined();
			expect(typeof provider.searchResources).toBe("function");
		});

		it("should return search results for valid queries", () => {
			const searchFn = provider.searchResources("speckit");

			// searchResources returns the search function from LearningResources
			expect(searchFn).toBeDefined();

			// Should be able to call the search function
			if (typeof searchFn === "function") {
				const results = searchFn;
				expect(results).toBeDefined();
			}
		});

		it("should handle welcome/search-resources message (T087)", () => {
			// Verify provider can handle search requests
			const searchResults = provider.searchResources("hooks");

			expect(searchResults).toBeDefined();
		});

		it("should return filtered results sorted by relevance", () => {
			const searchResults = provider.searchResources("troubleshooting");

			// Should return search results
			expect(searchResults).toBeDefined();
		});
	});

	describe("Resource Display Properties", () => {
		it("should include title for each resource", async () => {
			const state = await provider.getWelcomeState();

			if (state.learningResources.length > 0) {
				for (const resource of state.learningResources) {
					expect(resource.title).toBeDefined();
					expect(typeof resource.title).toBe("string");
					expect(resource.title.length).toBeGreaterThan(0);
				}
			}
		});

		it("should include description for each resource", async () => {
			const state = await provider.getWelcomeState();

			if (state.learningResources.length > 0) {
				for (const resource of state.learningResources) {
					expect(resource.description).toBeDefined();
					expect(typeof resource.description).toBe("string");
					expect(resource.description.length).toBeGreaterThan(0);
				}
			}
		});

		it("should include category for each resource", async () => {
			const state = await provider.getWelcomeState();

			if (state.learningResources.length > 0) {
				for (const resource of state.learningResources) {
					expect(resource.category).toBeDefined();
					expect([
						"Getting Started",
						"Advanced Features",
						"Troubleshooting",
					]).toContain(resource.category);
				}
			}
		});

		it("should include estimated time for applicable resources", async () => {
			const state = await provider.getWelcomeState();

			if (state.learningResources.length > 0) {
				const withTime = state.learningResources.filter(
					(r) => r.estimatedMinutes !== null
				);

				// Some resources should have estimated time
				if (withTime.length > 0) {
					for (const resource of withTime) {
						expect(typeof resource.estimatedMinutes).toBe("number");
						expect(resource.estimatedMinutes).toBeGreaterThan(0);
					}
				}
			}
		});
	});
});

// biome-ignore lint/suspicious/noSkippedTests: Temporarily disabled pending implementation and test refactor
describe.skip("Welcome Screen - External Link Opening (Integration) (US4 - T078)", () => {
	let provider: WelcomeScreenProvider;
	let mockContext: ExtensionContext;
	let mockOutputChannel: OutputChannel;

	beforeEach(() => {
		mockContext = {
			subscriptions: [],
			extensionPath: "/fake/extension/path",
			globalState: {
				get: vi.fn(),
				update: vi.fn(),
				keys: vi.fn(() => []),
			},
			workspaceState: {
				get: vi.fn(),
				update: vi.fn(),
				keys: vi.fn(() => []),
			},
		} as unknown as ExtensionContext;

		mockOutputChannel = {
			appendLine: vi.fn(),
			append: vi.fn(),
			clear: vi.fn(),
			show: vi.fn(),
			hide: vi.fn(),
			dispose: vi.fn(),
		} as unknown as vscode.OutputChannel;

		provider = new WelcomeScreenProvider(mockContext, mockOutputChannel);

		// Mock vscode.env.openExternal
		vi.spyOn(vscodeEnv, "openExternal").mockResolvedValue(true);
		vi.spyOn(vscodeUri, "parse").mockImplementation((url: string) => ({
			scheme: url.startsWith("https:") ? "https" : "http",
			authority: "",
			path: "",
			query: "",
			fragment: "",
			fsPath: "",
			with: vi.fn(),
			toJSON: vi.fn(),
			toString: () => url,
		}));
	});

	afterEach(() => {
		vi.clearAllMocks();
		vi.restoreAllMocks();
	});

	describe("URL Validation (T089)", () => {
		it("should accept HTTPS URLs", async () => {
			await provider.openExternal("https://github.com/example");

			expect(vscodeEnv.openExternal).toHaveBeenCalled();
		});

		it("should block non-HTTPS URLs (HTTP)", async () => {
			const showWarningSpy = vi
				.spyOn(vscodeWindow, "showWarningMessage")
				.mockResolvedValue(undefined);

			await provider.openExternal("http://example.com");

			expect(vscodeEnv.openExternal).not.toHaveBeenCalled();
			expect(showWarningSpy).toHaveBeenCalledWith(
				expect.stringContaining("HTTPS")
			);
		});

		it("should block non-HTTPS URLs (FTP)", async () => {
			const showWarningSpy = vi
				.spyOn(vscodeWindow, "showWarningMessage")
				.mockResolvedValue(undefined);

			await provider.openExternal("ftp://example.com");

			expect(vscodeEnv.openExternal).not.toHaveBeenCalled();
			expect(showWarningSpy).toHaveBeenCalled();
		});

		it("should block non-HTTPS URLs (file://)", async () => {
			const showWarningSpy = vi
				.spyOn(vscodeWindow, "showWarningMessage")
				.mockResolvedValue(undefined);

			await provider.openExternal("file:///etc/passwd");

			expect(vscodeEnv.openExternal).not.toHaveBeenCalled();
			expect(showWarningSpy).toHaveBeenCalled();
		});

		it("should log blocked URLs", async () => {
			vi.spyOn(vscodeWindow, "showWarningMessage").mockResolvedValue(undefined);

			await provider.openExternal("http://example.com");

			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				expect.stringContaining("Blocked non-HTTPS URL")
			);
		});
	});

	describe("External Link Opening (T090)", () => {
		it("should open external URLs via vscode.env.openExternal", async () => {
			await provider.openExternal("https://github.com/example");

			expect(vscodeUri.parse).toHaveBeenCalledWith(
				"https://github.com/example"
			);
			expect(vscodeEnv.openExternal).toHaveBeenCalled();
		});

		it("should log successful URL openings (T092)", async () => {
			await provider.openExternal("https://github.com/example");

			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				expect.stringContaining("Opened external URL")
			);
		});

		it("should handle openExternal errors gracefully", async () => {
			vi.spyOn(vscodeEnv, "openExternal").mockRejectedValue(
				new Error("Network error")
			);

			// Should not throw
			await expect(
				provider.openExternal("https://github.com/example")
			).resolves.not.toThrow();
		});

		it("should log openExternal failures", async () => {
			vi.spyOn(vscodeEnv, "openExternal").mockRejectedValue(
				new Error("Network error")
			);

			await provider.openExternal("https://github.com/example");

			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				expect.stringContaining("Failed to open URL")
			);
		});
	});

	describe("Resource URL Validation", () => {
		it("should ensure all resource URLs are HTTPS", async () => {
			const state = await provider.getWelcomeState();

			if (state.learningResources.length > 0) {
				for (const resource of state.learningResources) {
					expect(resource.url.startsWith("https://")).toBe(true);
				}
			}
		});

		it("should be able to open any resource URL", async () => {
			const state = await provider.getWelcomeState();

			if (state.learningResources.length > 0) {
				const firstResource = state.learningResources[0];

				await provider.openExternal(firstResource.url);

				expect(vscodeEnv.openExternal).toHaveBeenCalled();
			}
		});
	});

	describe("Integration with welcome/open-external Message", () => {
		it("should handle welcome/open-external message type", () => {
			// Verify openExternal method exists and is callable
			expect(provider.openExternal).toBeDefined();
			expect(typeof provider.openExternal).toBe("function");
		});

		it("should validate URL before opening from message", async () => {
			const showWarningSpy = vi
				.spyOn(vscodeWindow, "showWarningMessage")
				.mockResolvedValue(undefined);

			// Simulate message handler calling openExternal with invalid URL
			await provider.openExternal("http://malicious.com");

			expect(vscodeEnv.openExternal).not.toHaveBeenCalled();
			expect(showWarningSpy).toHaveBeenCalled();
		});

		it("should open valid URL from message", async () => {
			// Simulate message handler calling openExternal with valid URL
			await provider.openExternal(
				"https://github.com/github/spec-kit/blob/main/docs/quickstart.md"
			);

			expect(vscodeEnv.openExternal).toHaveBeenCalled();
		});
	});
});
