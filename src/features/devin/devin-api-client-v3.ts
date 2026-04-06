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
import { devinApiRequest } from "./devin-api-http";
import { DevinOrgIdRequiredError } from "./errors";
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

		const raw = await devinApiRequest<RawCreateSessionResponse>(
			url,
			{ method: "POST", body: JSON.stringify(body) },
			this.token,
			"v3"
		);

		return mapCreateSessionResponse(raw);
	}

	async getSession(sessionId: string): Promise<GetSessionResponse> {
		const url = `${this.baseUrl}${API_PATH_PREFIX.V3}/organizations/${this.orgId}/sessions/${sessionId}`;
		const raw = await devinApiRequest<RawGetSessionResponse>(
			url,
			{ method: "GET" },
			this.token,
			"v3"
		);
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

		const raw = await devinApiRequest<RawListSessionsResponse>(
			url,
			{ method: "GET" },
			this.token,
			"v3"
		);

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
