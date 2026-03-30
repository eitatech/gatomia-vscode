/**
 * Devin Adapter Tests
 *
 * Tests for the Devin adapter credential lifecycle, session management,
 * status mapping, and dispatch.
 *
 * @see specs/016-multi-provider-agents/contracts/provider-adapter.md
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { DevinAdapter } from "../../../../../src/features/cloud-agents/adapters/devin-adapter";

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
// DevinAdapter - Metadata
// ============================================================================

describe("DevinAdapter", () => {
	describe("metadata", () => {
		it("should have correct provider ID", () => {
			const secrets = createMockSecretStorage();
			const adapter = new DevinAdapter(secrets);
			expect(adapter.metadata.id).toBe("devin");
		});

		it("should have a display name", () => {
			const secrets = createMockSecretStorage();
			const adapter = new DevinAdapter(secrets);
			expect(adapter.metadata.displayName).toBe("Devin");
		});

		it("should have a description", () => {
			const secrets = createMockSecretStorage();
			const adapter = new DevinAdapter(secrets);
			expect(adapter.metadata.description).toBeTruthy();
		});

		it("should have an icon", () => {
			const secrets = createMockSecretStorage();
			const adapter = new DevinAdapter(secrets);
			expect(adapter.metadata.icon).toBeTruthy();
		});
	});

	// ========================================================================
	// Credential Lifecycle (T020)
	// ========================================================================

	describe("credential lifecycle", () => {
		let secrets: ReturnType<typeof createMockSecretStorage>;
		let adapter: DevinAdapter;

		beforeEach(() => {
			secrets = createMockSecretStorage();
			adapter = new DevinAdapter(secrets);
		});

		it("should return false when no credentials are stored", async () => {
			expect(await adapter.hasCredentials()).toBe(false);
		});

		it("should return true when credentials exist", async () => {
			secrets = createMockSecretStorage({
				"gatomia.devin.apiToken": "apk_test123",
			});
			adapter = new DevinAdapter(secrets);
			expect(await adapter.hasCredentials()).toBe(true);
		});

		it("should store credentials via configureCredentials", async () => {
			// Mock the VS Code input box to return a token
			const { window } = await import("vscode");
			(window.showInputBox as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
				"apk_test_token_123"
			);

			const result = await adapter.configureCredentials();
			expect(result).toBe(true);
			expect(secrets.store).toHaveBeenCalledWith(
				"gatomia.devin.apiToken",
				"apk_test_token_123"
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
		let adapter: DevinAdapter;

		beforeEach(() => {
			adapter = new DevinAdapter(createMockSecretStorage());
		});

		it("should return human-readable status display", () => {
			const session = {
				localId: "s1",
				providerId: "devin",
				providerSessionId: "ext-1",
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
				providerId: "devin",
				providerSessionId: "ext-1",
				status: "running" as const,
				branch: "main",
				specPath: "/spec.md",
				tasks: [],
				pullRequests: [],
				createdAt: Date.now(),
				updatedAt: Date.now(),
				completedAt: undefined,
				isReadOnly: false,
				externalUrl: "https://app.devin.ai/sessions/123",
			};
			expect(adapter.getExternalUrl(session)).toBe(
				"https://app.devin.ai/sessions/123"
			);
		});

		it("should return openUrl action for blocked session with external URL", () => {
			const session = {
				localId: "s1",
				providerId: "devin",
				providerSessionId: "ext-1",
				status: "blocked" as const,
				branch: "main",
				specPath: "/spec.md",
				tasks: [],
				pullRequests: [],
				createdAt: Date.now(),
				updatedAt: Date.now(),
				completedAt: undefined,
				isReadOnly: false,
				externalUrl: "https://app.devin.ai/sessions/123",
			};
			const action = adapter.handleBlockedSession(session);
			expect(action).toEqual({
				type: "openUrl",
				url: "https://app.devin.ai/sessions/123",
			});
		});

		it("should return null for blocked session without external URL", () => {
			const session = {
				localId: "s1",
				providerId: "devin",
				providerSessionId: "ext-1",
				status: "blocked" as const,
				branch: "main",
				specPath: "/spec.md",
				tasks: [],
				pullRequests: [],
				createdAt: Date.now(),
				updatedAt: Date.now(),
				completedAt: undefined,
				isReadOnly: false,
			};
			expect(adapter.handleBlockedSession(session)).toBeNull();
		});

		it("should resolve pollSessions with empty array (stub)", async () => {
			const result = await adapter.pollSessions([]);
			expect(result).toEqual([]);
		});
	});

	// ========================================================================
	// Dispatch (T043)
	// ========================================================================

	describe("dispatch", () => {
		let adapter: DevinAdapter;

		beforeEach(() => {
			adapter = new DevinAdapter(createMockSecretStorage());
		});

		it("should create a session with pending status", async () => {
			const task = {
				id: "T-001",
				title: "Test task",
				description: "A test task description",
				priority: "high" as const,
			};
			const context = {
				branch: "main",
				specPath: "/specs/test/spec.md",
				workspaceUri: "file:///workspace",
			};

			const session = await adapter.createSession(task, context);
			expect(session.providerId).toBe("devin");
			expect(session.status).toBe("pending");
			expect(session.branch).toBe("main");
			expect(session.specPath).toBe("/specs/test/spec.md");
			expect(session.localId).toBeTruthy();
		});

		it("should include tasks in the created session", async () => {
			const task = {
				id: "T-002",
				title: "Another task",
				description: "desc",
				priority: "medium" as const,
			};
			const context = {
				branch: "feat",
				specPath: "/specs/test/spec.md",
				workspaceUri: "file:///workspace",
			};

			const session = await adapter.createSession(task, context);
			expect(session.tasks).toHaveLength(1);
			expect(session.tasks[0].specTaskId).toBe("T-002");
			expect(session.tasks[0].title).toBe("Another task");
		});
	});

	// ========================================================================
	// Cancel and Blocked-Session Handling (T053)
	// ========================================================================

	describe("cancel and blocked-session handling", () => {
		let adapter: DevinAdapter;

		beforeEach(() => {
			adapter = new DevinAdapter(createMockSecretStorage());
		});

		it("should cancel a session by updating its status", async () => {
			const task = {
				id: "T-001",
				title: "Test",
				description: "desc",
				priority: "high" as const,
			};
			const ctx = {
				branch: "main",
				specPath: "/spec.md",
				workspaceUri: "file:///ws",
			};
			const session = await adapter.createSession(task, ctx);

			// cancelSession should resolve without error
			await expect(
				adapter.cancelSession(session.localId)
			).resolves.not.toThrow();
		});

		it("should return openUrl action for blocked session with URL", () => {
			const session = {
				localId: "s1",
				providerId: "devin",
				providerSessionId: "ext-1",
				status: "blocked" as const,
				branch: "main",
				specPath: "/spec.md",
				tasks: [],
				pullRequests: [],
				createdAt: Date.now(),
				updatedAt: Date.now(),
				completedAt: undefined,
				isReadOnly: false,
				externalUrl: "https://app.devin.ai/sessions/123",
			};
			const action = adapter.handleBlockedSession(session);
			expect(action).toEqual({
				type: "openUrl",
				url: "https://app.devin.ai/sessions/123",
			});
		});

		it("should return null for blocked session without URL", () => {
			const session = {
				localId: "s1",
				providerId: "devin",
				providerSessionId: "ext-1",
				status: "blocked" as const,
				branch: "main",
				specPath: "/spec.md",
				tasks: [],
				pullRequests: [],
				createdAt: Date.now(),
				updatedAt: Date.now(),
				completedAt: undefined,
				isReadOnly: false,
			};
			expect(adapter.handleBlockedSession(session)).toBeNull();
		});
	});
});
