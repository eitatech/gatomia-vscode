import { describe, it, expect, beforeEach, vi } from "vitest";
import { DevinSessionStorage } from "../../../src/features/devin/devin-session-storage";
import { DevinCredentialsManager } from "../../../src/features/devin/devin-credentials-manager";
import { createDevinApiClient } from "../../../src/features/devin/devin-api-client-factory";

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

describe("Batch Task Delegation Workflow (Integration)", () => {
	let credentialsManager: DevinCredentialsManager;
	let sessionStorage: DevinSessionStorage;

	beforeEach(() => {
		vi.clearAllMocks();
		credentialsManager = new DevinCredentialsManager(
			createMockSecretStorage() as any
		);
		sessionStorage = new DevinSessionStorage(createMockMemento() as any);
	});

	it("delegates multiple tasks creating one session per task", async () => {
		await credentialsManager.store("cog_batch_key", "org-batch");

		const creds = await credentialsManager.getOrThrow();
		const client = createDevinApiClient({
			token: creds.apiKey,
			orgId: creds.orgId,
		});

		let callIndex = 0;
		mockFetch.mockImplementation(() => {
			callIndex += 1;
			return Promise.resolve(
				jsonResponse({
					session_id: `batch-sess-${String(callIndex).padStart(3, "0")}`,
					url: `https://app.devin.ai/sessions/batch-sess-${String(callIndex).padStart(3, "0")}`,
					status: "new",
					acus_consumed: 0,
					created_at: 1_700_000_000,
					updated_at: 1_700_000_000,
					pull_requests: [],
				})
			);
		});

		const { BatchProcessor } = await import(
			"../../../src/features/devin/batch-processor"
		);
		const processor = new BatchProcessor(
			client,
			sessionStorage,
			credentialsManager
		);

		const results = await processor.processBatch({
			specPath: "/workspace/specs/001/spec.md",
			branch: "feature/all-tasks",
			repoUrl: "https://github.com/org/repo",
			tasks: [
				{
					taskId: "T001",
					title: "First task",
					description: "Implement first feature",
					priority: "P1" as const,
				},
				{
					taskId: "T002",
					title: "Second task",
					description: "Implement second feature",
					priority: "P2" as const,
				},
			],
		});

		expect(results.successful).toHaveLength(2);
		expect(results.failed).toHaveLength(0);

		const stored = sessionStorage.getAll();
		expect(stored).toHaveLength(2);
		expect(stored[0].tasks[0].specTaskId).toBe("T001");
		expect(stored[1].tasks[0].specTaskId).toBe("T002");
	});

	it("tracks partial failures in batch", async () => {
		await credentialsManager.store("cog_batch_key", "org-batch");

		const creds = await credentialsManager.getOrThrow();
		const client = createDevinApiClient({
			token: creds.apiKey,
			orgId: creds.orgId,
		});

		let callIndex = 0;
		mockFetch.mockImplementation(() => {
			callIndex += 1;
			if (callIndex === 2) {
				return Promise.resolve(jsonResponse({}, 500));
			}
			return Promise.resolve(
				jsonResponse({
					session_id: `batch-sess-${String(callIndex).padStart(3, "0")}`,
					url: "",
					status: "new",
					acus_consumed: 0,
					created_at: 1_700_000_000,
					updated_at: 1_700_000_000,
					pull_requests: [],
				})
			);
		});

		const { BatchProcessor } = await import(
			"../../../src/features/devin/batch-processor"
		);
		const processor = new BatchProcessor(
			client,
			sessionStorage,
			credentialsManager
		);

		const results = await processor.processBatch({
			specPath: "/workspace/specs/001/spec.md",
			branch: "feature/partial",
			repoUrl: "https://github.com/org/repo",
			tasks: [
				{
					taskId: "T001",
					title: "Will succeed",
					description: "OK",
					priority: "P1" as const,
				},
				{
					taskId: "T002",
					title: "Will fail",
					description: "Error",
					priority: "P2" as const,
				},
				{
					taskId: "T003",
					title: "Will succeed too",
					description: "OK",
					priority: "P1" as const,
				},
			],
		});

		expect(results.successful).toHaveLength(2);
		expect(results.failed).toHaveLength(1);
		expect(results.failed[0].taskId).toBe("T002");

		const stored = sessionStorage.getAll();
		expect(stored).toHaveLength(2);
	});
});
