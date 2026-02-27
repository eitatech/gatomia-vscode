/**
 * Devin API Error Types
 *
 * Custom error classes for the Devin integration feature.
 * Provides structured error handling with error codes and context.
 *
 * @see specs/001-devin-integration/contracts/devin-api.ts:L199-L214
 */

// ============================================================================
// Error Codes
// ============================================================================

/**
 * Devin-specific error codes for programmatic error handling
 */
export const DevinErrorCode = {
	/** API returned an error response */
	API_ERROR: "DEVIN_API_ERROR",
	/** API request timed out */
	TIMEOUT: "DEVIN_TIMEOUT",
	/** Network connectivity issue */
	NETWORK_ERROR: "DEVIN_NETWORK_ERROR",
	/** Invalid or expired credentials */
	AUTHENTICATION_FAILED: "DEVIN_AUTH_FAILED",
	/** Missing or invalid credentials */
	CREDENTIALS_NOT_FOUND: "DEVIN_CREDENTIALS_NOT_FOUND",
	/** Unknown API token format */
	INVALID_TOKEN_FORMAT: "DEVIN_INVALID_TOKEN_FORMAT",
	/** Organization ID required but not provided */
	ORG_ID_REQUIRED: "DEVIN_ORG_ID_REQUIRED",
	/** Session not found */
	SESSION_NOT_FOUND: "DEVIN_SESSION_NOT_FOUND",
	/** Rate limit exceeded */
	RATE_LIMITED: "DEVIN_RATE_LIMITED",
	/** Request validation failed */
	VALIDATION_ERROR: "DEVIN_VALIDATION_ERROR",
	/** Maximum retry attempts exceeded */
	MAX_RETRIES_EXCEEDED: "DEVIN_MAX_RETRIES_EXCEEDED",
	/** Session is in an invalid state for the requested operation */
	INVALID_SESSION_STATE: "DEVIN_INVALID_SESSION_STATE",
} as const;
export type DevinErrorCode =
	(typeof DevinErrorCode)[keyof typeof DevinErrorCode];

// ============================================================================
// Base Error
// ============================================================================

/**
 * Base error class for all Devin integration errors.
 * Provides error code and optional context for debugging.
 */
export class DevinError extends Error {
	readonly code: DevinErrorCode;
	readonly context?: Record<string, unknown>;

	constructor(
		code: DevinErrorCode,
		message: string,
		context?: Record<string, unknown>
	) {
		super(message);
		Object.setPrototypeOf(this, new.target.prototype);
		this.name = "DevinError";
		this.code = code;
		this.context = context;
	}
}

// ============================================================================
// API Errors
// ============================================================================

/**
 * Error thrown when the Devin API returns an error response.
 * Includes HTTP status code and API error details.
 */
export class DevinApiError extends DevinError {
	readonly statusCode: number;
	readonly errorCode?: string;

	constructor(
		statusCode: number,
		message: string,
		errorCode?: string,
		context?: Record<string, unknown>
	) {
		super(DevinErrorCode.API_ERROR, message, {
			...context,
			statusCode,
			errorCode,
		});
		this.name = "DevinApiError";
		this.statusCode = statusCode;
		this.errorCode = errorCode;
	}

	/** Whether this error is retryable (5xx server errors) */
	get isRetryable(): boolean {
		return this.statusCode >= 500;
	}
}

/**
 * Error thrown when API request times out.
 */
export class DevinTimeoutError extends DevinError {
	constructor(
		message = "Devin API request timed out",
		context?: Record<string, unknown>
	) {
		super(DevinErrorCode.TIMEOUT, message, context);
		this.name = "DevinTimeoutError";
	}
}

/**
 * Error thrown on network connectivity issues.
 */
export class DevinNetworkError extends DevinError {
	constructor(
		message = "Network error communicating with Devin API",
		context?: Record<string, unknown>
	) {
		super(DevinErrorCode.NETWORK_ERROR, message, context);
		this.name = "DevinNetworkError";
	}
}

// ============================================================================
// Authentication Errors
// ============================================================================

/**
 * Error thrown when authentication fails (401/403).
 */
export class DevinAuthenticationError extends DevinError {
	constructor(
		message = "Devin API authentication failed",
		context?: Record<string, unknown>
	) {
		super(DevinErrorCode.AUTHENTICATION_FAILED, message, context);
		this.name = "DevinAuthenticationError";
	}
}

/**
 * Error thrown when credentials are not configured.
 */
