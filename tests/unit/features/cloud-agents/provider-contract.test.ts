/**
 * Provider Contract Tests
 *
 * Tests for canonical provider/session/task types and adapter contract compliance.
 *
 * @see specs/016-multi-provider-agents/contracts/provider-interface.md
 */

import { describe, expect, it } from "vitest";
import {
	ErrorCode,
	type AgentSession,
	type SessionContext,
	type SessionUpdate,
	type SpecTask,
	ProviderError,
	SessionStatus,
	StoreError,
	StoreErrorCode,
	TaskPriority,
	TaskStatus,
} from "../../../../src/features/cloud-agents/types";
import type { CloudAgentProvider } from "../../../../src/features/cloud-agents/cloud-agent-provider";
import { createMockProviderAdapter } from "../../../fixtures/mock-provider-adapter";

// ============================================================================
// Helpers
// ============================================================================

function createTestSession(
	overrides: Partial<AgentSession> = {}
): AgentSession {
	return {
		localId: "local-1",
		providerId: "test-provider",
		providerSessionId: "ext-1",
		status: SessionStatus.PENDING,
		branch: "main",
		specPath: "/specs/test/spec.md",
		tasks: [],
		pullRequests: [],
		createdAt: Date.now(),
		updatedAt: Date.now(),
		completedAt: undefined,
		isReadOnly: false,
		...overrides,
	};
}

// ============================================================================
// SessionStatus
// ============================================================================

describe("SessionStatus", () => {
	it("should define all canonical session statuses", () => {
		expect(SessionStatus.PENDING).toBe("pending");
		expect(SessionStatus.RUNNING).toBe("running");
		expect(SessionStatus.BLOCKED).toBe("blocked");
		expect(SessionStatus.COMPLETED).toBe("completed");
		expect(SessionStatus.FAILED).toBe("failed");
		expect(SessionStatus.CANCELLED).toBe("cancelled");
	});

	it("should have exactly 6 status values", () => {
		expect(Object.keys(SessionStatus)).toHaveLength(6);
	});
});

// ============================================================================
// TaskStatus
// ============================================================================

describe("TaskStatus", () => {
	it("should define all canonical task statuses", () => {
		expect(TaskStatus.PENDING).toBe("pending");
		expect(TaskStatus.IN_PROGRESS).toBe("in_progress");
		expect(TaskStatus.COMPLETED).toBe("completed");
		expect(TaskStatus.FAILED).toBe("failed");
		expect(TaskStatus.SKIPPED).toBe("skipped");
	});

	it("should have exactly 5 status values", () => {
		expect(Object.keys(TaskStatus)).toHaveLength(5);
	});
});

// ============================================================================
// TaskPriority
// ============================================================================

describe("TaskPriority", () => {
	it("should define all priority levels", () => {
		expect(TaskPriority.LOW).toBe("low");
		expect(TaskPriority.MEDIUM).toBe("medium");
		expect(TaskPriority.HIGH).toBe("high");
		expect(TaskPriority.CRITICAL).toBe("critical");
	});
});

// ============================================================================
// ErrorCode
// ============================================================================

describe("ErrorCode", () => {
	it("should define credential error codes", () => {
		expect(ErrorCode.CREDENTIALS_MISSING).toBe("CREDENTIALS_MISSING");
		expect(ErrorCode.CREDENTIALS_INVALID).toBe("CREDENTIALS_INVALID");
	});

	it("should define session error codes", () => {
		expect(ErrorCode.SESSION_NOT_FOUND).toBe("SESSION_NOT_FOUND");
		expect(ErrorCode.SESSION_CREATION_FAILED).toBe("SESSION_CREATION_FAILED");
		expect(ErrorCode.SESSION_CANCEL_FAILED).toBe("SESSION_CANCEL_FAILED");
	});

	it("should define API and network error codes", () => {
		expect(ErrorCode.API_UNAVAILABLE).toBe("API_UNAVAILABLE");
		expect(ErrorCode.API_RATE_LIMITED).toBe("API_RATE_LIMITED");
		expect(ErrorCode.API_ERROR).toBe("API_ERROR");
		expect(ErrorCode.NETWORK_ERROR).toBe("NETWORK_ERROR");
		expect(ErrorCode.TIMEOUT).toBe("TIMEOUT");
	});
});

// ============================================================================
// ProviderError
// ============================================================================

