/**
 * Devin API Contract
 *
 * TypeScript interfaces for Devin API v1, v2, and v3.
 * Based on: https://docs.devin.ai/api-reference/overview
 */

// ============================================================================
// API Version Detection
// ============================================================================

export type ApiVersion = "v1" | "v2" | "v3";

/**
 * Detect API version from token prefix
 * - cog_* -> v3
 * - apk_user_* -> v1/v2 (personal)
 * - apk_* -> v1/v2 (service)
 */
export function detectApiVersion(token: string): ApiVersion {
	if (token.startsWith("cog_")) {
		return "v3";
	}
	if (token.startsWith("apk_")) {
		return "v1"; // v1 and v2 use same endpoints
	}
	throw new Error("Unknown API token format");
}

// ============================================================================
// Authentication
// ============================================================================

export interface DevinCredentials {
	/** API token (encrypted at rest) */
	readonly apiKey: string;
	/** Detected API version */
	readonly apiVersion: ApiVersion;
	/** Organization ID (v3 only) */
	readonly orgId?: string;
	/** When credentials were added */
	readonly createdAt: number;
	/** Last successful API call */
	readonly lastUsedAt?: number;
	/** Validation status */
	readonly isValid: boolean;
}

// ============================================================================
// Session Creation
// ============================================================================

export interface CreateSessionRequest {
	/** Task description/prompt (required) */
	readonly prompt: string;
	/** Session title */
	readonly title?: string;
	/** Mode: analyze | create | improve | batch | manage */
	readonly advancedMode?: string;
	/** URLs to attach to session */
	readonly attachmentUrls?: string[];
	/** Skip approval for batch mode */
	readonly bypassApproval?: boolean;
	/** Impersonate another user (requires permission) */
	readonly createAsUserId?: string;
	/** Knowledge base IDs */
	readonly knowledgeIds?: string[];
	/** Resource limit */
	readonly maxAcuLimit?: number;
	/** Existing playbook ID */
	readonly playbookId?: string;
	/** Repository links */
	readonly repos?: RepositoryLink[];
	/** Pre-existing secret IDs */
	readonly secretIds?: string[];
	/** Session references */
	readonly sessionLinks?: string[];
	/** JSON validation schema */
	readonly structuredOutputSchema?: object;
	/** Session tags */
	readonly tags?: string[];
}

export interface RepositoryLink {
	readonly url: string;
	readonly branch?: string;
}

export interface CreateSessionResponse {
	readonly sessionId: string;
	readonly url: string;
	readonly status: DevinApiStatus;
	readonly acusConsumed: number;
	readonly createdAt: number;
	readonly updatedAt: number;
	readonly pullRequests: PullRequestInfo[];
	readonly userId?: string;
	readonly playbookId?: string;
}

// ============================================================================
// Session Retrieval
// ============================================================================

export interface GetSessionResponse {
	readonly sessionId: string;
	readonly url: string;
	readonly status: DevinApiStatus;
	readonly statusDetail?: DevinStatusDetail;
	readonly tags: string[];
	readonly orgId: string;
	readonly createdAt: number;
	readonly updatedAt: number;
	readonly acusConsumed: number;
	readonly pullRequests: PullRequestInfo[];
	readonly title?: string;
	readonly userId?: string;
	readonly parentSessionId?: string;
	readonly childSessionIds?: string[];
	readonly playbookId?: string;
	readonly isAdvanced: boolean;
	readonly isArchived: boolean;
	readonly structuredOutput?: object;
	readonly serviceUserId?: string;
}

export interface PullRequestInfo {
	readonly prUrl: string;
	readonly prState?: string;
}

// ============================================================================
// Session Listing
// ============================================================================

export interface ListSessionsRequest {
	/** Cursor for pagination */
	readonly after?: string;
	/** Results per page (1-200, default: 100) */
	readonly first?: number;
	/** Filter by specific session IDs */
	readonly sessionIds?: string[];
	/** Filter by creation timestamp (after) */
	readonly createdAfter?: number;
	/** Filter by creation timestamp (before) */
	readonly createdBefore?: number;
	/** Filter by update timestamp (after) */
	readonly updatedAfter?: number;
	/** Filter by update timestamp (before) */
	readonly updatedBefore?: number;
	/** Filter by tags */
	readonly tags?: string[];
	/** Filter by playbook ID */
	readonly playbookId?: string;
	/** Filter by source (webapp, slack, etc.) */
	readonly origins?: string[];
	/** Filter by schedule ID */
	readonly scheduleId?: string;
	/** Filter by user IDs */
	readonly userIds?: string[];
	/** Filter by service user IDs */
	readonly serviceUserIds?: string[];
}

export interface ListSessionsResponse {
	readonly sessions: GetSessionResponse[];
	readonly pageInfo: PageInfo;
}

export interface PageInfo {
	readonly hasNextPage: boolean;
	readonly endCursor?: string;
}

// ============================================================================
// Status Enums
// ============================================================================

export enum DevinApiStatus {
	NEW = "new",
	CLAIMED = "claimed",
	RUNNING = "running",
	EXIT = "exit",
	ERROR = "error",
	SUSPENDED = "suspended",
	RESUMING = "resuming"
}

export type DevinStatusDetail =
	| "working"
	| "waiting_for_user"
	| "finished"
	| string;

// ============================================================================
// Error Handling
// ============================================================================

export interface DevinApiError {
	readonly statusCode: number;
	readonly errorCode: string;
	readonly message: string;
	readonly details?: object;
}

export interface ValidationError {
	readonly loc: (string | number)[];
	readonly msg: string;
	readonly type: string;
}

export interface HTTPValidationError {
	readonly detail: ValidationError[];
}

// ============================================================================
// API Client Interface
// ============================================================================

export interface DevinApiClient {
	/** Create a new Devin session */
	createSession(request: CreateSessionRequest): Promise<CreateSessionResponse>;

	/** Get details of a specific session */
	getSession(sessionId: string): Promise<GetSessionResponse>;

	/** List sessions with optional filters */
	listSessions(request?: ListSessionsRequest): Promise<ListSessionsResponse>;

	/** Validate credentials are working */
	validateCredentials(): Promise<boolean>;
}

// ============================================================================
// v3 Specific Types
// ============================================================================

export interface V3SessionSecrets {
	readonly key: string; // 1-256 chars
	readonly value: string; // up to 65536 chars
	readonly sensitive?: boolean; // default: true
}

export interface V3CreateSessionRequest extends CreateSessionRequest {
	/** Session secrets (v3 only) */
	readonly secrets?: V3SessionSecrets[];
}

// ============================================================================
// Legacy v1/v2 Types
// ============================================================================

export interface V1CreateSessionRequest {
	readonly prompt: string;
	readonly title?: string;
	readonly playbookId?: string;
	readonly tags?: string[];
}

export interface V1GetSessionResponse {
	readonly sessionId: string;
	readonly status: string;
	readonly createdAt: number;
	readonly updatedAt: number;
	readonly messages?: object[];
	readonly playbookId?: string;
	readonly pullRequest?: PullRequestInfo;
	readonly snapshotId?: string;
	readonly structuredOutput?: object;
	readonly tags?: string[];
	readonly title?: string;
}
