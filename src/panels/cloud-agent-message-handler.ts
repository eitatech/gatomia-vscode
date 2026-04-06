/**
 * Cloud Agent Message Handler
 *
 * Handles webview-to-extension message passing for the Cloud Agent panel.
 * Processes commands from the webview and dispatches updates back.
 *
 * @see specs/016-multi-provider-agents/contracts/ui-events.md
 */

import { env, Uri } from "vscode";
import type { AgentPollingService } from "../features/cloud-agents/agent-polling-service";
import { logInfo, logError } from "../features/cloud-agents/logging";
import type { ProviderRegistry } from "../features/cloud-agents/provider-registry";

// ============================================================================
// Message Types
// ============================================================================

interface WebviewMessage {
	type: string;
	payload?: Record<string, unknown>;
}

// ============================================================================
// CloudAgentMessageHandler
// ============================================================================

/**
 * Message handler for Cloud Agent webview panel.
 * Routes messages from the webview to the appropriate service.
 *
 * @see specs/016-multi-provider-agents/contracts/ui-events.md
 */
export class CloudAgentMessageHandler {
	private readonly registry: ProviderRegistry;
	private readonly pollingService: AgentPollingService;

	constructor(registry: ProviderRegistry, pollingService: AgentPollingService) {
		this.registry = registry;
		this.pollingService = pollingService;
	}

	/**
	 * Handle a message from the webview.
	 */
	async handleMessage(message: WebviewMessage): Promise<void> {
		try {
			switch (message.type) {
				case "refresh-status":
					await this.pollingService.pollOnce();
					break;
				case "open-external": {
					const url = message.payload?.url as string | undefined;
					if (url) {
						await env.openExternal(Uri.parse(url));
						logInfo(`Opened external URL: ${url}`);
					}
					break;
				}
				case "open-pr": {
					const prUrl = message.payload?.url as string | undefined;
					if (prUrl) {
						await env.openExternal(Uri.parse(prUrl));
					}
					break;
				}
				default:
					logError(`Unknown webview message type: ${message.type}`);
			}
		} catch (error) {
			logError("Failed to handle webview message", error);
		}
	}
}
