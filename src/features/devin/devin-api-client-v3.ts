/**
 * Devin API Client - v3 Implementation
 *
 * Implements the DevinApiClientInterface for Devin API v3.
 * v3 uses service user tokens (cog_* prefix) with organization-scoped endpoints.
 *
 * @see specs/001-devin-integration/research.md:L28-L36
 * @see specs/001-devin-integration/contracts/devin-api.ts:L244-L247
 */

import { DEVIN_API_BASE_URL, API_PATH_PREFIX } from "./config";
import type {
	CreateSessionRequest,
	CreateSessionResponse,
	DevinApiClientInterface,
	GetSessionResponse,
	ListSessionsRequest,
	ListSessionsResponse,
} from "./devin-api-client";
import {
	DevinApiError,
	DevinAuthenticationError,
	DevinNetworkError,
	DevinOrgIdRequiredError,
	DevinRateLimitedError,
	DevinTimeoutError,
} from "./errors";
import { ApiVersion } from "./types";

// ============================================================================
// v3 Client Implementation
// ============================================================================

/**
 * Devin API v3 client.
 * All endpoints are scoped to an organization: /v3/organizations/{org_id}/sessions
 */
export class DevinApiClientV3 implements DevinApiClientInterface {
	readonly apiVersion = ApiVersion.V3;

	private readonly token: string;
	private readonly orgId: string;
	private readonly baseUrl: string;

	constructor(token: string, orgId: string, baseUrl = DEVIN_API_BASE_URL) {
		if (!orgId || orgId.trim().length === 0) {
			throw new DevinOrgIdRequiredError();
		}
		this.token = token;
		this.orgId = orgId.trim();
		this.baseUrl = baseUrl;
	}

	async createSession(
		request: CreateSessionRequest
	): Promise<CreateSessionResponse> {
		const url = `${this.baseUrl}${API_PATH_PREFIX.V3}/organizations/${this.orgId}/sessions`;

		const body = {
			prompt: request.prompt,
			...(request.title && { title: request.title }),
			...(request.repos && { repos: request.repos }),
			...(request.tags && { tags: request.tags }),
			...(request.maxAcuLimit !== undefined && {
				max_acu_limit: request.maxAcuLimit,
			}),
			...(request.playbookId && { playbook_id: request.playbookId }),
		};

		const raw = await this.request<RawCreateSessionResponse>(url, {
			method: "POST",
			body: JSON.stringify(body),
		});

		return mapCreateSessionResponse(raw);
	}

	async getSession(sessionId: string): Promise<GetSessionResponse> {
		const url = `${this.baseUrl}${API_PATH_PREFIX.V3}/organizations/${this.orgId}/sessions/${sessionId}`;
		const raw = await this.request<RawGetSessionResponse>(url, {
			method: "GET",
		});
		return mapGetSessionResponse(raw);
	}

	async listSessions(
		request?: ListSessionsRequest
	): Promise<ListSessionsResponse> {
		const params = new URLSearchParams();

		if (request?.after) {
			params.set("after", request.after);
		}
		if (request?.first !== undefined) {
			params.set("first", String(request.first));
		}
		if (request?.tags) {
			for (const tag of request.tags) {
				params.append("tags", tag);
			}
		}
		if (request?.sessionIds) {
			for (const id of request.sessionIds) {
				params.append("session_ids", id);
			}
		}
		if (request?.createdAfter !== undefined) {
			params.set("created_after", String(request.createdAfter));
		}
		if (request?.createdBefore !== undefined) {
			params.set("created_before", String(request.createdBefore));
		}

		const query = params.toString();
		const url = `${this.baseUrl}${API_PATH_PREFIX.V3}/organizations/${this.orgId}/sessions${query ? `?${query}` : ""}`;

		const raw = await this.request<RawListSessionsResponse>(url, {
			method: "GET",
		});

		return {
			sessions: raw.sessions.map(mapGetSessionResponse),
			pageInfo: {
				hasNextPage: raw.page_info?.has_next_page ?? false,
				endCursor: raw.page_info?.end_cursor,
			},
		};
	}

	async validateCredentials(): Promise<boolean> {
		try {
			await this.listSessions({ first: 1 });
			return true;
		} catch {
			return false;
		}
	}

