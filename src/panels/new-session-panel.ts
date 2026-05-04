/**
 * NewSessionPanel — webview panel that lets users pick an ACP agent and
 * compose an initial task before a session is created.
 *
 * The panel is intentionally lightweight: it does NOT mount the full Agent
 * Chat React app. It exposes a tiny message protocol consumed by the
 * `new-session/*` view in `ui/src/views/new-session-view.tsx`:
 *
 *   extension → webview:
 *     `{ type: "new-session/providers", providers: NewSessionProviderItem[] }`
 *
 *   webview → extension:
 *     `{ type: "new-session/start", payload: NewSessionPanelStartPayload }`
 *     `{ type: "new-session/open-install-url", payload: { url: string } }`
 *     `{ type: "new-session/close" }`
 *
 * Lifecycle:
 *   - `open()` creates (or reveals) the underlying `WebviewPanel`, posts the
 *     current provider list, and subscribes to `registryUpdateEvent`.
 *   - `dispose()` is idempotent and unsubscribes from all events.
 *   - The panel disposes itself once a session has been started (the user
 *     ends up on the real Agent Chat panel).
 *
 * @see specs/018-agent-chat-panel — Plan B.2
 */

import {
	type Disposable,
	type Event,
	Uri,
	type ViewColumn,
	type WebviewPanel,
	type WebviewPanelOptions,
	type WebviewOptions,
} from "vscode";
import type { NewSessionProviderItem } from "../commands/agent-chat-new-session";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface NewSessionPanelStartPayload {
	agentId: string;
	agentDisplayName: string;
	taskInstruction: string;
}

interface NewSessionPanelWindow {
	createWebviewPanel: (
		viewType: string,
		title: string,
		showOptions:
			| ViewColumn
			| { viewColumn: ViewColumn; preserveFocus?: boolean },
		options?: WebviewPanelOptions & WebviewOptions
	) => WebviewPanel;
}

interface NewSessionPanelEnv {
	openExternal: (uri: Uri) => Thenable<boolean>;
}

export interface NewSessionPanelDeps {
	listProviders: () => readonly NewSessionProviderItem[];
	onStart: (payload: NewSessionPanelStartPayload) => Promise<void> | void;
	registryUpdateEvent: Event<void>;
	extensionUri: Uri;
	window: NewSessionPanelWindow;
	env: NewSessionPanelEnv;
}

/**
 * Public interface for the panel — exposed so tests can hold a typed
 * reference and so command handlers don't need to import the concrete class.
 */
