import { describe, it, expect, beforeEach, vi } from "vitest";
import { DevinApiClientV3 } from "../../../../src/features/devin/devin-api-client-v3";
import { DevinApiClientV1 } from "../../../../src/features/devin/devin-api-client-v1";
import { createDevinApiClient } from "../../../../src/features/devin/devin-api-client-factory";
import {
	DevinApiError,
	DevinAuthenticationError,
	DevinNetworkError,
	DevinOrgIdRequiredError,
} from "../../../../src/features/devin/errors";

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

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

describe("DevinApiClientV3", () => {
	const token = "cog_test_token_123";
	const orgId = "org-abc";
	let client: DevinApiClientV3;

	beforeEach(() => {
		vi.clearAllMocks();
		client = new DevinApiClientV3(token, orgId, "https://api.test.devin.ai");
	});

	it("throws DevinOrgIdRequiredError when orgId is empty", () => {
		expect(() => new DevinApiClientV3(token, "")).toThrow(
			DevinOrgIdRequiredError
		);
	});

	describe("createSession", () => {
		it("sends POST to correct v3 endpoint with prompt", async () => {
			mockFetch.mockResolvedValueOnce(
				jsonResponse({
					session_id: "sess-123",
					url: "https://app.devin.ai/sessions/sess-123",
					status: "new",
					acus_consumed: 0,
					created_at: 1_700_000_000,
					updated_at: 1_700_000_000,
					pull_requests: [],
				})
			);

			const result = await client.createSession({
				prompt: "Implement feature X",
				title: "Feature X",
			});

			expect(mockFetch).toHaveBeenCalledOnce();
			const [url, options] = mockFetch.mock.calls[0];
			expect(url).toBe(
				"https://api.test.devin.ai/v3/organizations/org-abc/sessions"
			);
			expect(options.method).toBe("POST");
			expect(JSON.parse(options.body)).toMatchObject({
				prompt: "Implement feature X",
				title: "Feature X",
			});

			expect(result.sessionId).toBe("sess-123");
			expect(result.status).toBe("new");
			expect(result.url).toBe("https://app.devin.ai/sessions/sess-123");
		});

		it("includes repos and tags in the request body", async () => {
			mockFetch.mockResolvedValueOnce(
				jsonResponse({
					session_id: "sess-456",
					url: "",
					status: "new",
					acus_consumed: 0,
					created_at: 1_700_000_000,
					updated_at: 1_700_000_000,
					pull_requests: [],
				})
			);

			await client.createSession({
				prompt: "Fix bug",
				repos: [{ url: "https://github.com/org/repo", branch: "main" }],
				tags: ["urgent"],
			});

			const body = JSON.parse(mockFetch.mock.calls[0][1].body);
			expect(body.repos).toEqual([
				{ url: "https://github.com/org/repo", branch: "main" },
			]);
			expect(body.tags).toEqual(["urgent"]);
		});

		it("throws DevinAuthenticationError on 401", async () => {
			mockFetch.mockResolvedValueOnce(jsonResponse({}, 401));

			await expect(client.createSession({ prompt: "test" })).rejects.toThrow(
				DevinAuthenticationError
			);
		});

		it("throws DevinApiError on 500", async () => {
			mockFetch.mockResolvedValueOnce(jsonResponse({}, 500));

			await expect(client.createSession({ prompt: "test" })).rejects.toThrow(
				DevinApiError
			);
		});

		it("throws DevinNetworkError on fetch failure", async () => {
			mockFetch.mockRejectedValueOnce(new TypeError("Network error"));

			await expect(client.createSession({ prompt: "test" })).rejects.toThrow(
				DevinNetworkError
			);
		});
	});

	describe("getSession", () => {
		it("sends GET to correct v3 endpoint", async () => {
			mockFetch.mockResolvedValueOnce(
				jsonResponse({
					session_id: "sess-123",
					url: "https://app.devin.ai/sessions/sess-123",
					status: "running",
					tags: ["test"],
					org_id: orgId,
					created_at: 1_700_000_000,
					updated_at: 1_700_000_001,
					acus_consumed: 5,
					pull_requests: [{ pr_url: "https://github.com/org/repo/pull/1" }],
					title: "Test Session",
					is_archived: false,
				})
			);

			const result = await client.getSession("sess-123");

			const [url] = mockFetch.mock.calls[0];
			expect(url).toBe(
				"https://api.test.devin.ai/v3/organizations/org-abc/sessions/sess-123"
			);
			expect(result.sessionId).toBe("sess-123");
			expect(result.status).toBe("running");
			expect(result.pullRequests).toHaveLength(1);
			expect(result.pullRequests[0].prUrl).toBe(
				"https://github.com/org/repo/pull/1"
			);
		});
	});

	describe("listSessions", () => {
		it("sends GET with query parameters", async () => {
			mockFetch.mockResolvedValueOnce(
				jsonResponse({
					sessions: [],
					page_info: { has_next_page: false },
				})
			);

			await client.listSessions({ first: 10, tags: ["devin"] });

			const [url] = mockFetch.mock.calls[0];
			expect(url).toContain("first=10");
			expect(url).toContain("tags=devin");
		});
	});

	describe("validateCredentials", () => {
		it("returns true when listSessions succeeds", async () => {
			mockFetch.mockResolvedValueOnce(
				jsonResponse({
					sessions: [],
					page_info: { has_next_page: false },
				})
			);

			const result = await client.validateCredentials();
			expect(result).toBe(true);
		});

		it("returns false when listSessions fails", async () => {
			mockFetch.mockResolvedValueOnce(jsonResponse({}, 401));

			const result = await client.validateCredentials();
			expect(result).toBe(false);
		});
	});
});