	// ============================================================================
	// Private HTTP helper
	// ============================================================================

	private async request<T>(url: string, init: RequestInit): Promise<T> {
		const headers: Record<string, string> = {
			Authorization: `Bearer ${this.token}`,
			"Content-Type": "application/json",
			Accept: "application/json",
		};

		let response: Response;
		try {
			response = await fetch(url, { ...init, headers });
		} catch (error: unknown) {
			if (error instanceof Error && error.name === "AbortError") {
				throw new DevinTimeoutError(undefined, { url });
			}
			const message = error instanceof Error ? error.message : String(error);
			throw new DevinNetworkError(message, { url });
		}

		if (response.status === 401 || response.status === 403) {
			throw new DevinAuthenticationError(undefined, {
				url,
				statusCode: response.status,
			});
		}

		if (response.status === 429) {
			const retryAfterMs = parseRetryAfterMs(
				response.headers.get("Retry-After")
			);
			throw new DevinRateLimitedError(retryAfterMs, { url });
		}

		if (!response.ok) {
			let errorBody: string | undefined;
			try {
				errorBody = await response.text();
			} catch {
				// ignore read errors
			}
			throw new DevinApiError(
				response.status,
				`Devin API v3 error: ${response.status} ${response.statusText}`,
				undefined,
				{ url, body: errorBody }
			);
		}

		return (await response.json()) as T;
	}
}

// ============================================================================
// Raw API response shapes (snake_case from API)
// ============================================================================

interface RawCreateSessionResponse {
	session_id: string;
	url: string;
	status: string;
	acus_consumed: number;
	created_at: number;
	updated_at: number;
	pull_requests: Array<{ pr_url: string; pr_state?: string }>;
	user_id?: string;
	playbook_id?: string;
}

interface RawGetSessionResponse {
	session_id: string;
	url: string;
	status: string;
	status_detail?: string;
	tags?: string[];
	org_id?: string;
	created_at: number;
	updated_at: number;
	acus_consumed: number;
	pull_requests: Array<{ pr_url: string; pr_state?: string }>;
	title?: string;
	is_archived?: boolean;
}

interface RawListSessionsResponse {
	sessions: RawGetSessionResponse[];
	page_info?: {
		has_next_page: boolean;
		end_cursor?: string;
	};
}

// ============================================================================
// Response mappers (snake_case -> camelCase)
// ============================================================================

/**
 * Parse the HTTP Retry-After header value into milliseconds.
 * Handles both numeric seconds and HTTP-date formats.
 *
 * @returns Milliseconds to wait, or undefined if the header is absent or unparseable
 */
function parseRetryAfterMs(value: string | null): number | undefined {
	if (!value) {
		return;
	}
	const seconds = Number.parseInt(value, 10);
	if (!Number.isNaN(seconds)) {
		return seconds * 1000;
	}
	const date = Date.parse(value);
	if (!Number.isNaN(date)) {
		return Math.max(0, date - Date.now());
	}
	return;
}

function mapCreateSessionResponse(
	raw: RawCreateSessionResponse
): CreateSessionResponse {
	return {
		sessionId: raw.session_id,
		url: raw.url,
		status: raw.status as CreateSessionResponse["status"],
		acusConsumed: raw.acus_consumed,
		createdAt: raw.created_at,
		updatedAt: raw.updated_at,
		pullRequests: raw.pull_requests.map((pr) => ({
			prUrl: pr.pr_url,
			prState: pr.pr_state,
		})),
	};
}

function mapGetSessionResponse(raw: RawGetSessionResponse): GetSessionResponse {
	return {
		sessionId: raw.session_id,
		url: raw.url,
		status: raw.status as GetSessionResponse["status"],
		statusDetail: raw.status_detail as GetSessionResponse["statusDetail"],
		tags: raw.tags ?? [],
		createdAt: raw.created_at,
		updatedAt: raw.updated_at,
		acusConsumed: raw.acus_consumed,
		pullRequests: raw.pull_requests.map((pr) => ({
			prUrl: pr.pr_url,
			prState: pr.pr_state,
		})),
		title: raw.title,
		isArchived: raw.is_archived ?? false,
	};
}
