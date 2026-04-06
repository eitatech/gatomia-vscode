/**
 * Devin API Unavailable Error Handler
 *
 * Detects when the Devin API is completely unavailable and provides
 * user-friendly messaging with retry suggestions.
 *
 * @see specs/001-devin-integration/spec.md (Edge Case: API unavailable)
 */

import { window } from "vscode";
import { DevinNetworkError, DevinTimeoutError } from "./errors";
import { logError } from "./logging";

/**
 * Check if an error indicates the Devin API is unavailable.
 */
export function isApiUnavailableError(error: unknown): boolean {
	return (
		error instanceof DevinNetworkError || error instanceof DevinTimeoutError
	);
}

/**
 * Handle Devin API unavailable scenario with user notification.
 */
export async function handleApiUnavailable(error: unknown): Promise<void> {
	logError("Devin API unavailable", error);

	const result = await window.showErrorMessage(
		"Devin API is currently unavailable. This may be a temporary issue.",
		"Check Status",
		"Retry Later"
	);

	if (result === "Check Status") {
		const { env, Uri } = await import("vscode");
		await env.openExternal(Uri.parse("https://status.devin.ai"));
	}
}
