/**
 * Authentication Failure Handler
 *
 * Handles authentication errors by marking credentials as invalid
 * and prompting the user to reconfigure.
 *
 * @see specs/001-devin-integration/spec.md (Edge Case: Auth failure)
 */

import { DevinAuthenticationError } from "./errors";
import type { DevinCredentialsManager } from "./devin-credentials-manager";
import { showDevinErrorNotification } from "./error-notifications";
import { logError } from "./logging";

/**
 * Handle an authentication error by invalidating credentials and notifying the user.
 */
export async function handleAuthenticationFailure(
	error: DevinAuthenticationError,
	credentialsManager: DevinCredentialsManager
): Promise<void> {
	logError("Authentication failure detected", error);
	await credentialsManager.markInvalid();
	await showDevinErrorNotification(error);
}

/**
 * Check if an error is an authentication error.
 */
export function isAuthenticationError(
	error: unknown
): error is DevinAuthenticationError {
	return error instanceof DevinAuthenticationError;
}
