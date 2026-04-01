/**
 * Shared HTTP Utilities for Devin API Clients
 *
 * Provides the common authenticated HTTP request handler and Retry-After
 * header parser used by both v1 and v3 API client implementations.
 *
 * @see specs/001-devin-integration/contracts/devin-api.ts
 */

import {
	DevinApiError,
	DevinAuthenticationError,
	DevinNetworkError,
	DevinRateLimitedError,
	DevinTimeoutError,
} from "./errors";

/**
 * Perform an authenticated JSON request against the Devin API.
 *
 * Handles common error mapping (auth, rate-limit, timeout, network)
 * so that individual API client implementations only need to build
 * the URL and body, then map the successful response.
 *
 * @param url - Fully-qualified request URL
 * @param init - Standard RequestInit (method, body, etc.)
 * @param token - Bearer token for Authorization header
 * @param apiVersionLabel - Label for error messages (e.g. "v1", "v3")
 * @returns Parsed JSON response body
 */
export async function devinApiRequest<T>(
	url: string,
	init: RequestInit,
	token: string,
	apiVersionLabel: string
): Promise<T> {
	const headers: Record<string, string> = {
		Authorization: `Bearer ${token}`,
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
		const retryAfterMs = parseRetryAfterMs(response.headers.get("Retry-After"));
		throw new DevinRateLimitedError(retryAfterMs, { url });
	}

	if (!response.ok) {
		let errorBody: string | undefined;
		try {
			errorBody = await response.text();
		} catch {
			// ignore read errors
		}
		const detail = extractApiErrorDetail(errorBody);
		const message = detail
			? `Devin API ${apiVersionLabel} error: ${response.status} - ${detail}`
			: `Devin API ${apiVersionLabel} error: ${response.status} ${response.statusText}`;
		throw new DevinApiError(response.status, message, undefined, {
			url,
			body: errorBody,
		});
	}

	return (await response.json()) as T;
}

/**
 * Parse the HTTP Retry-After header value into milliseconds.
 * Handles both numeric seconds and HTTP-date formats.
 *
 * @returns Milliseconds to wait, or undefined if the header is absent or unparseable
 */
export function parseRetryAfterMs(value: string | null): number | undefined {
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

/**
 * Extract a human-readable error detail from a Devin API error response body.
 * Tries to parse JSON and extract common error fields.
 */
function extractApiErrorDetail(body: string | undefined): string | undefined {
	if (!body) {
		return;
	}
	try {
		const parsed = JSON.parse(body) as Record<string, unknown>;
		if (typeof parsed.detail === "string") {
			return parsed.detail;
		}
		if (typeof parsed.message === "string") {
			return parsed.message;
		}
		if (typeof parsed.error === "string") {
			return parsed.error;
		}
		return body.slice(0, 300);
	} catch {
		return body.slice(0, 300);
	}
}
