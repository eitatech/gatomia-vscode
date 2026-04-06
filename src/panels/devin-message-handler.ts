/**
 * Devin Webview Message Handler
 *
 * Handles messages received from the Devin progress webview panel.
 * Routes commands (cancel, refresh, open PR) to appropriate services.
 *
 * @see specs/001-devin-integration/contracts/extension-api.ts:L22-L26
 */

import { env, Uri } from "vscode";
import type { DevinSessionManager } from "../features/devin/devin-session-manager";
import type { DevinPollingService } from "../features/devin/devin-polling-service";
import { showDevinErrorNotification } from "../features/devin/error-notifications";

// ============================================================================
// Types
// ============================================================================

/**
 * Message received from the Devin webview.
 */
export interface DevinWebviewMessage {
	readonly type: string;
	readonly payload?: Record<string, unknown>;
}

// ============================================================================
// Message Handler
// ============================================================================

/**
 * Handle a message from the Devin progress webview.
 */
export async function handleDevinWebviewMessage(
	message: DevinWebviewMessage,
	sessionManager: DevinSessionManager,
	pollingService: DevinPollingService
): Promise<void> {
	switch (message.type) {
		case "cancel-session": {
			const localId = message.payload?.localId as string | undefined;
			if (localId) {
				try {
					await sessionManager.cancelSession(localId);
				} catch (error: unknown) {
					await showDevinErrorNotification(error);
				}
			}
			break;
		}

		case "refresh-status": {
			await pollingService.pollOnce();
			break;
		}

		case "open-pr": {
			const prUrl = message.payload?.prUrl as string | undefined;
			if (prUrl) {
				await env.openExternal(Uri.parse(prUrl));
			}
			break;
		}

		case "open-devin": {
			const devinUrl = message.payload?.url as string | undefined;
			if (devinUrl) {
				await env.openExternal(Uri.parse(devinUrl));
			}
			break;
		}

		default:
			break;
	}
}