describe("ProviderError", () => {
	it("should carry error code, provider ID, and recoverable flag", () => {
		const err = new ProviderError(
			"creds missing",
			ErrorCode.CREDENTIALS_MISSING,
			"devin",
			true
		);
		expect(err.message).toBe("creds missing");
		expect(err.code).toBe(ErrorCode.CREDENTIALS_MISSING);
		expect(err.providerId).toBe("devin");
		expect(err.recoverable).toBe(true);
		expect(err.name).toBe("ProviderError");
	});

	it("should default recoverable to false", () => {
		const err = new ProviderError(
			"fail",
			ErrorCode.API_ERROR,
			"github-copilot"
		);
		expect(err.recoverable).toBe(false);
	});

	it("should be an instance of Error", () => {
		const err = new ProviderError("x", ErrorCode.TIMEOUT, "p");
		expect(err).toBeInstanceOf(Error);
	});
});

// ============================================================================
// StoreError
// ============================================================================

describe("StoreError", () => {
	it("should carry error code and operation name", () => {
		const err = new StoreError(
			"not found",
			StoreErrorCode.NOT_FOUND,
			"getById"
		);
		expect(err.message).toBe("not found");
		expect(err.code).toBe(StoreErrorCode.NOT_FOUND);
		expect(err.operation).toBe("getById");
		expect(err.name).toBe("StoreError");
	});

	it("should be an instance of Error", () => {
		const err = new StoreError("x", StoreErrorCode.UNKNOWN, "op");
		expect(err).toBeInstanceOf(Error);
	});
});

// ============================================================================
// AgentSession shape
// ============================================================================

describe("AgentSession", () => {
	it("should create a valid session with all required fields", () => {
		const session = createTestSession();
		expect(session.localId).toBe("local-1");
		expect(session.providerId).toBe("test-provider");
		expect(session.status).toBe(SessionStatus.PENDING);
		expect(session.tasks).toEqual([]);
		expect(session.pullRequests).toEqual([]);
		expect(session.isReadOnly).toBe(false);
	});

	it("should allow mutable status, updatedAt, completedAt, isReadOnly fields", () => {
		const session = createTestSession();
		session.status = SessionStatus.RUNNING;
		session.updatedAt = Date.now();
		session.completedAt = Date.now();
		session.isReadOnly = true;
		expect(session.status).toBe(SessionStatus.RUNNING);
		expect(session.isReadOnly).toBe(true);
	});
});

// ============================================================================
// CloudAgentProvider interface (compile-time contract)
// ============================================================================

describe("CloudAgentProvider Contract", () => {
	it("should enforce the complete interface shape at compile time", () => {
		const mockProvider: CloudAgentProvider = {
			metadata: {
				id: "mock",
				displayName: "Mock",
				description: "A mock provider",
				icon: "beaker",
			},
			hasCredentials: async () => true,
			configureCredentials: async () => true,
			createSession: async (_task: SpecTask, _ctx: SessionContext) =>
				createTestSession(),
			cancelSession: async (_id: string) => {
				/* no-op for mock */
			},
			pollSessions: async (_sessions: AgentSession[]) => [] as SessionUpdate[],
			getExternalUrl: () => "https://example.com",
			getStatusDisplay: (_session: AgentSession) => "pending",
			handleBlockedSession: (_session: AgentSession) => null,
			handleSessionComplete: async (_session: AgentSession) => {
				/* no-op for mock */
			},
		};
		expect(mockProvider.metadata.id).toBe("mock");
	});
});

// ============================================================================
// Extensibility Contract (T063)
// ============================================================================

describe("Provider Extensibility Contract", () => {
	it("should allow a third-party provider to satisfy the interface via mock fixture", () => {
		const provider = createMockProviderAdapter("custom-agent");
		expect(provider.metadata.id).toBe("custom-agent");
		expect(provider.metadata.displayName).toBeTruthy();
		expect(typeof provider.hasCredentials).toBe("function");
		expect(typeof provider.configureCredentials).toBe("function");
		expect(typeof provider.createSession).toBe("function");
		expect(typeof provider.cancelSession).toBe("function");
		expect(typeof provider.pollSessions).toBe("function");
		expect(typeof provider.getExternalUrl).toBe("function");
		expect(typeof provider.getStatusDisplay).toBe("function");
		expect(typeof provider.handleBlockedSession).toBe("function");
		expect(typeof provider.handleSessionComplete).toBe("function");
	});

	it("should create sessions with the custom provider ID", async () => {
		const provider = createMockProviderAdapter("custom-agent");
		const task = {
			id: "T-1",
			title: "Test",
			description: "d",
			priority: "high" as const,
		};
		const ctx = { branch: "main", specPath: "/s.md", workspaceUri: "" };
		const session = await provider.createSession(task, ctx);
		expect(session.providerId).toBe("custom-agent");
		expect(session.status).toBe("pending");
	});

	it("should cancel sessions via the custom provider", async () => {
		const provider = createMockProviderAdapter("custom-agent");
		await expect(provider.cancelSession("s1")).resolves.not.toThrow();
	});
});
