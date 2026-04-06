/**
 * Rate Limiting Protection
 *
 * Provides client-side rate limiting to avoid hitting Devin API limits.
 * Tracks request timestamps and enforces a minimum interval between calls.
 *
 * @see specs/001-devin-integration/research.md:L197-L198
 */

import { DevinRateLimitedError } from "./errors";

/**
 * Default minimum interval between API requests (milliseconds).
 */
const DEFAULT_MIN_INTERVAL_MS = 500;

/**
 * Default maximum requests per minute.
 */
const DEFAULT_MAX_REQUESTS_PER_MINUTE = 60;

/**
 * Client-side rate limiter for Devin API requests.
 */
export class RateLimiter {
	private readonly minIntervalMs: number;
	private readonly maxPerMinute: number;
	private readonly timestamps: number[] = [];
	private lastRequestTime = 0;

	constructor(
		minIntervalMs = DEFAULT_MIN_INTERVAL_MS,
		maxPerMinute = DEFAULT_MAX_REQUESTS_PER_MINUTE
	) {
		this.minIntervalMs = minIntervalMs;
		this.maxPerMinute = maxPerMinute;
	}

	/**
	 * Check if a request is allowed. Throws if rate limit would be exceeded.
	 *
	 * @throws {DevinRateLimitedError} If the rate limit would be exceeded
	 */
	checkLimit(): void {
		const now = Date.now();

		if (now - this.lastRequestTime < this.minIntervalMs) {
			throw new DevinRateLimitedError(this.minIntervalMs);
		}

		const oneMinuteAgo = now - 60_000;
		const recentCount = this.timestamps.filter((t) => t > oneMinuteAgo).length;
		if (recentCount >= this.maxPerMinute) {
			throw new DevinRateLimitedError(60_000);
		}
	}

	/**
	 * Record that a request was made.
	 */
	recordRequest(): void {
		const now = Date.now();
		this.lastRequestTime = now;
		this.timestamps.push(now);

		const oneMinuteAgo = now - 60_000;
		while (this.timestamps.length > 0 && this.timestamps[0] < oneMinuteAgo) {
			this.timestamps.shift();
		}
	}

	/**
	 * Acquire permission to make a request (check + record).
	 *
	 * @throws {DevinRateLimitedError} If the rate limit would be exceeded
	 */
	acquire(): void {
		this.checkLimit();
		this.recordRequest();
	}
}
