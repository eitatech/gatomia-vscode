import { describe, it, expect, beforeEach, vi } from "vitest";
import { DevinCredentialsManager } from "../../../src/features/devin/devin-credentials-manager";
import { DevinSessionStorage } from "../../../src/features/devin/devin-session-storage";
import { createDevinApiClient } from "../../../src/features/devin/devin-api-client-factory";
import { SessionStatus, TaskStatus } from "../../../src/features/devin/types";

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function createMockSecretStorage() {
	const store = new Map<string, string>();
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

function createMockMemento() {
	const store = new Map<string, unknown>();
	return {
		get: vi.fn(
			<T>(key: string, defaultValue?: T) =>
				(store.get(key) as T) ?? defaultValue
		),
		update: vi.fn((key: string, value: unknown) => {
			store.set(key, value);
			return Promise.resolve();
		}),
		keys: vi.fn(() => [...store.keys()]),
	};
}

function jsonResponse(data: object, status = 200): Response {
	return {
		ok: status >= 200 && status < 300,
		status,
		statusText: status === 200 ? "OK" : "Error",
		headers: new Headers(),
		json: () => Promise.resolve(data),
		text: () => Promise.resolve(JSON.stringify(data)),
	} as Response;
}

describe("Single Task Delegation Workflow (Integration)", () => {
	let credentialsManager: DevinCredentialsManager;
	let sessionStorage: DevinSessionStorage;

	beforeEach(() => {
		vi.clearAllMocks();
		const mockSecret = createMockSecretStorage();
		const mockMemento = createMockMemento();
		credentialsManager = new DevinCredentialsManager(mockSecret as any);
		sessionStorage = new DevinSessionStorage(mockMemento as any);
	});

	it("completes a full single-task delegation flow: store credentials, create session, persist", async () => {
		// Step 1: Store credentials
		const creds = await credentialsManager.store(
			"cog_integration_test_key",
			"org-integration"
		);
		expect(creds.apiVersion).toBe("v3");
		expect(creds.isValid).toBe(true);

		// Step 2: Create API client from stored credentials
		const client = createDevinApiClient({
			token: creds.apiKey,
			orgId: creds.orgId,
		});
		expect(client.apiVersion).toBe("v3");

		// Step 3: Mock Devin API response for session creation
		mockFetch.mockResolvedValueOnce(
			jsonResponse({
				session_id: "devin-integration-001",
				url: "https://app.devin.ai/sessions/devin-integration-001",
				status: "new",
				acus_consumed: 0,
				created_at: 1_700_000_000,
				updated_at: 1_700_000_000,
				pull_requests: [],
			})
		);

		// Step 4: Create session via API
		const response = await client.createSession({
			prompt: "Implement login form with email and password validation",
			title: "Task T001: Login Form",
			repos: [
				{
					url: "https://github.com/org/repo",
					branch: "feature/login",
				},
			],
			tags: ["gatomia", "spec-001"],
		});

		expect(response.sessionId).toBe("devin-integration-001");
		expect(response.status).toBe("new");

		// Step 5: Import session manager and create local session
		const { DevinSessionManager } = await import(
			"../../../src/features/devin/devin-session-manager"
		);

		// Re-mock fetch for the session manager's internal call
		mockFetch.mockResolvedValueOnce(
			jsonResponse({
				session_id: "devin-integration-002",
				url: "https://app.devin.ai/sessions/devin-integration-002",
				status: "new",
				acus_consumed: 0,
				created_at: 1_700_000_000,
				updated_at: 1_700_000_000,
				pull_requests: [],
			})
		);

		const manager = new DevinSessionManager(
			sessionStorage,
			credentialsManager,
			client
		);

		const session = await manager.startTask({
			specPath: "/workspace/specs/001/spec.md",
			taskId: "T001",
			title: "Implement login form",
			description:
				"Build a React login component with email and password fields",
			priority: "P1",
			branch: "feature/login",
			repoUrl: "https://github.com/org/repo",
		});

		// Verify session was created and stored
		expect(session.sessionId).toBe("devin-integration-002");
		expect(session.status).toBe(SessionStatus.INITIALIZING);
		expect(session.branch).toBe("feature/login");
		expect(session.tasks).toHaveLength(1);
		expect(session.tasks[0].title).toBe("Implement login form");
		expect(session.tasks[0].status).toBe(TaskStatus.QUEUED);

		// Verify session was persisted to storage
		const stored = sessionStorage.getAll();
		expect(stored).toHaveLength(1);
		expect(stored[0].localId).toBe(session.localId);
	});

	it("handles API authentication failure gracefully", async () => {
		await credentialsManager.store("cog_bad_key", "org-bad");

		const client = createDevinApiClient({
			token: "cog_bad_key",
			orgId: "org-bad",
		});

		// Mock 401 response
		mockFetch.mockResolvedValueOnce(jsonResponse({}, 401));

		const { DevinSessionManager } = await import(
			"../../../src/features/devin/devin-session-manager"
		);
		const manager = new DevinSessionManager(
			sessionStorage,
			credentialsManager,
			client
		);

		await expect(
			manager.startTask({
				specPath: "/workspace/specs/001/spec.md",
				taskId: "T001",
				title: "Test task",
				description: "Test",
				priority: "P1",
				branch: "main",
				repoUrl: "https://github.com/org/repo",
			})
		).rejects.toThrow();

		// Session should not be stored on failure
		expect(sessionStorage.getAll()).toHaveLength(0);
	});
});
