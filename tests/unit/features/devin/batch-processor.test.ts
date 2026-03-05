import { describe, it, expect, beforeEach, vi } from "vitest";
import type { DevinApiClientInterface } from "../../../../src/features/devin/devin-api-client";
import type { DevinSessionStorage } from "../../../../src/features/devin/devin-session-storage";
import type { DevinCredentialsManager } from "../../../../src/features/devin/devin-credentials-manager";

function createMockApiClient(): DevinApiClientInterface {
	let callCount = 0;
	return {
		apiVersion: "v3",
		createSession: vi.fn().mockImplementation(() => {
			callCount += 1;
			return Promise.resolve({
				sessionId: `devin-batch-${String(callCount).padStart(3, "0")}`,
				url: `https://app.devin.ai/sessions/devin-batch-${String(callCount).padStart(3, "0")}`,
				status: "new",
				acusConsumed: 0,
				createdAt: 1_700_000_000,
				updatedAt: 1_700_000_000,
				pullRequests: [],
			});
		}),
		getSession: vi.fn(),
		listSessions: vi.fn(),
		validateCredentials: vi.fn().mockResolvedValue(true),
	};
}

function createMockStorage(): DevinSessionStorage {
	const sessions: unknown[] = [];
	return {
		getAll: vi.fn().mockReturnValue(sessions),
		getByLocalId: vi.fn(),
		getBySessionId: vi.fn(),
		save: vi.fn().mockImplementation((session) => {
			sessions.push(session);
			return Promise.resolve();
		}),
		update: vi.fn().mockResolvedValue(undefined),
		delete: vi.fn(),
		getActive: vi.fn().mockReturnValue([]),
		cleanup: vi.fn(),
		count: vi.fn().mockReturnValue(0),
	} as unknown as DevinSessionStorage;
}

function createMockCredentials(): DevinCredentialsManager {
	return {
		get: vi.fn().mockResolvedValue({
			apiKey: "cog_test_key",
			apiVersion: "v3",
			orgId: "org-123",
			createdAt: 1_700_000_000,
			isValid: true,
		}),
		getOrThrow: vi.fn().mockResolvedValue({
			apiKey: "cog_test_key",
			apiVersion: "v3",
			orgId: "org-123",
			createdAt: 1_700_000_000,
			isValid: true,
		}),
		store: vi.fn(),
		delete: vi.fn(),
		hasCredentials: vi.fn().mockResolvedValue(true),
		markUsed: vi.fn().mockResolvedValue(undefined),
		markInvalid: vi.fn(),
	} as unknown as DevinCredentialsManager;
}

describe("BatchProcessor", () => {
	let mockApiClient: DevinApiClientInterface;
	let mockStorage: DevinSessionStorage;
	let mockCredentials: DevinCredentialsManager;

	beforeEach(() => {
		vi.clearAllMocks();
		mockApiClient = createMockApiClient();
		mockStorage = createMockStorage();
		mockCredentials = createMockCredentials();
	});

	describe("processBatch", () => {
		it("should create one Devin session per task in the batch", async () => {
			const { BatchProcessor } = await import(
				"../../../../src/features/devin/batch-processor"
			);
			const processor = new BatchProcessor(
				mockApiClient,
				mockStorage,
				mockCredentials
			);

			const results = await processor.processBatch({
				specPath: "/workspace/specs/001/spec.md",
				branch: "feature/batch",
				repoUrl: "https://github.com/org/repo",
				tasks: [
					{
						taskId: "T001",
						title: "Task 1",
						description: "First task",
						priority: "P1" as const,
					},
					{
						taskId: "T002",
						title: "Task 2",
						description: "Second task",
						priority: "P2" as const,
					},
					{
						taskId: "T003",
						title: "Task 3",
						description: "Third task",
						priority: "P1" as const,
					},
				],
			});

			expect(mockApiClient.createSession).toHaveBeenCalledTimes(3);
			expect(results.successful).toHaveLength(3);
			expect(results.failed).toHaveLength(0);
			expect(results.totalRequested).toBe(3);
		});

		it("should continue processing remaining tasks when one fails", async () => {
			(
				mockApiClient.createSession as ReturnType<typeof vi.fn>
			).mockRejectedValueOnce(new Error("API error"));

			const { BatchProcessor } = await import(
				"../../../../src/features/devin/batch-processor"
			);
			const processor = new BatchProcessor(
				mockApiClient,
				mockStorage,
				mockCredentials
			);

			const results = await processor.processBatch({
				specPath: "/workspace/specs/001/spec.md",
				branch: "feature/batch",
				repoUrl: "https://github.com/org/repo",
				tasks: [
					{
						taskId: "T001",
						title: "Failing task",
						description: "Will fail",
						priority: "P1" as const,
					},
					{
						taskId: "T002",
						title: "Succeeding task",
						description: "Will succeed",
						priority: "P2" as const,
					},
				],
			});

			expect(results.successful).toHaveLength(1);
			expect(results.failed).toHaveLength(1);
			expect(results.failed[0].taskId).toBe("T001");
			expect(results.failed[0].error).toBeDefined();
		});

		it("should emit progress events for each task", async () => {
			const { BatchProcessor } = await import(
				"../../../../src/features/devin/batch-processor"
			);
			const processor = new BatchProcessor(
				mockApiClient,
				mockStorage,
				mockCredentials
			);

			const progressEvents: Array<{
				taskId: string;
				index: number;
				total: number;
			}> = [];
			processor.onProgress((event) => {
				progressEvents.push(event);
			});

			await processor.processBatch({
				specPath: "/workspace/specs/001/spec.md",
				branch: "feature/batch",
				repoUrl: "https://github.com/org/repo",
				tasks: [
					{
						taskId: "T001",
						title: "Task 1",
						description: "First",
						priority: "P1" as const,
					},
					{
						taskId: "T002",
						title: "Task 2",
						description: "Second",
						priority: "P2" as const,
					},
				],
			});

			expect(progressEvents).toHaveLength(4);
			expect(progressEvents[0]).toMatchObject({
				taskId: "T001",
				index: 0,
				total: 2,
				status: "starting",
			});
			expect(progressEvents[1]).toMatchObject({
				taskId: "T001",
				index: 0,
				total: 2,
				status: "success",
			});
			expect(progressEvents[2]).toMatchObject({
				taskId: "T002",
				index: 1,
				total: 2,
				status: "starting",
			});
			expect(progressEvents[3]).toMatchObject({
				taskId: "T002",
				index: 1,
				total: 2,
				status: "success",
			});
		});

		it("should handle empty task list gracefully", async () => {
			const { BatchProcessor } = await import(
				"../../../../src/features/devin/batch-processor"
			);
			const processor = new BatchProcessor(
				mockApiClient,
				mockStorage,
				mockCredentials
			);

			const results = await processor.processBatch({
				specPath: "/workspace/specs/001/spec.md",
				branch: "feature/batch",
				repoUrl: "https://github.com/org/repo",
				tasks: [],
			});

			expect(results.successful).toHaveLength(0);
			expect(results.failed).toHaveLength(0);
			expect(results.totalRequested).toBe(0);
			expect(mockApiClient.createSession).not.toHaveBeenCalled();
		});
	});
});
