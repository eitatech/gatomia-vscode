/**
 * Devin API Client Interface
 *
 * Base interface that all API version-specific clients must implement.
 * Provides a unified contract for creating sessions, retrieving session
 * details, and listing sessions regardless of API version.
 *
 * @see specs/001-devin-integration/contracts/devin-api.ts:L220-L232
 */

import type { ApiVersion, DevinApiStatus, DevinStatusDetail } from "./types";

// ============================================================================
// Request Types
// ============================================================================

/**
 * Repository link for session creation
 * @see specs/001-devin-integration/contracts/devin-api.ts:L84-L87
 */
export interface RepositoryLink {
	readonly url: string;
	readonly branch?: string;
}

/**
 * Request payload for creating a new Devin session
 * @see specs/001-devin-integration/contracts/devin-api.ts:L53-L82
 */
export interface CreateSessionRequest {
	/** Task description/prompt (required) */
	readonly prompt: string;
	/** Session title */
	readonly title?: string;
	/** Repository links */
	readonly repos?: RepositoryLink[];
	/** Session tags */
	readonly tags?: string[];
	/** Resource limit */
	readonly maxAcuLimit?: number;
	/** Existing playbook ID */
	readonly playbookId?: string;
}

/**
 * Request payload for listing sessions with filters
 * @see specs/001-devin-integration/contracts/devin-api.ts:L136-L163
 */
export interface ListSessionsRequest {
	/** Cursor for pagination */
	readonly after?: string;
	/** Results per page (1-200, default: 100) */
	readonly first?: number;
	/** Filter by specific session IDs */
	readonly sessionIds?: string[];
	/** Filter by tags */
	readonly tags?: string[];
	/** Filter by creation timestamp (after) */
	readonly createdAfter?: number;
	/** Filter by creation timestamp (before) */
	readonly createdBefore?: number;
}

// ============================================================================
// Response Types
// ============================================================================

/**
 * Pull request information from API response
 * @see specs/001-devin-integration/contracts/devin-api.ts:L127-L130
 */
export interface PullRequestInfo {
	readonly prUrl: string;
	readonly prState?: string;
}

/**
 * Pagination info from list responses
 * @see specs/001-devin-integration/contracts/devin-api.ts:L170-L173
 */
export interface PageInfo {
	readonly hasNextPage: boolean;
	readonly endCursor?: string;
}

/**
 * Response from creating a new session
 * @see specs/001-devin-integration/contracts/devin-api.ts:L89-L99
 */
export interface CreateSessionResponse {
	readonly sessionId: string;
	readonly url: string;
	readonly status: DevinApiStatus;
	readonly acusConsumed: number;
	readonly createdAt: number;
	readonly updatedAt: number;
	readonly pullRequests: PullRequestInfo[];
}

/**
 * Response from getting session details
 * @see specs/001-devin-integration/contracts/devin-api.ts:L105-L125
 */
export interface GetSessionResponse {
	readonly sessionId: string;
	readonly url: string;
	readonly status: DevinApiStatus;
	readonly statusDetail?: DevinStatusDetail;
	readonly tags: string[];
	readonly createdAt: number;
	readonly updatedAt: number;
	readonly acusConsumed: number;
	readonly pullRequests: PullRequestInfo[];
	readonly title?: string;
	readonly isArchived: boolean;
}

/**
 * Response from listing sessions
 * @see specs/001-devin-integration/contracts/devin-api.ts:L165-L168
 */
export interface ListSessionsResponse {
	readonly sessions: GetSessionResponse[];
	readonly pageInfo: PageInfo;
}

// ============================================================================
// Client Interface
// ============================================================================

/**
 * Base interface for Devin API clients.
 * Version-specific implementations (v1, v3) must implement this contract.
 *
 * @see specs/001-devin-integration/contracts/devin-api.ts:L220-L232
 */
export interface DevinApiClientInterface {
	/** The API version this client targets */
	readonly apiVersion: ApiVersion;

	/** Create a new Devin session */
	createSession(request: CreateSessionRequest): Promise<CreateSessionResponse>;

	/** Get details of a specific session */
	getSession(sessionId: string): Promise<GetSessionResponse>;

	/** List sessions with optional filters */
	listSessions(request?: ListSessionsRequest): Promise<ListSessionsResponse>;

	/** Validate that credentials are working */
	validateCredentials(): Promise<boolean>;
}