export class DevinCredentialsNotFoundError extends DevinError {
	constructor(
		message = "Devin API credentials not found. Please configure via command palette.",
		context?: Record<string, unknown>
	) {
		super(DevinErrorCode.CREDENTIALS_NOT_FOUND, message, context);
		this.name = "DevinCredentialsNotFoundError";
	}
}

/**
 * Error thrown when API token format is not recognized.
 */
export class DevinInvalidTokenError extends DevinError {
	constructor(
		message = "Unknown API token format. Expected cog_* (v3) or apk_* (v1/v2).",
		context?: Record<string, unknown>
	) {
		super(DevinErrorCode.INVALID_TOKEN_FORMAT, message, context);
		this.name = "DevinInvalidTokenError";
	}
}

/**
 * Error thrown when organization ID is required but not provided (v3).
 */
export class DevinOrgIdRequiredError extends DevinError {
	constructor(
		message = "Organization ID is required for v3 API.",
		context?: Record<string, unknown>
	) {
		super(DevinErrorCode.ORG_ID_REQUIRED, message, context);
		this.name = "DevinOrgIdRequiredError";
	}
}

// ============================================================================
// Session Errors
// ============================================================================

/**
 * Error thrown when a session cannot be found.
 */
export class DevinSessionNotFoundError extends DevinError {
	constructor(sessionId: string, context?: Record<string, unknown>) {
		super(
			DevinErrorCode.SESSION_NOT_FOUND,
			`Devin session not found: ${sessionId}`,
			{ ...context, sessionId }
		);
		this.name = "DevinSessionNotFoundError";
	}
}

/**
 * Error thrown when a session operation is invalid for its current state.
 */
export class DevinInvalidSessionStateError extends DevinError {
	constructor(
		sessionId: string,
		currentState: string,
		expectedStates: string[],
		context?: Record<string, unknown>
	) {
		super(
			DevinErrorCode.INVALID_SESSION_STATE,
			`Session ${sessionId} is in state '${currentState}', expected one of: ${expectedStates.join(", ")}`,
			{ ...context, sessionId, currentState, expectedStates }
		);
		this.name = "DevinInvalidSessionStateError";
	}
}

// ============================================================================
// Rate Limiting
// ============================================================================

/**
 * Error thrown when rate limit is exceeded.
 */
export class DevinRateLimitedError extends DevinError {
	readonly retryAfterMs?: number;

	constructor(retryAfterMs?: number, context?: Record<string, unknown>) {
		super(DevinErrorCode.RATE_LIMITED, "Devin API rate limit exceeded", {
			...context,
			retryAfterMs,
		});
		this.name = "DevinRateLimitedError";
		this.retryAfterMs = retryAfterMs;
	}
}

// ============================================================================
// Retry Errors
// ============================================================================

/**
 * Error thrown when maximum retry attempts have been exceeded.
 */
export class DevinMaxRetriesExceededError extends DevinError {
	readonly attempts: number;
	readonly lastError?: Error;

	constructor(
		attempts: number,
		lastError?: Error,
		context?: Record<string, unknown>
	) {
		super(
			DevinErrorCode.MAX_RETRIES_EXCEEDED,
			`Maximum retry attempts (${attempts}) exceeded`,
			{ ...context, attempts, lastErrorMessage: lastError?.message }
		);
		this.name = "DevinMaxRetriesExceededError";
		this.attempts = attempts;
		this.lastError = lastError;
	}
}

// ============================================================================
// Validation Errors
// ============================================================================

/**
 * Error thrown when request validation fails.
 */
export class DevinValidationError extends DevinError {
	readonly validationDetails?: Array<{
		loc: (string | number)[];
		msg: string;
		type: string;
	}>;

	constructor(
		message: string,
		validationDetails?: Array<{
			loc: (string | number)[];
			msg: string;
			type: string;
		}>,
		context?: Record<string, unknown>
	) {
		super(DevinErrorCode.VALIDATION_ERROR, message, {
			...context,
			validationDetails,
		});
		this.name = "DevinValidationError";
		this.validationDetails = validationDetails;
	}
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if an error is a DevinError
 */
export function isDevinError(error: unknown): error is DevinError {
	return error instanceof DevinError;
}

/**
 * Check if an error is retryable
 */
export function isRetryableError(error: unknown): boolean {
	if (error instanceof DevinApiError) {
		return error.isRetryable;
	}
	if (error instanceof DevinNetworkError) {
		return true;
	}
	if (error instanceof DevinTimeoutError) {
		return true;
	}
	if (error instanceof DevinRateLimitedError) {
		return true;
	}
	return false;
}
