/**
 * GitHub Copilot Adapter Tests
 *
 * Tests for the GitHub Copilot coding agent adapter credential lifecycle,
 * session management, status mapping, and dispatch.
 *
 * @see specs/016-multi-provider-agents/contracts/provider-adapter.md
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { GitHubCopilotAdapter } from "../../../../../src/features/cloud-agents/adapters/github-copilot-adapter";

const NOT_YET_IMPLEMENTED_PATTERN = /not yet implemented/;

// ============================================================================
// Helpers
// ============================================================================

function createMockSecretStorage(data: Record<string, string> = {}) {
	const store = new Map<string, string>(Object.entries(data));
	return {
		get: vi.fn((key: string) => Promise.resolve(store.get(key))),
		store: vi.fn((key: string, value: string) => {
			store.set(key, value);
			return Promise.resolve();
		}),
		delete: vi.fn((key: string) => {
			store.delete(key);
			return Promise.resolve();
		}),
		onDidChange: vi.fn(),
	};
}

// ============================================================================
// GitHubCopilotAdapter - Metadata
// ============================================================================

describe("GitHubCopilotAdapter", () => {
	describe("metadata", () => {
		it("should have correct provider ID", () => {
			const secrets = createMockSecretStorage();
			const adapter = new GitHubCopilotAdapter(secrets);
			expect(adapter.metadata.id).toBe("github-copilot");
		});

		it("should have a display name", () => {
			const secrets = createMockSecretStorage();
			const adapter = new GitHubCopilotAdapter(secrets);
			expect(adapter.metadata.displayName).toBe("GitHub Copilot");
		});

		it("should have a description", () => {
			const secrets = createMockSecretStorage();
			const adapter = new GitHubCopilotAdapter(secrets);
			expect(adapter.metadata.description).toBeTruthy();
		});

		it("should have an icon", () => {
			const secrets = createMockSecretStorage();
			const adapter = new GitHubCopilotAdapter(secrets);
			expect(adapter.metadata.icon).toBeTruthy();
		});
	});

	// ========================================================================
	// Credential Lifecycle (T021)
	// ========================================================================

	describe("credential lifecycle", () => {
		let secrets: ReturnType<typeof createMockSecretStorage>;
		let adapter: GitHubCopilotAdapter;

		beforeEach(() => {
			secrets = createMockSecretStorage();
			adapter = new GitHubCopilotAdapter(secrets);
		});

		it("should return false when no credentials are stored", async () => {
			expect(await adapter.hasCredentials()).toBe(false);
		});

		it("should return true when credentials exist", async () => {
			secrets = createMockSecretStorage({
				"gatomia.github-copilot.token": "ghp_test123",
			});
			adapter = new GitHubCopilotAdapter(secrets);
			expect(await adapter.hasCredentials()).toBe(true);
		});

		it("should store credentials via configureCredentials", async () => {
			const { window } = await import("vscode");
			(window.showInputBox as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
				"ghp_test_token_456"
			);

			const result = await adapter.configureCredentials();
			expect(result).toBe(true);
			expect(secrets.store).toHaveBeenCalledWith(
				"gatomia.github-copilot.token",
				"ghp_test_token_456"
			);
		});

		it("should return false when user cancels credential input", async () => {
			const { window } = await import("vscode");
			(window.showInputBox as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
				undefined
			);

			const result = await adapter.configureCredentials();
			expect(result).toBe(false);
		});
	});

	// ========================================================================
	// Status & Polling (T031)
	// ========================================================================

	describe("status display and polling", () => {
		let adapter: GitHubCopilotAdapter;

		beforeEach(() => {
			adapter = new GitHubCopilotAdapter(createMockSecretStorage());
		});

		it("should return human-readable status display", () => {
			const session = {
				localId: "s1",
				providerId: "github-copilot",
				providerSessionId: "issue-42",
				status: "running" as const,
				branch: "main",
				specPath: "/spec.md",
				tasks: [],
				pullRequests: [],
				createdAt: Date.now(),
				updatedAt: Date.now(),
				completedAt: undefined,
				isReadOnly: false,
			};
			const display = adapter.getStatusDisplay(session);
			expect(display).toBeTruthy();
			expect(typeof display).toBe("string");
		});

		it("should return external URL from session", () => {
			const session = {
				localId: "s1",
				providerId: "github-copilot",
				providerSessionId: "issue-42",
				status: "running" as const,
				branch: "main",
				specPath: "/spec.md",
				tasks: [],
				pullRequests: [],
				createdAt: Date.now(),
				updatedAt: Date.now(),
				completedAt: undefined,
				isReadOnly: false,
				externalUrl: "https://github.com/org/repo/issues/42",
			};
			expect(adapter.getExternalUrl(session)).toBe(
				"https://github.com/org/repo/issues/42"
			);
		});

		it("should return openUrl action for blocked session with external URL", () => {
			const session = {
				localId: "s1",
				providerId: "github-copilot",
				providerSessionId: "issue-42",
				status: "blocked" as const,
				branch: "main",
				specPath: "/spec.md",
				tasks: [],
				pullRequests: [],
				createdAt: Date.now(),
				updatedAt: Date.now(),
				completedAt: undefined,
				isReadOnly: false,
				externalUrl: "https://github.com/org/repo/issues/42",
			};
			const action = adapter.handleBlockedSession(session);
			expect(action).toEqual({
				type: "openUrl",
				url: "https://github.com/org/repo/issues/42",
			});
		});

		it("should resolve pollSessions with empty array (stub)", async () => {
			const result = await adapter.pollSessions([]);
			expect(result).toEqual([]);
		});
	});

	// ========================================================================
	// Dispatch (T044)
	// ========================================================================

	describe("dispatch", () => {
		let adapter: GitHubCopilotAdapter;

		beforeEach(() => {
			adapter = new GitHubCopilotAdapter(createMockSecretStorage());
		});

		it("should throw ProviderError indicating feature is not yet implemented", () => {
			const task = {
				id: "T-001",
				title: "Implement feature",
				description: "Build the feature",
				priority: "high" as const,
			};
			const context = {
				branch: "main",
				specPath: "/specs/test/spec.md",
				workspaceUri: "file:///workspace",
			};

			expect(() => adapter.createSession(task, context)).toThrow(
				NOT_YET_IMPLEMENTED_PATTERN
			);
		});
	});

	// ========================================================================
	// Cancel and Blocked-Session Handling (T054)
	// ========================================================================

	describe("cancel and blocked-session handling", () => {
		let adapter: GitHubCopilotAdapter;

		beforeEach(() => {
			adapter = new GitHubCopilotAdapter(createMockSecretStorage());
		});

		it("should cancel a session without error", async () => {
			await expect(
				adapter.cancelSession("some-local-id")
			).resolves.not.toThrow();
		});

		it("should return openUrl action for blocked session with URL", () => {
			const session = {
				localId: "s1",
				providerId: "github-copilot",
				providerSessionId: "issue-42",
				status: "blocked" as const,
				branch: "main",
				specPath: "/spec.md",
				tasks: [],
				pullRequests: [],
				createdAt: Date.now(),
				updatedAt: Date.now(),
				completedAt: undefined,
				isReadOnly: false,
				externalUrl: "https://github.com/org/repo/issues/42",
			};
			const action = adapter.handleBlockedSession(session);
			expect(action).toEqual({
				type: "openUrl",
				url: "https://github.com/org/repo/issues/42",
			});
		});
	});
});
