import { describe, it, expect, beforeEach, vi } from "vitest";
import { DevinSessionStorage } from "../../../src/features/devin/devin-session-storage";
import { SessionStatus } from "../../../src/features/devin/types";
import type { DevinApiClientInterface } from "../../../src/features/devin/devin-api-client";
import type { DevinSession } from "../../../src/features/devin/entities";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

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

function createMockApiClient(
	statusSequence: string[]
): DevinApiClientInterface {
	let callIndex = 0;
	return {
		apiVersion: "v3",
		createSession: vi.fn(),
		getSession: vi.fn().mockImplementation(() => {
			const idx = Math.min(callIndex, statusSequence.length - 1);
			callIndex += 1;
			const status = statusSequence[idx];
			return Promise.resolve({
				sessionId: "devin-sess-001",
				url: "https://app.devin.ai/sessions/devin-sess-001",
				status,
				tags: [],
				createdAt: 1_700_000_000,
				updatedAt: 1_700_000_000 + callIndex,
				acusConsumed: callIndex,
				pullRequests: [],
				isArchived: false,
			});
		}),
		listSessions: vi.fn(),
		validateCredentials: vi.fn(),
	};
}

const SEED_SESSION: DevinSession = {
	localId: "local-001",
	sessionId: "devin-sess-001",
	status: SessionStatus.INITIALIZING,
	branch: "feature/test",
	specPath: "/spec.md",
	tasks: [
		{
			taskId: "task-001",
			specTaskId: "T001",
			title: "Test task",
			description: "Test",
			priority: "P1",
			status: "queued",
		},
	],
	createdAt: 1_700_000_000,
	updatedAt: 1_700_000_000,
	pullRequests: [],
	apiVersion: "v3",
	retryCount: 0,
};

describe("Progress Monitoring Integration", () => {
	let storage: DevinSessionStorage;

	beforeEach(() => {
		vi.clearAllMocks();
		const mockMemento = createMockMemento();
		storage = new DevinSessionStorage(mockMemento as any);
	});

	it("tracks session through status transitions: initializing -> running -> completed", async () => {
		await storage.save(SEED_SESSION);

		const apiClient = createMockApiClient([
			"claimed",
			"running",
			"running",
			"exit",
		]);

		const { DevinPollingService } = await import(
			"../../../src/features/devin/devin-polling-service"
		);
		const poller = new DevinPollingService(storage, apiClient);

		const statusChanges: string[] = [];
		poller.onStatusChange((event) => {
			statusChanges.push(event.status);
		});

		// Poll 4 times to progress through statuses
		await poller.pollOnce();
		await poller.pollOnce();
		await poller.pollOnce();
		await poller.pollOnce();

		// Should have seen transitions
		expect(statusChanges.length).toBeGreaterThanOrEqual(2);
		// Final session should be completed
		const finalSession = storage.getByLocalId("local-001");
		expect(finalSession.status).toBe(SessionStatus.COMPLETED);
	});

	it("handles session failure status correctly", async () => {
		await storage.save(SEED_SESSION);

		const apiClient = createMockApiClient(["running", "error"]);

		const { DevinPollingService } = await import(
			"../../../src/features/devin/devin-polling-service"
		);
		const poller = new DevinPollingService(storage, apiClient);

		await poller.pollOnce();
		await poller.pollOnce();

		const session = storage.getByLocalId("local-001");
		expect(session.status).toBe(SessionStatus.FAILED);
	});
});
