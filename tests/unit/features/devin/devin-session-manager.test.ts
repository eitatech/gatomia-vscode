import { describe, it, expect, beforeEach, vi } from "vitest";
import type { DevinApiClientInterface } from "../../../../src/features/devin/devin-api-client";
import type { DevinSessionStorage } from "../../../../src/features/devin/devin-session-storage";
import type { DevinCredentialsManager } from "../../../../src/features/devin/devin-credentials-manager";
import {
	SessionStatus,
	TaskStatus,
} from "../../../../src/features/devin/types";

// Will import DevinSessionManager once T019 is implemented
// import { DevinSessionManager } from "../../../../src/features/devin/devin-session-manager";

function createMockApiClient(): DevinApiClientInterface {
	return {
		apiVersion: "v3",
		createSession: vi.fn().mockResolvedValue({
			sessionId: "devin-sess-001",
			url: "https://app.devin.ai/sessions/devin-sess-001",
			status: "new",
			acusConsumed: 0,
			createdAt: 1_700_000_000,
			updatedAt: 1_700_000_000,
			pullRequests: [],
		}),
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
		listSessions: vi.fn().mockResolvedValue({
			sessions: [],
			pageInfo: { hasNextPage: false },
		}),
		validateCredentials: vi.fn().mockResolvedValue(true),
	};
}

function createMockSessionStorage(): DevinSessionStorage {
	return {
		getAll: vi.fn().mockReturnValue([]),
		getByLocalId: vi.fn(),
		getBySessionId: vi.fn(),
		save: vi.fn().mockResolvedValue(undefined),
		update: vi.fn().mockResolvedValue(undefined),
		delete: vi.fn().mockResolvedValue(undefined),
		getActive: vi.fn().mockReturnValue([]),
		cleanup: vi.fn().mockResolvedValue(0),
		count: vi.fn().mockReturnValue(0),
	} as unknown as DevinSessionStorage;
}

function createMockCredentialsManager(): DevinCredentialsManager {
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
		store: vi.fn().mockResolvedValue(undefined),
		delete: vi.fn().mockResolvedValue(undefined),
		hasCredentials: vi.fn().mockResolvedValue(true),
		markUsed: vi.fn().mockResolvedValue(undefined),
		markInvalid: vi.fn().mockResolvedValue(undefined),
	} as unknown as DevinCredentialsManager;
}

describe("DevinSessionManager", () => {
	let mockApiClient: DevinApiClientInterface;
	let mockStorage: DevinSessionStorage;
	let mockCredentials: DevinCredentialsManager;

	beforeEach(() => {
		vi.clearAllMocks();
		mockApiClient = createMockApiClient();
		mockStorage = createMockSessionStorage();
		mockCredentials = createMockCredentialsManager();
	});

	describe("startTask", () => {
		it("should create a session via API client and store it", async () => {
			const { DevinSessionManager } = await import(
				"../../../../src/features/devin/devin-session-manager"
			);
			const manager = new DevinSessionManager(
				mockStorage,
				mockCredentials,
				mockApiClient
			);

			const session = await manager.startTask({
				specPath: "/workspace/specs/001/spec.md",
				taskId: "T001",
				title: "Implement feature X",
				description: "Build the feature per spec",
				priority: "P1",
				branch: "feature/001",
				repoUrl: "https://github.com/org/repo",
			});

			expect(mockApiClient.createSession).toHaveBeenCalledOnce();
			expect(mockStorage.save).toHaveBeenCalledOnce();
			expect(session.status).toBe(SessionStatus.INITIALIZING);
			expect(session.branch).toBe("feature/001");
			expect(session.tasks).toHaveLength(1);
			expect(session.tasks[0].specTaskId).toBe("T001");
			expect(session.tasks[0].status).toBe(TaskStatus.QUEUED);
		});

		it("should include repo and branch in the API request", async () => {
			const { DevinSessionManager } = await import(
				"../../../../src/features/devin/devin-session-manager"
			);
			const manager = new DevinSessionManager(
				mockStorage,
				mockCredentials,
				mockApiClient
			);

			await manager.startTask({
				specPath: "/workspace/specs/001/spec.md",
				taskId: "T001",
				title: "Feature X",
				description: "Implement it",
				priority: "P1",
				branch: "feature/001",
				repoUrl: "https://github.com/org/repo",
			});

			const callArgs = (mockApiClient.createSession as ReturnType<typeof vi.fn>)
				.mock.calls[0][0];
			expect(callArgs.repos).toEqual([
				{ url: "https://github.com/org/repo", branch: "feature/001" },
			]);
		});

		it("should mark credentials as used after successful session creation", async () => {
			const { DevinSessionManager } = await import(
				"../../../../src/features/devin/devin-session-manager"
			);
			const manager = new DevinSessionManager(
				mockStorage,
				mockCredentials,
				mockApiClient
			);

			await manager.startTask({
				specPath: "/workspace/specs/001/spec.md",
				taskId: "T001",
				title: "Feature X",
				description: "Implement it",
				priority: "P1",
				branch: "feature/001",
				repoUrl: "https://github.com/org/repo",
			});

			expect(mockCredentials.markUsed).toHaveBeenCalledOnce();
		});
	});

	describe("mapSpecTaskToDevinPrompt", () => {
		it("should format task details into a Devin-compatible prompt", async () => {
			const { mapSpecTaskToDevinPrompt } = await import(
				"../../../../src/features/devin/devin-session-manager"
			);

			const prompt = mapSpecTaskToDevinPrompt({
				title: "Implement login form",
				description:
					"Create a React login component with email and password fields",
				acceptanceCriteria: [
					"Form validates email format",
					"Password must be 8+ characters",
				],
			});

			expect(prompt).toContain("Implement login form");
			expect(prompt).toContain("React login component");
			expect(prompt).toContain("Form validates email format");
			expect(prompt).toContain("Password must be 8+ characters");
		});
	});
});
