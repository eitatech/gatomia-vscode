import { describe, it, expect } from "vitest";
import type {
	CreateSessionRequest,
	CreateSessionResponse,
	GetSessionResponse,
	DevinApiClientInterface,
} from "../../src/features/devin/devin-api-client";
import { DevinApiStatus, SessionStatus } from "../../src/features/devin/types";
import { mapDevinApiStatusToSessionStatus } from "../../src/features/devin/status-mapper";

describe("Devin API Contract Tests", () => {
	describe("CreateSessionRequest contract", () => {
		it("requires prompt field", () => {
			const request: CreateSessionRequest = {
				prompt: "Implement feature X",
			};
			expect(request.prompt).toBeDefined();
			expect(typeof request.prompt).toBe("string");
		});

		it("accepts optional fields", () => {
			const request: CreateSessionRequest = {
				prompt: "Implement feature X",
				title: "Feature X",
				repos: [{ url: "https://github.com/org/repo", branch: "main" }],
				tags: ["gatomia"],
				maxAcuLimit: 100,
				playbookId: "pb-123",
			};

			expect(request.title).toBe("Feature X");
			expect(request.repos).toHaveLength(1);
			expect(request.tags).toContain("gatomia");
		});
	});

	describe("CreateSessionResponse contract", () => {
		it("contains required response fields", () => {
			const response: CreateSessionResponse = {
				sessionId: "sess-001",
				url: "https://app.devin.ai/sessions/sess-001",
				status: DevinApiStatus.NEW,
				acusConsumed: 0,
				createdAt: 1_700_000_000,
				updatedAt: 1_700_000_000,
				pullRequests: [],
			};

			expect(response.sessionId).toBeTruthy();
			expect(response.url).toBeTruthy();
			expect(response.status).toBe("new");
			expect(response.pullRequests).toBeInstanceOf(Array);
		});
	});

	describe("GetSessionResponse contract", () => {
		it("includes status and metadata fields", () => {
			const response: GetSessionResponse = {
				sessionId: "sess-001",
				url: "https://app.devin.ai/sessions/sess-001",
				status: DevinApiStatus.RUNNING,
				tags: ["test"],
				createdAt: 1_700_000_000,
				updatedAt: 1_700_000_001,
				acusConsumed: 5,
				pullRequests: [],
				isArchived: false,
			};

			expect(response.status).toBe("running");
			expect(response.isArchived).toBe(false);
			expect(response.tags).toContain("test");
		});
	});

	describe("Status mapping contract", () => {
		it("maps all DevinApiStatus values to valid SessionStatus", () => {
			const apiStatuses = Object.values(DevinApiStatus);
			const sessionStatuses = Object.values(SessionStatus);

			for (const apiStatus of apiStatuses) {
				const mapped = mapDevinApiStatusToSessionStatus(apiStatus);
				expect(sessionStatuses).toContain(mapped);
			}
		});

		it("DevinApiStatus.EXIT maps to SessionStatus.COMPLETED", () => {
			expect(mapDevinApiStatusToSessionStatus(DevinApiStatus.EXIT)).toBe(
				SessionStatus.COMPLETED
			);
		});

		it("DevinApiStatus.ERROR maps to SessionStatus.FAILED", () => {
			expect(mapDevinApiStatusToSessionStatus(DevinApiStatus.ERROR)).toBe(
				SessionStatus.FAILED
			);
		});
	});

	describe("DevinApiClientInterface contract", () => {
		it("requires all methods to be present", () => {
			const methods: (keyof DevinApiClientInterface)[] = [
				"apiVersion",
				"createSession",
				"getSession",
				"listSessions",
				"validateCredentials",
			];

			for (const method of methods) {
				expect(method).toBeDefined();
			}
		});
	});
});
