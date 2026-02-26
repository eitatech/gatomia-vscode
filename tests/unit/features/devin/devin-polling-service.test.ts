import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import type { DevinApiClientInterface } from "../../../../src/features/devin/devin-api-client";
import type { DevinSessionStorage } from "../../../../src/features/devin/devin-session-storage";
import {
	SessionStatus,
	TaskStatus,
} from "../../../../src/features/devin/types";

function createMockApiClient(): DevinApiClientInterface {
	return {
		apiVersion: "v3",
		createSession: vi.fn(),
		getSession: vi.fn().mockResolvedValue({
			sessionId: "devin-sess-001",
			url: "https://app.devin.ai/sessions/devin-sess-001",
			status: "running",
			tags: [],
			createdAt: 1_700_000_000,
			updatedAt: 1_700_000_001,
			acusConsumed: 2,
			pullRequests: [],
			isArchived: false,
		}),
		listSessions: vi.fn(),
		validateCredentials: vi.fn(),
	};
}

function createMockStorage(): DevinSessionStorage {
	return {
		getAll: vi.fn().mockReturnValue([]),
		getByLocalId: vi.fn(),
		getBySessionId: vi.fn().mockReturnValue({
			localId: "local-001",
			sessionId: "devin-sess-001",
			status: SessionStatus.INITIALIZING,
			branch: "feature/test",
			specPath: "/spec.md",
			tasks: [
				{
					taskId: "task-uuid-001",
					specTaskId: "T001",
					title: "Create package structure",
					description: "Set up the project",
					priority: "high",
					status: TaskStatus.QUEUED,
					devinSessionId: "devin-sess-001",
					startedAt: 1_700_000_000,
				},
			],
			createdAt: 1_700_000_000,
			updatedAt: 1_700_000_000,
			pullRequests: [],
			apiVersion: "v3",
			retryCount: 0,
		}),
		save: vi.fn().mockResolvedValue(undefined),
		update: vi.fn().mockImplementation((_id, updates) =>
			Promise.resolve({
				localId: "local-001",
				sessionId: "devin-sess-001",
				status: updates.status ?? SessionStatus.RUNNING,
				...updates,
			})
		),
		delete: vi.fn(),
		getActive: vi.fn().mockReturnValue([
			{
				localId: "local-001",
				sessionId: "devin-sess-001",
				status: SessionStatus.INITIALIZING,
				branch: "feature/test",
				specPath: "/spec.md",
				tasks: [],
				createdAt: 1_700_000_000,
				updatedAt: 1_700_000_000,
				pullRequests: [],
				apiVersion: "v3",
				retryCount: 0,
			},
		]),
		cleanup: vi.fn(),
		count: vi.fn(),
	} as unknown as DevinSessionStorage;
}

