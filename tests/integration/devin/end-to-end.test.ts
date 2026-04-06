import { describe, it, expect, beforeEach, vi } from "vitest";
import { DevinSessionStorage } from "../../../src/features/devin/devin-session-storage";
import { DevinCredentialsManager } from "../../../src/features/devin/devin-credentials-manager";
import { createDevinApiClient } from "../../../src/features/devin/devin-api-client-factory";
import { DevinSessionManager } from "../../../src/features/devin/devin-session-manager";
import { DevinPollingService } from "../../../src/features/devin/devin-polling-service";
import { SessionStatus } from "../../../src/features/devin/types";

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

describe("End-to-End Devin Workflow", () => {
	let credentialsManager: DevinCredentialsManager;
	let sessionStorage: DevinSessionStorage;

	beforeEach(() => {
		vi.clearAllMocks();
		credentialsManager = new DevinCredentialsManager(
			createMockSecretStorage() as any
		);
		sessionStorage = new DevinSessionStorage(createMockMemento() as any);
	});

	it("completes full workflow: configure -> start task -> poll -> complete", async () => {
		// 1. Configure credentials
		const creds = await credentialsManager.store("cog_e2e_key", "org-e2e");
		expect(creds.isValid).toBe(true);

		// 2. Create API client
		const client = createDevinApiClient({
			token: creds.apiKey,
			orgId: creds.orgId,
		});

		// 3. Mock session creation
		mockFetch.mockResolvedValueOnce(
			jsonResponse({
				session_id: "e2e-sess-001",
				url: "https://app.devin.ai/sessions/e2e-sess-001",
				status: "new",
				acus_consumed: 0,
				created_at: 1_700_000_000,
				updated_at: 1_700_000_000,
				pull_requests: [],
			})
		);

		// 4. Start task via session manager
		const sessionManager = new DevinSessionManager(
			sessionStorage,
			credentialsManager,
			client
		);

		const session = await sessionManager.startTask({
			specPath: "/workspace/specs/001/spec.md",
			taskId: "T001",
			title: "Implement login form",
			description: "Build a login form with validation",
			priority: "P1",
			branch: "feature/login",
			repoUrl: "https://github.com/org/repo",
		});

		expect(session.status).toBe(SessionStatus.INITIALIZING);
		expect(sessionStorage.getAll()).toHaveLength(1);

		// 5. Poll for progress - session transitions to running
		mockFetch.mockResolvedValueOnce(
			jsonResponse({
				session_id: "e2e-sess-001",
				url: "https://app.devin.ai/sessions/e2e-sess-001",
				status: "running",
				tags: [],
				created_at: 1_700_000_000,
				updated_at: 1_700_000_010,
				acus_consumed: 3,
				pull_requests: [],
				is_archived: false,
			})
		);

		const poller = new DevinPollingService(sessionStorage, client);
		const statusChanges: string[] = [];
		poller.onStatusChange((e) => {
			statusChanges.push(e.status);
		});

		await poller.pollOnce();
		expect(statusChanges).toContain(SessionStatus.RUNNING);

		// 6. Poll again - session completes with PR
		mockFetch.mockResolvedValueOnce(
			jsonResponse({
				session_id: "e2e-sess-001",
				url: "https://app.devin.ai/sessions/e2e-sess-001",
				status: "exit",
				tags: [],
				created_at: 1_700_000_000,
				updated_at: 1_700_000_100,
				acus_consumed: 10,
				pull_requests: [
					{
						pr_url: "https://github.com/org/repo/pull/42",
						pr_state: "open",
					},
				],
				is_archived: false,
			})
		);

		await poller.pollOnce();
		expect(statusChanges).toContain(SessionStatus.COMPLETED);

		// 7. Verify final state
		const finalSession = sessionStorage.getByLocalId(session.localId);
		expect(finalSession.status).toBe(SessionStatus.COMPLETED);
		expect(finalSession.completedAt).toBeDefined();
		expect(finalSession.pullRequests).toHaveLength(1);
		expect(finalSession.pullRequests[0].prUrl).toBe(
			"https://github.com/org/repo/pull/42"
		);
	});

	it("handles session cancellation workflow", async () => {
		await credentialsManager.store("cog_cancel_key", "org-cancel");
		const creds = await credentialsManager.getOrThrow();
		const client = createDevinApiClient({
			token: creds.apiKey,
			orgId: creds.orgId,
		});

		mockFetch.mockResolvedValueOnce(
			jsonResponse({
				session_id: "cancel-sess-001",
				url: "",
				status: "new",
				acus_consumed: 0,
				created_at: 1_700_000_000,
				updated_at: 1_700_000_000,
				pull_requests: [],
			})
		);

		const sessionManager = new DevinSessionManager(
			sessionStorage,
			credentialsManager,
			client
		);

		const session = await sessionManager.startTask({
			specPath: "/spec.md",
			taskId: "T001",
			title: "Test",
			description: "Test task",
			priority: "P1",
			branch: "main",
			repoUrl: "https://github.com/org/repo",
		});

		// Cancel the session
		const cancelled = await sessionManager.cancelSession(session.localId);
		expect(cancelled.status).toBe(SessionStatus.CANCELLED);
		expect(cancelled.completedAt).toBeDefined();
		expect(cancelled.tasks[0].status).toBe("cancelled");
	});
});
