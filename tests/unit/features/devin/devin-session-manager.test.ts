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

		it("should include branch instructions when branch is provided", async () => {
			const { mapSpecTaskToDevinPrompt } = await import(
				"../../../../src/features/devin/devin-session-manager"
			);

			const prompt = mapSpecTaskToDevinPrompt({
				title: "Fix bug",
				description: "Fix the null pointer issue",
				branch: "feature/my-branch",
			});

			expect(prompt).toContain("Branch Instructions");
			expect(prompt).toContain("feature/my-branch");
			expect(prompt).toContain("Pull Request targeting `feature/my-branch`");
			expect(prompt).toContain("Do NOT target any other branch");
		});

		it("should omit branch instructions when branch is not provided", async () => {
			const { mapSpecTaskToDevinPrompt } = await import(
				"../../../../src/features/devin/devin-session-manager"
			);

			const prompt = mapSpecTaskToDevinPrompt({
				title: "Fix bug",
				description: "Fix the null pointer issue",
			});

			expect(prompt).not.toContain("Branch Instructions");
		});
	});

	describe("startTaskGroup", () => {
		it("should create a single session for all tasks in the group", async () => {
			const { DevinSessionManager } = await import(
				"../../../../src/features/devin/devin-session-manager"
			);
			const manager = new DevinSessionManager(
				mockStorage,
				mockCredentials,
				mockApiClient
			);

			const session = await manager.startTaskGroup({
				specPath: ".specify/001-feature/tasks.md",
				groupName: "Phase 1: Foundation",
				tasks: [
					{ taskId: "T001", title: "Create types", priority: "P1" },
					{ taskId: "T002", title: "Add validation", priority: "P2" },
					{ taskId: "T003", title: "Write tests", priority: "P1" },
				],
				branch: "feature/foundation",
				repoUrl: "https://github.com/org/repo",
			});

			expect(mockApiClient.createSession).toHaveBeenCalledOnce();
			expect(mockStorage.save).toHaveBeenCalledOnce();
			expect(session.status).toBe(SessionStatus.INITIALIZING);
			expect(session.tasks).toHaveLength(3);
			expect(session.tasks[0].specTaskId).toBe("T001");
			expect(session.tasks[1].specTaskId).toBe("T002");
			expect(session.tasks[2].specTaskId).toBe("T003");
		});

		it("should include group name in API request title", async () => {
			const { DevinSessionManager } = await import(
				"../../../../src/features/devin/devin-session-manager"
			);
			const manager = new DevinSessionManager(
				mockStorage,
				mockCredentials,
				mockApiClient
			);

			await manager.startTaskGroup({
				specPath: ".specify/001-feature/tasks.md",
				groupName: "Phase 1: Foundation",
				tasks: [{ taskId: "T001", title: "Create types", priority: "P1" }],
				branch: "feature/foundation",
				repoUrl: "https://github.com/org/repo",
			});

			const callArgs = (mockApiClient.createSession as ReturnType<typeof vi.fn>)
				.mock.calls[0][0];
			expect(callArgs.title).toBe("Group: Phase 1: Foundation");
			expect(callArgs.tags).toContain("task-group");
			expect(callArgs.tags).toContain("task-T001");
		});

		it("should pass reference documents to the prompt", async () => {
			const { DevinSessionManager } = await import(
				"../../../../src/features/devin/devin-session-manager"
			);
			const manager = new DevinSessionManager(
				mockStorage,
				mockCredentials,
				mockApiClient
			);

			await manager.startTaskGroup({
				specPath: ".specify/001-feature/tasks.md",
				groupName: "Phase 1",
				tasks: [{ taskId: "T001", title: "Create types", priority: "P1" }],
				branch: "feature/foundation",
				repoUrl: "https://github.com/org/repo",
				referenceDocuments: [
					{ type: "Specification", content: "# Spec content here" },
					{
						type: "Implementation Plan",
						content: "# Plan content here",
					},
				],
			});

			const callArgs = (mockApiClient.createSession as ReturnType<typeof vi.fn>)
				.mock.calls[0][0];
			expect(callArgs.prompt).toContain("Spec content here");
			expect(callArgs.prompt).toContain("Plan content here");
			expect(callArgs.prompt).toContain("Reference Documents");
		});
	});

	describe("mapTaskGroupToDevinPrompt", () => {
		it("should list all tasks in the prompt", async () => {
			const { mapTaskGroupToDevinPrompt } = await import(
				"../../../../src/features/devin/devin-session-manager"
			);

			const prompt = mapTaskGroupToDevinPrompt({
				groupName: "Phase 1: Foundation",
				tasks: [
					{ taskId: "T001", title: "Create types", priority: "P1" },
					{ taskId: "T002", title: "Add validation", priority: "P2" },
				],
			});

			expect(prompt).toContain("Phase 1: Foundation");
			expect(prompt).toContain("**T001**: Create types");
			expect(prompt).toContain("**T002**: Add validation");
			expect(prompt).toContain("ALL of the following tasks");
			expect(prompt).toContain("one PR");
		});

		it("should include reference documents as context", async () => {
			const { mapTaskGroupToDevinPrompt } = await import(
				"../../../../src/features/devin/devin-session-manager"
			);

			const prompt = mapTaskGroupToDevinPrompt({
				groupName: "Phase 1",
				tasks: [{ taskId: "T001", title: "Create types", priority: "P1" }],
				referenceDocuments: [
					{ type: "Specification", content: "Feature X requires..." },
					{
						type: "Implementation Plan",
						content: "Step 1: create module...",
					},
				],
			});

			expect(prompt).toContain("### Specification");
			expect(prompt).toContain("Feature X requires...");
			expect(prompt).toContain("### Implementation Plan");
			expect(prompt).toContain("Step 1: create module...");
		});

		it("should include branch instructions", async () => {
			const { mapTaskGroupToDevinPrompt } = await import(
				"../../../../src/features/devin/devin-session-manager"
			);

			const prompt = mapTaskGroupToDevinPrompt({
				groupName: "Phase 1",
				tasks: [{ taskId: "T001", title: "Create types", priority: "P1" }],
				branch: "feature/my-branch",
			});

			expect(prompt).toContain("Branch Instructions");
			expect(prompt).toContain("feature/my-branch");
		});

		it("should omit reference documents section when none provided", async () => {
			const { mapTaskGroupToDevinPrompt } = await import(
				"../../../../src/features/devin/devin-session-manager"
			);

			const prompt = mapTaskGroupToDevinPrompt({
				groupName: "Phase 1",
				tasks: [{ taskId: "T001", title: "Create types", priority: "P1" }],
			});

			expect(prompt).not.toContain("Reference Documents");
		});
	});
});
