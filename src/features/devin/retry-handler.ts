/**
 * Retry Handler with Exponential Backoff
 *
 * Provides automatic retry logic for Devin API calls that fail with
 * transient errors (5xx, network, timeout, rate limit).
 *
 * @see specs/001-devin-integration/research.md:L183-L186
 * @see specs/001-devin-integration/plan.md:L26
 */

import {
	MAX_RETRY_ATTEMPTS,
	RETRY_BASE_DELAY_MS,
	RETRY_MAX_DELAY_MS,
} from "./config";
import {
	DevinMaxRetriesExceededError,
	DevinRateLimitedError,
	isRetryableError,
} from "./errors";

/**
 * Options for configuring retry behavior.
 */
export interface RetryOptions {
	/** Maximum number of retry attempts (default: MAX_RETRY_ATTEMPTS) */
	readonly maxAttempts?: number;
	/** Base delay in milliseconds (default: RETRY_BASE_DELAY_MS) */
	readonly baseDelayMs?: number;
	/** Maximum delay in milliseconds (default: RETRY_MAX_DELAY_MS) */
	readonly maxDelayMs?: number;
	/** Custom function to determine if an error is retryable */
	readonly isRetryable?: (error: unknown) => boolean;
	/** Callback invoked before each retry attempt */
	readonly onRetry?: (attempt: number, error: unknown, delayMs: number) => void;
}

/**
 * Execute an async operation with exponential backoff retry.
 *
 * Retries on transient errors (5xx, network, timeout, rate limit) up to
 * maxAttempts times. Uses exponential backoff: baseDelay * 2^(attempt-1),
 * capped at maxDelay.
 *
 * @param operation - The async function to execute
 * @param options - Retry configuration
 * @returns The result of the operation
 * @throws {DevinMaxRetriesExceededError} If all retry attempts are exhausted
 * @throws The original error if it is not retryable
 */
export async function withRetry<T>(
	operation: () => Promise<T>,
	options?: RetryOptions
): Promise<T> {
	const resolved = resolveOptions(options);
	let lastError: unknown;

	for (let attempt = 1; attempt <= resolved.maxAttempts; attempt++) {
		try {
			return await operation();
		} catch (error: unknown) {
			lastError = error;
			handleRetryError(error, attempt, resolved);
			await waitBeforeRetry(attempt, error, resolved);
		}
	}

	throw new DevinMaxRetriesExceededError(
		resolved.maxAttempts,
		lastError instanceof Error ? lastError : undefined
	);
}

interface ResolvedRetryOptions {
	readonly maxAttempts: number;
	readonly baseDelayMs: number;
	readonly maxDelayMs: number;
	readonly isRetryable: (error: unknown) => boolean;
	readonly onRetry?: (attempt: number, error: unknown, delayMs: number) => void;
}

function resolveOptions(options?: RetryOptions): ResolvedRetryOptions {
	return {
		maxAttempts: options?.maxAttempts ?? MAX_RETRY_ATTEMPTS,
		baseDelayMs: options?.baseDelayMs ?? RETRY_BASE_DELAY_MS,
		maxDelayMs: options?.maxDelayMs ?? RETRY_MAX_DELAY_MS,
		isRetryable: options?.isRetryable ?? isRetryableError,
		onRetry: options?.onRetry,
	};
}

function handleRetryError(
	error: unknown,
	attempt: number,
	options: ResolvedRetryOptions
): void {
	if (!options.isRetryable(error)) {
		throw error;
	}
	if (attempt >= options.maxAttempts) {
		throw new DevinMaxRetriesExceededError(
			options.maxAttempts,
			error instanceof Error ? error : undefined
		);
	}
}

async function waitBeforeRetry(
	attempt: number,
	error: unknown,
	options: ResolvedRetryOptions
): Promise<void> {
	const delayMs = calculateDelay(
		attempt,
		options.baseDelayMs,
		options.maxDelayMs,
		error
	);
	options.onRetry?.(attempt, error, delayMs);
	await sleep(delayMs);
}

/**
 * Calculate the delay for a given retry attempt using exponential backoff.
 * Respects Retry-After headers from rate limit errors.
 *
 * @param attempt - The current attempt number (1-based)
 * @param baseDelayMs - Base delay in milliseconds
 * @param maxDelayMs - Maximum delay cap
 * @param error - The error that triggered the retry
 * @returns Delay in milliseconds with jitter
 */
function calculateDelay(
	attempt: number,
	baseDelayMs: number,
	maxDelayMs: number,
	error: unknown
): number {
	if (error instanceof DevinRateLimitedError && error.retryAfterMs) {
		return Math.min(error.retryAfterMs, maxDelayMs);
	}

	const exponentialDelay = baseDelayMs * 2 ** (attempt - 1);
	const cappedDelay = Math.min(exponentialDelay, maxDelayMs);
	const jitter = Math.random() * cappedDelay * 0.1;

	return Math.floor(cappedDelay + jitter);
}

/**
 * Sleep for the specified duration.
 */
function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