describe("DevinApiClientV1", () => {
	const token = "apk_test_token_123";
	let client: DevinApiClientV1;

	beforeEach(() => {
		vi.clearAllMocks();
		client = new DevinApiClientV1(token, "https://api.test.devin.ai");
	});

	describe("createSession", () => {
		it("sends POST to correct v1 endpoint", async () => {
			mockFetch.mockResolvedValueOnce(
				jsonResponse({
					session_id: "sess-v1-123",
					status: "new",
					created_at: "2026-02-25T15:12:44.372811Z",
					updated_at: "2026-02-25T15:12:44.372811Z",
				})
			);

			const result = await client.createSession({
				prompt: "Implement feature",
			});

			const [url, options] = mockFetch.mock.calls[0];
			expect(url).toBe("https://api.test.devin.ai/v1/sessions");
			expect(options.method).toBe("POST");
			expect(result.sessionId).toBe("sess-v1-123");
			expect(result.createdAt).toBeGreaterThan(0);
		});
	});

	describe("getSession", () => {
		it("sends GET to correct v1 endpoint", async () => {
			mockFetch.mockResolvedValueOnce(
				jsonResponse({
					session_id: "sess-v1-123",
					status: "running",
					created_at: "2026-02-25T15:12:44.372811Z",
					updated_at: "2026-02-25T15:12:45.000000Z",
				})
			);

			const result = await client.getSession("sess-v1-123");

			const [url] = mockFetch.mock.calls[0];
			expect(url).toBe("https://api.test.devin.ai/v1/sessions/sess-v1-123");
			expect(result.sessionId).toBe("sess-v1-123");
			expect(result.status).toBe("running");
		});

		it("maps pull_request.url to pullRequests array", async () => {
			mockFetch.mockResolvedValueOnce(
				jsonResponse({
					session_id: "sess-v1-pr",
					status: "suspended",
					status_enum: "finished",
					created_at: "2026-02-25T15:05:13.693954Z",
					updated_at: "2026-02-25T15:51:22.532750Z",
					title: "Task T056: Add feature",
					tags: ["gatomia", "task-T056"],
					pull_request: {
						url: "https://github.com/org/repo/pull/172",
					},
				})
			);

			const result = await client.getSession("sess-v1-pr");

			expect(result.pullRequests).toHaveLength(1);
			expect(result.pullRequests[0].prUrl).toBe(
				"https://github.com/org/repo/pull/172"
			);
			expect(result.statusDetail).toBe("finished");
		});

		it("returns empty pullRequests when pull_request is null", async () => {
			mockFetch.mockResolvedValueOnce(
				jsonResponse({
					session_id: "sess-v1-no-pr",
					status: "exit",
					created_at: "2026-02-25T15:12:44.372811Z",
					updated_at: "2026-02-25T19:15:51.956945Z",
					pull_request: null,
				})
			);

			const result = await client.getSession("sess-v1-no-pr");

			expect(result.pullRequests).toHaveLength(0);
		});
	});
});

describe("createDevinApiClient factory", () => {
	it("returns V3 client for cog_ tokens", () => {
		const client = createDevinApiClient({
			token: "cog_abc123",
			orgId: "org-123",
		});
		expect(client.apiVersion).toBe("v3");
	});

	it("returns V1 client for apk_ tokens", () => {
		const client = createDevinApiClient({ token: "apk_abc123" });
		expect(client.apiVersion).toBe("v1");
	});

	it("throws when v3 token used without orgId", () => {
		expect(() => createDevinApiClient({ token: "cog_abc123" })).toThrow(
			DevinOrgIdRequiredError
		);
	});
});