describe("DevinPollingService", () => {
	let mockApiClient: DevinApiClientInterface;
	let mockStorage: DevinSessionStorage;

	beforeEach(() => {
		vi.useFakeTimers();
		vi.clearAllMocks();
		mockApiClient = createMockApiClient();
		mockStorage = createMockStorage();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("should poll active sessions and update storage with API status", async () => {
		const { DevinPollingService } = await import(
			"../../../../src/features/devin/devin-polling-service"
		);
		const service = new DevinPollingService(mockStorage, mockApiClient);

		await service.pollOnce();

		expect(mockApiClient.getSession).toHaveBeenCalledWith("devin-sess-001");
		expect(mockStorage.update).toHaveBeenCalledWith(
			"local-001",
			expect.objectContaining({ status: SessionStatus.RUNNING })
		);
	});

	it("should emit status change events when session status changes", async () => {
		const { DevinPollingService } = await import(
			"../../../../src/features/devin/devin-polling-service"
		);
		const service = new DevinPollingService(mockStorage, mockApiClient);
		const statusChanges: Array<{ localId: string; status: string }> = [];

		service.onStatusChange((event) => {
			statusChanges.push(event);
		});

		await service.pollOnce();

		expect(statusChanges).toHaveLength(1);
		expect(statusChanges[0].localId).toBe("local-001");
		expect(statusChanges[0].status).toBe(SessionStatus.RUNNING);
	});

	it("should not poll sessions that are in terminal states", async () => {
		(mockStorage.getActive as ReturnType<typeof vi.fn>).mockReturnValue([]);

		const { DevinPollingService } = await import(
			"../../../../src/features/devin/devin-polling-service"
		);
		const service = new DevinPollingService(mockStorage, mockApiClient);

		await service.pollOnce();

		expect(mockApiClient.getSession).not.toHaveBeenCalled();
	});

	it("should handle API errors gracefully during polling", async () => {
		(
			mockApiClient.getSession as ReturnType<typeof vi.fn>
		).mockRejectedValueOnce(new Error("Network error"));

		const { DevinPollingService } = await import(
			"../../../../src/features/devin/devin-polling-service"
		);
		const service = new DevinPollingService(mockStorage, mockApiClient);

		// Should not throw
		await expect(service.pollOnce()).resolves.not.toThrow();
	});

	it("should start and stop periodic polling", async () => {
		const { DevinPollingService } = await import(
			"../../../../src/features/devin/devin-polling-service"
		);
		const service = new DevinPollingService(mockStorage, mockApiClient, {
			intervalSeconds: 5,
		});

		service.start();
		expect(service.isRunning).toBe(true);

		service.stop();
		expect(service.isRunning).toBe(false);
	});

	it("should use statusDetail (status_enum) over base status for mapping", async () => {
		(
			mockApiClient.getSession as ReturnType<typeof vi.fn>
		).mockResolvedValueOnce({
			sessionId: "devin-sess-001",
			url: "https://app.devin.ai/sessions/devin-sess-001",
			status: "suspended",
			statusDetail: "finished",
			tags: [],
			createdAt: 1_700_000_000,
			updatedAt: 1_700_000_001,
			acusConsumed: 2,
			pullRequests: [],
			isArchived: false,
		});

		const { DevinPollingService } = await import(
			"../../../../src/features/devin/devin-polling-service"
		);
		const service = new DevinPollingService(mockStorage, mockApiClient);

		await service.pollOnce();

		expect(mockStorage.update).toHaveBeenCalledWith(
			"local-001",
			expect.objectContaining({ status: SessionStatus.COMPLETED })
		);
	});

	it("should emit blocked event when session transitions to blocked", async () => {
		(
			mockApiClient.getSession as ReturnType<typeof vi.fn>
		).mockResolvedValueOnce({
			sessionId: "devin-sess-001",
			url: "https://app.devin.ai/sessions/devin-sess-001",
			status: "running",
			statusDetail: "blocked",
			tags: [],
			title: "Task T002: Create package structure",
			createdAt: 1_700_000_000,
			updatedAt: 1_700_000_001,
			acusConsumed: 2,
			pullRequests: [],
			isArchived: false,
		});

		const { DevinPollingService } = await import(
			"../../../../src/features/devin/devin-polling-service"
		);
		const service = new DevinPollingService(mockStorage, mockApiClient);
		const blockedEvents: Array<{ sessionId: string; title: string }> = [];

		service.onBlocked((event) => {
			blockedEvents.push(event);
		});

		await service.pollOnce();

		expect(blockedEvents).toHaveLength(1);
		expect(blockedEvents[0].sessionId).toBe("devin-sess-001");
		expect(blockedEvents[0].title).toBe("Task T002: Create package structure");
	});

	it("should not emit blocked event when session was already blocked", async () => {
		(mockStorage.getActive as ReturnType<typeof vi.fn>).mockReturnValue([
			{
				localId: "local-001",
				sessionId: "devin-sess-001",
				status: SessionStatus.BLOCKED,
				branch: "feature/test",
				specPath: "/spec.md",
				tasks: [],
				createdAt: 1_700_000_000,
				updatedAt: 1_700_000_000,
				pullRequests: [],
				apiVersion: "v3",
				retryCount: 0,
			},
		]);

		(
			mockApiClient.getSession as ReturnType<typeof vi.fn>
		).mockResolvedValueOnce({
			sessionId: "devin-sess-001",
			url: "https://app.devin.ai/sessions/devin-sess-001",
			status: "running",
			statusDetail: "blocked",
			tags: [],
			title: "Still blocked",
			createdAt: 1_700_000_000,
			updatedAt: 1_700_000_001,
			acusConsumed: 2,
			pullRequests: [],
			isArchived: false,
		});

		const { DevinPollingService } = await import(
			"../../../../src/features/devin/devin-polling-service"
		);
		const service = new DevinPollingService(mockStorage, mockApiClient);
		const blockedEvents: Array<{ sessionId: string }> = [];

		service.onBlocked((event) => {
			blockedEvents.push(event);
		});

		await service.pollOnce();

		expect(blockedEvents).toHaveLength(0);
	});

	it("should sync task statuses to in_progress when session becomes running", async () => {
		const { DevinPollingService } = await import(
			"../../../../src/features/devin/devin-polling-service"
		);
		const service = new DevinPollingService(mockStorage, mockApiClient);

		await service.pollOnce();

		expect(mockStorage.update).toHaveBeenCalledWith(
			"local-001",
			expect.objectContaining({
				tasks: expect.arrayContaining([
					expect.objectContaining({
						specTaskId: "T001",
						status: TaskStatus.IN_PROGRESS,
					}),
				]),
			})
		);
	});

	it("should sync task statuses to completed when session finishes via v1 status_enum", async () => {
		(
			mockApiClient.getSession as ReturnType<typeof vi.fn>
		).mockResolvedValueOnce({
			sessionId: "devin-sess-001",
			url: "",
			status: "suspended",
			statusDetail: "finished",
			tags: [],
			createdAt: 1_700_000_000,
			updatedAt: 1_700_000_001,
			acusConsumed: 2,
			pullRequests: [],
			isArchived: false,
		});

		const { DevinPollingService } = await import(
			"../../../../src/features/devin/devin-polling-service"
		);
		const service = new DevinPollingService(mockStorage, mockApiClient);

		await service.pollOnce();

		expect(mockStorage.update).toHaveBeenCalledWith(
			"local-001",
			expect.objectContaining({
				status: SessionStatus.COMPLETED,
				tasks: expect.arrayContaining([
					expect.objectContaining({
						specTaskId: "T001",
						status: TaskStatus.COMPLETED,
					}),
				]),
			})
		);
	});

	it("should construct devinUrl when v1 session has no URL", async () => {
		(mockStorage.getBySessionId as ReturnType<typeof vi.fn>).mockReturnValue({
			localId: "local-001",
			sessionId: "devin-sess-001",
			status: SessionStatus.INITIALIZING,
			branch: "feature/test",
			specPath: "/spec.md",
			tasks: [],
			devinUrl: "",
			createdAt: 1_700_000_000,
			updatedAt: 1_700_000_000,
			pullRequests: [],
			apiVersion: "v1",
			retryCount: 0,
		});

		(
			mockApiClient.getSession as ReturnType<typeof vi.fn>
		).mockResolvedValueOnce({
			sessionId: "devin-sess-001",
			url: "",
			status: "running",
			tags: [],
			createdAt: 1_700_000_000,
			updatedAt: 1_700_000_001,
			acusConsumed: 0,
			pullRequests: [],
			isArchived: false,
		});

		const { DevinPollingService } = await import(
			"../../../../src/features/devin/devin-polling-service"
		);
		const service = new DevinPollingService(mockStorage, mockApiClient);

		await service.pollOnce();

		expect(mockStorage.update).toHaveBeenCalledWith(
			"local-001",
			expect.objectContaining({
				devinUrl: "https://app.devin.ai/sessions/devin-sess-001",
			})
		);
	});
});
