/**
 * Error Handling and User Notifications
 *
 * Translates Devin errors into user-friendly VS Code notifications.
 * Provides actionable error messages with suggested next steps.
 *
 * @see specs/001-devin-integration/contracts/extension-api.ts:L102-L112
 */

import { window } from "vscode";
import {
	DevinApiError,
	DevinAuthenticationError,
	DevinCredentialsNotFoundError,
	DevinError,
	DevinInvalidTokenError,
	DevinMaxRetriesExceededError,
	DevinNetworkError,
	DevinOrgIdRequiredError,
	DevinRateLimitedError,
	DevinTimeoutError,
} from "./errors";
import { DEVIN_COMMANDS } from "./config";

// ============================================================================
// Error Notification Handler
// ============================================================================

/**
 * Show an appropriate VS Code notification for a Devin error.
 *
 * Maps error types to user-friendly messages with actionable buttons.
 */
export async function showDevinErrorNotification(
	error: unknown
): Promise<void> {
	if (await handleCredentialErrors(error)) {
		return;
	}
	if (await handleTransientErrors(error)) {
		return;
	}
	await handleGenericError(error);
}

async function handleCredentialErrors(error: unknown): Promise<boolean> {
	if (error instanceof DevinCredentialsNotFoundError) {
		await promptConfigureCredentials(
			"Devin API credentials are not configured."
		);
		return true;
	}
	if (error instanceof DevinAuthenticationError) {
		await promptConfigureCredentials(
			"Devin API authentication failed. Your credentials may be invalid or expired."
		);
		return true;
	}
	if (error instanceof DevinInvalidTokenError) {
		await window.showErrorMessage(
			`Invalid Devin API token format. Expected 'cog_*' (v3) or 'apk_*' (v1/v2). ${error.message}`
		);
		return true;
	}
	if (error instanceof DevinOrgIdRequiredError) {
		await promptConfigureCredentials(
			"Organization ID is required for Devin v3 API. Please reconfigure your credentials."
		);
		return true;
	}
	return false;
}

async function handleTransientErrors(error: unknown): Promise<boolean> {
	if (error instanceof DevinRateLimitedError) {
		await window.showWarningMessage(
			"Devin API rate limit exceeded. Please wait a moment and try again."
		);
		return true;
	}
	if (error instanceof DevinNetworkError) {
		await window.showErrorMessage(
			"Unable to reach Devin API. Please check your internet connection."
		);
		return true;
	}
	if (error instanceof DevinTimeoutError) {
		await window.showErrorMessage(
			"Devin API request timed out. Please try again."
		);
		return true;
	}
	if (error instanceof DevinMaxRetriesExceededError) {
		await window.showErrorMessage(
			`Devin API request failed after ${error.attempts} attempts. Please try again later.`
		);
		return true;
	}
	return false;
}

async function handleGenericError(error: unknown): Promise<void> {
	if (error instanceof DevinApiError) {
		await window.showErrorMessage(
			`Devin API error (${error.statusCode}): ${error.message}`
		);
		return;
	}
	if (error instanceof DevinError) {
		await window.showErrorMessage(`Devin error: ${error.message}`);
		return;
	}
	const message =
		error instanceof Error ? error.message : "An unknown error occurred";
	await window.showErrorMessage(`Devin integration error: ${message}`);
}

async function promptConfigureCredentials(message: string): Promise<void> {
	const action = await window.showErrorMessage(message, "Configure");
	if (action === "Configure") {
		const { commands } = await import("vscode");
		await commands.executeCommand(DEVIN_COMMANDS.CONFIGURE_CREDENTIALS);
	}
}
