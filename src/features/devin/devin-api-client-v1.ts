/**
 * Devin API Client - v1/v2 Implementation
 *
 * Implements the DevinApiClientInterface for Devin API v1 and v2.
 * Legacy API uses personal (apk_user_*) or service (apk_*) tokens
 * with simpler, non-organization-scoped endpoints.
 *
 * @see specs/001-devin-integration/research.md:L38-L41
 * @see specs/001-devin-integration/contracts/devin-api.ts:L253-L272
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
import { ApiVersion } from "./types";

// ============================================================================
// v1/v2 Client Implementation
// ============================================================================

/**
 * Devin API v1/v2 client.
 * v1 and v2 share the same endpoints. Simpler than v3: no org scoping.
 */
export class DevinApiClientV1 implements DevinApiClientInterface {
	readonly apiVersion = ApiVersion.V1;

	private readonly token: string;
	private readonly baseUrl: string;

	constructor(token: string, baseUrl = DEVIN_API_BASE_URL) {
		this.token = token;
		this.baseUrl = baseUrl;
	}

	async createSession(
		request: CreateSessionRequest
	): Promise<CreateSessionResponse> {
		const url = `${this.baseUrl}${API_PATH_PREFIX.V1}/sessions`;

		const body = {
			prompt: request.prompt,
			...(request.title && { title: request.title }),
			...(request.repos && { repos: request.repos }),
			...(request.playbookId && { playbook_id: request.playbookId }),
			...(request.tags && { tags: request.tags }),
		};

		const raw = await devinApiRequest<RawV1CreateSessionResponse>(
			url,
			{ method: "POST", body: JSON.stringify(body) },
			this.token,
			"v1"
		);

		return mapV1CreateSessionResponse(raw);
	}

	async getSession(sessionId: string): Promise<GetSessionResponse> {
		const url = `${this.baseUrl}${API_PATH_PREFIX.V1}/sessions/${sessionId}`;
		const raw = await devinApiRequest<RawV1GetSessionResponse>(
			url,
			{ method: "GET" },
			this.token,
			"v1"
		);
		return mapV1GetSessionResponse(raw);
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
		if (request?.sessionIds) {
			for (const id of request.sessionIds) {
				params.append("session_ids", id);
			}
		}
		if (request?.tags) {
			for (const tag of request.tags) {
				params.append("tags", tag);
			}
		}

		const query = params.toString();
		const url = `${this.baseUrl}${API_PATH_PREFIX.V1}/sessions${query ? `?${query}` : ""}`;

		const raw = await devinApiRequest<RawV1ListSessionsResponse>(
			url,
			{ method: "GET" },
			this.token,
			"v1"
		);

		return {
			sessions: (raw.sessions ?? []).map(mapV1GetSessionResponse),
			pageInfo: {
				hasNextPage: false,
				endCursor: undefined,
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

interface RawV1CreateSessionResponse {
	session_id: string;
	url?: string;
	status: string;
	created_at: string | number;
	updated_at: string | number;
	pull_request?: { url: string; state?: string } | null;
}

interface RawV1GetSessionResponse {
	session_id: string;
	status: string;
	status_enum?: string;
	created_at: string | number;
	updated_at: string | number;
	title?: string;
	tags?: string[];
	pull_request?: { url: string; state?: string } | null;
	snapshot_id?: string;
	structured_output?: object;
}

interface RawV1ListSessionsResponse {
	sessions?: RawV1GetSessionResponse[];
}

// ============================================================================
// Response mappers (snake_case -> camelCase)
// ============================================================================

function parseTimestamp(value: string | number): number {
	if (typeof value === "number") {
		return value;
	}
	const parsed = new Date(value).getTime();
	return Number.isNaN(parsed) ? 0 : parsed;
}

function mapV1CreateSessionResponse(
	raw: RawV1CreateSessionResponse
): CreateSessionResponse {
	const pullRequests = raw.pull_request
		? [{ prUrl: raw.pull_request.url, prState: raw.pull_request.state }]
		: [];

	return {
		sessionId: raw.session_id,
		url: raw.url ?? "",
		status: raw.status as CreateSessionResponse["status"],
		acusConsumed: 0,
		createdAt: parseTimestamp(raw.created_at),
		updatedAt: parseTimestamp(raw.updated_at),
		pullRequests,
	};
}

function mapV1GetSessionResponse(
	raw: RawV1GetSessionResponse
): GetSessionResponse {
	const pullRequests = raw.pull_request
		? [{ prUrl: raw.pull_request.url, prState: raw.pull_request.state }]
		: [];

	return {
		sessionId: raw.session_id,
		url: "",
		status: raw.status as GetSessionResponse["status"],
		statusDetail: raw.status_enum,
		tags: raw.tags ?? [],
		createdAt: parseTimestamp(raw.created_at),
		updatedAt: parseTimestamp(raw.updated_at),
		acusConsumed: 0,
		pullRequests,
		title: raw.title,
		isArchived: false,
	};
}
