import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import type { DevinApiClientInterface } from "../../../../src/features/devin/devin-api-client";
import type { DevinSessionStorage } from "../../../../src/features/devin/devin-session-storage";
import { SessionStatus } from "../../../../src/features/devin/types";

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
		getBySessionId: vi.fn(),
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
});
