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
import type { DevinApiClientInterface } from "../../../../../src/features/devin/devin-api-client";

const CREDENTIALS_NOT_CONFIGURED_PATTERN = /credentials not configured/i;

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

function createMockApiClient(
	overrides: Partial<DevinApiClientInterface> = {}
): DevinApiClientInterface {
	return {
		apiVersion: "v1" as const,
		createSession: vi.fn().mockResolvedValue({
			sessionId: "devin-session-123",
			url: "https://app.devin.ai/sessions/devin-session-123",
			status: "new",
			acusConsumed: 0,
			createdAt: Date.now(),
			updatedAt: Date.now(),
			pullRequests: [],
		}),
		getSession: vi.fn().mockResolvedValue({
			sessionId: "devin-session-123",
			url: "https://app.devin.ai/sessions/devin-session-123",
			status: "running",
			tags: [],
			createdAt: Date.now(),
			updatedAt: Date.now(),
			acusConsumed: 0,
			pullRequests: [],
			isArchived: false,
		}),
		listSessions: vi.fn().mockResolvedValue({
			sessions: [],
			pageInfo: { hasNextPage: false },
		}),
		validateCredentials: vi.fn().mockResolvedValue(true),
		...overrides,
	};
}

/**
 * Creates a mock secret storage pre-populated with valid DevinCredentialsManager data.
 * DevinCredentialsManager stores: apiKey under "gatomia.devin.apiKey" and
 * metadata JSON under "gatomia.devin.credentials".
 */
function createSeededSecretStorage() {
	return createMockSecretStorage({
		"gatomia.devin.apiKey": "apk_test123",
		"gatomia.devin.credentials": JSON.stringify({
			apiVersion: "v1",
			createdAt: Date.now(),
			isValid: true,
		}),
	});
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
			secrets = createSeededSecretStorage();
			adapter = new DevinAdapter(secrets);
			expect(await adapter.hasCredentials()).toBe(true);
		});

		it("should store credentials via configureCredentials", async () => {
			const { window } = await import("vscode");
			(window.showInputBox as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
				"apk_test_token_123"
			);

			const result = await adapter.configureCredentials();
			expect(result).toBe(true);
			expect(secrets.store).toHaveBeenCalledWith(
				"gatomia.devin.apiKey",
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

		it("should prompt for org ID when v3 token is provided", async () => {
			const { window } = await import("vscode");
			(window.showInputBox as ReturnType<typeof vi.fn>)
				.mockResolvedValueOnce("cog_test_v3_token")
				.mockResolvedValueOnce("org-12345");

			const result = await adapter.configureCredentials();
			expect(result).toBe(true);
			expect(secrets.store).toHaveBeenCalledWith(
				"gatomia.devin.apiKey",
				"cog_test_v3_token"
			);
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

		it("should resolve pollSessions with empty array when no sessions", async () => {
			const result = await adapter.pollSessions([]);
			expect(result).toEqual([]);
		});

		it("should poll the Devin API for session updates", async () => {
			const mockClient = createMockApiClient({
				getSession: vi.fn().mockResolvedValue({
					sessionId: "ext-1",
					url: "https://app.devin.ai/sessions/ext-1",
					status: "running",
					statusDetail: "working",
					tags: [],
					createdAt: Date.now(),
					updatedAt: Date.now(),
					acusConsumed: 1,
					pullRequests: [],
					isArchived: false,
				}),
			});
			const pollingAdapter = new DevinAdapter(
				createSeededSecretStorage(),
				mockClient
			);

			const sessions = [
				{
					localId: "s1",
					providerId: "devin",
					providerSessionId: "ext-1",
					status: "pending" as const,
					branch: "main",
					specPath: "/spec.md",
					tasks: [],
					pullRequests: [],
					createdAt: Date.now(),
					updatedAt: Date.now(),
					completedAt: undefined,
					isReadOnly: false,
				},
			];

			const updates = await pollingAdapter.pollSessions(sessions);
			expect(mockClient.getSession).toHaveBeenCalledWith("ext-1");
			expect(updates.length).toBe(1);
			expect(updates[0].status).toBe("running");
		});
	});

	// ========================================================================
	// Dispatch (T043)
	// ========================================================================

	describe("dispatch", () => {
		let adapter: DevinAdapter;
		let mockClient: DevinApiClientInterface;

		beforeEach(() => {
			mockClient = createMockApiClient();
			adapter = new DevinAdapter(createSeededSecretStorage(), mockClient);
		});

		it("should create a session via the Devin API with pending status", async () => {
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
			expect(mockClient.createSession).toHaveBeenCalled();
			expect(session.providerId).toBe("devin");
			expect(session.status).toBe("pending");
			expect(session.branch).toBe("main");
			expect(session.specPath).toBe("/specs/test/spec.md");
			expect(session.localId).toBeTruthy();
			expect(session.providerSessionId).toBe("devin-session-123");
			expect(session.externalUrl).toBe(
				"https://app.devin.ai/sessions/devin-session-123"
			);
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

		it("should throw ProviderError when no credentials configured", async () => {
			const noCredsAdapter = new DevinAdapter(createMockSecretStorage());
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

			await expect(noCredsAdapter.createSession(task, ctx)).rejects.toThrow(
				CREDENTIALS_NOT_CONFIGURED_PATTERN
			);
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

		it("should cancel a session without error", async () => {
			await expect(
				adapter.cancelSession("some-local-id")
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
