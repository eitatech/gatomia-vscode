import { randomUUID } from "node:crypto";
import type { OutputChannel } from "vscode";
import {
	AcpClient,
	type PermissionMode,
	type PermissionPrompter,
} from "./acp-client";
import type { AcpProviderRegistry } from "./acp-provider-registry";
import type { SessionMode } from "./types";

export interface AcpSessionContext {
	mode: SessionMode;
	specId?: string;
}

export interface AcpSessionManagerOptions {
	registry: AcpProviderRegistry;
	output: OutputChannel;
	cwd: string;
	/** Permission strategy forwarded to every spawned {@link AcpClient}. */
	permissionDefault?: PermissionMode;
	/** Interactive resolver used when `permissionDefault` is `"ask"`. */
	promptForPermission?: PermissionPrompter;
}

/**
 * Coordinates ACP clients and the session keys used to scope conversations.
 *
 * A single `AcpClient` is created per provider id and reused across calls.
 * The session key is derived from the requested `SessionMode`:
 *
 * - `workspace`: a shared key (`_ws_`) for all prompts in the workspace.
 * - `per-spec`: key is `spec:<specId>`; falls back to workspace when missing.
 * - `per-prompt`: a fresh `once:<uuid>` key generated per call.
 */
export class AcpSessionManager {
	private readonly registry: AcpProviderRegistry;
	private readonly output: OutputChannel;
	private readonly cwd: string;
	private readonly permissionDefault: PermissionMode | undefined;
	private readonly promptForPermission: PermissionPrompter | undefined;
	private readonly clients = new Map<string, AcpClient>();

	constructor(options: AcpSessionManagerOptions) {
		this.registry = options.registry;
		this.output = options.output;
		this.cwd = options.cwd;
		this.permissionDefault = options.permissionDefault;
		this.promptForPermission = options.promptForPermission;
	}

	async send(
		providerId: string,
		prompt: string,
		context: AcpSessionContext
	): Promise<void> {
		const client = this.ensureClient(providerId);
		const sessionKey = resolveSessionKey(context);
		await client.sendPrompt(sessionKey, prompt);
	}

	async cancel(providerId: string, context: AcpSessionContext): Promise<void> {
		const client = this.clients.get(providerId);
		if (!client) {
			return;
		}
		const sessionKey = resolveSessionKey(context);
		await client.cancel(sessionKey);
	}

	dispose(): void {
		for (const client of this.clients.values()) {
			try {
				client.dispose();
			} catch (error) {
				this.output.appendLine(
					`[ACP] dispose failed: ${error instanceof Error ? error.message : String(error)}`
				);
			}
		}
		this.clients.clear();
	}

	private ensureClient(providerId: string): AcpClient {
		const existing = this.clients.get(providerId);
		if (existing) {
			return existing;
		}
		const descriptor = this.registry.get(providerId);
		if (!descriptor) {
			throw new Error(`[ACP] unknown provider: ${providerId}`);
		}
		const client = new AcpClient({
			descriptor,
			cwd: this.cwd,
			output: this.output,
			permissionDefault: this.permissionDefault,
			promptForPermission: this.promptForPermission,
		});
		this.clients.set(providerId, client);
		return client;
	}
}

const WORKSPACE_KEY = "_ws_";

const resolveSessionKey = (context: AcpSessionContext): string => {
	switch (context.mode) {
		case "per-spec":
			return context.specId ? `spec:${context.specId}` : WORKSPACE_KEY;
		case "per-prompt":
			return `once:${randomUUID()}`;
		default:
			return WORKSPACE_KEY;
	}
};