export interface NewSessionPanelView {
	open(): void;
	reveal(): void;
	dispose(): void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VIEW_TYPE = "gatomia.agentChat.newSession";
const TITLE = "New Agent Session";

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export class NewSessionPanel implements NewSessionPanelView {
	private readonly deps: NewSessionPanelDeps;
	private panel: WebviewPanel | undefined;
	private readonly disposables: Disposable[] = [];
	private disposed = false;

	constructor(deps: NewSessionPanelDeps) {
		this.deps = deps;
	}

	open(): void {
		if (this.disposed) {
			throw new Error("[new-session-panel] cannot open a disposed panel");
		}
		if (this.panel) {
			this.panel.reveal();
			return;
		}

		this.panel = this.deps.window.createWebviewPanel(
			VIEW_TYPE,
			TITLE,
			1 as ViewColumn, // ViewColumn.One — use the literal so tests don't need the enum.
			{
				enableScripts: true,
				retainContextWhenHidden: true,
				localResourceRoots: [this.deps.extensionUri],
			}
		);

		this.panel.webview.html = this.renderHtml();

		this.disposables.push(
			this.panel.webview.onDidReceiveMessage((message) =>
				this.handleMessage(message)
			)
		);
		this.disposables.push(this.panel.onDidDispose(() => this.dispose()));
		this.disposables.push(
			this.deps.registryUpdateEvent(() => this.broadcastProviders())
		);

		this.broadcastProviders();
	}

	reveal(): void {
		if (this.panel) {
			this.panel.reveal();
			return;
		}
		this.open();
	}

	dispose(): void {
		if (this.disposed) {
			return;
		}
		this.disposed = true;
		for (const sub of this.disposables.splice(0)) {
			try {
				sub.dispose();
			} catch {
				// Disposal failures during teardown are non-fatal.
			}
		}
		try {
			this.panel?.dispose();
		} catch {
			// Same.
		}
		this.panel = undefined;
	}

	// ------------------------------------------------------------------
	// Message handling
	// ------------------------------------------------------------------

	private handleMessage(message: unknown): void {
		if (!message || typeof message !== "object") {
			return;
		}
		const envelope = message as { type?: string; payload?: unknown };
		switch (envelope.type) {
			case "new-session/start":
				this.handleStart(envelope.payload).catch(() => {
					// Errors are surfaced by the caller (`startNew` flow);
					// we do not bubble them up to the webview here.
				});
				return;
			case "new-session/open-install-url":
				this.handleOpenInstallUrl(envelope.payload);
				return;
			case "new-session/close":
				this.dispose();
				return;
			default:
				return;
		}
	}

	private async handleStart(payload: unknown): Promise<void> {
		if (!isStartPayload(payload)) {
			return;
		}
		try {
			await this.deps.onStart(payload);
		} finally {
			// Always close after a start attempt — the flow is supposed to
			// transition the user to the real Agent Chat panel regardless of
			// whether the start succeeded or not.
			this.dispose();
		}
	}

	private handleOpenInstallUrl(payload: unknown): void {
		if (!payload || typeof payload !== "object") {
			return;
		}
		const url = (payload as { url?: unknown }).url;
		if (typeof url !== "string" || url.length === 0) {
			return;
		}
		try {
			const parsed = parseUriSafe(url);
			this.deps.env.openExternal(parsed);
		} catch {
			// Swallow: install-url failures shouldn't take the panel down.
		}
	}

	private broadcastProviders(): void {
		if (!this.panel) {
			return;
		}
		const providers = this.deps.listProviders();
		this.panel.webview.postMessage({
			type: "new-session/providers",
			providers,
		});
	}

	// ------------------------------------------------------------------
	// HTML
	// ------------------------------------------------------------------

	private renderHtml(): string {
		// We keep the markup minimal — the actual UI lives in the React app
		// loaded from the bundled webview. This file is shipped as a stub
		// until the React view (`new-session-view.tsx`) is wired in B.2b.
		return `<!DOCTYPE html>
<html lang="en">
	<head>
		<meta charset="UTF-8" />
		<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';" />
		<title>${TITLE}</title>
		<style>
			body { font-family: var(--vscode-font-family); padding: 24px; }
			.placeholder { opacity: 0.6; font-size: 13px; }
		</style>
	</head>
	<body>
		<h1>${TITLE}</h1>
		<p class="placeholder">Loading agents from registry…</p>
		<script>
			const vscode = acquireVsCodeApi();
			window.addEventListener('message', (event) => {
				const message = event.data;
				if (message?.type === 'new-session/providers') {
					document.querySelector('.placeholder')?.remove();
					const root = document.body;
					const heading = document.createElement('p');
					heading.textContent = 'Pick an agent and describe your task. (React view wired separately.)';
					root.appendChild(heading);
				}
			});
		</script>
	</body>
</html>`;
	}
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isStartPayload(value: unknown): value is NewSessionPanelStartPayload {
	if (!value || typeof value !== "object") {
		return false;
	}
	const candidate = value as Partial<NewSessionPanelStartPayload>;
	return (
		typeof candidate.agentId === "string" &&
		typeof candidate.agentDisplayName === "string" &&
		typeof candidate.taskInstruction === "string"
	);
}

function parseUriSafe(url: string): Uri {
	try {
		return Uri.parse(url);
	} catch {
		return { toString: () => url } as unknown as Uri;
	}
}
