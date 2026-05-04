/**
 * NewSessionPanel unit tests (TDD red).
 *
 * Verifies the lightweight webview panel that exists ONLY to choose an agent
 * + initial prompt before a session is created. The panel:
 *   - Posts the current provider list to the webview at construction time.
 *   - Listens for `new-session/start` messages and forwards them to the
 *     injected `onStart` callback, then disposes itself.
 *   - Listens for `new-session/open-install-url` and delegates to
 *     `env.openExternal`.
 *   - Re-emits when the registry's `onDidUpdate` fires (covers remote
 *     registry refresh).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { EventEmitter, Uri } from "vscode";
import {
	NewSessionPanel,
	type NewSessionPanelDeps,
	type NewSessionPanelStartPayload,
	type NewSessionPanelView,
} from "../../../src/panels/new-session-panel";

// ---------------------------------------------------------------------------
// Test doubles
// ---------------------------------------------------------------------------

interface FakeWebview {
	html: string;
	postMessage: ReturnType<typeof vi.fn>;
	onDidReceiveMessage: ReturnType<typeof vi.fn>;
	asWebviewUri: (uri: unknown) => unknown;
	listeners: ((message: unknown) => void)[];
}

interface FakePanel {
	webview: FakeWebview;
	reveal: ReturnType<typeof vi.fn>;
	dispose: ReturnType<typeof vi.fn>;
	onDidDispose: ReturnType<typeof vi.fn>;
	disposeListeners: (() => void)[];
}

function createFakePanel(): FakePanel {
	const messageListeners: ((message: unknown) => void)[] = [];
	const disposeListeners: (() => void)[] = [];
	const webview: FakeWebview = {
		html: "",
		postMessage: vi.fn(() => Promise.resolve(true)),
		onDidReceiveMessage: vi.fn((listener: (message: unknown) => void) => {
			messageListeners.push(listener);
			return { dispose: vi.fn() };
		}),
		asWebviewUri: (uri: unknown) => uri,
		listeners: messageListeners,
	};
	const panel: FakePanel = {
		webview,
		reveal: vi.fn(),
		dispose: vi.fn(),
		onDidDispose: vi.fn((listener: () => void) => {
			disposeListeners.push(listener);
			return { dispose: vi.fn() };
		}),
		disposeListeners,
	};
	return panel;
}

function createDeps(): {
	deps: NewSessionPanelDeps;
	updateEmitter: EventEmitter<void>;
	listProviders: ReturnType<typeof vi.fn>;
	onStart: ReturnType<typeof vi.fn>;
	openExternal: ReturnType<typeof vi.fn>;
	createWebviewPanel: ReturnType<typeof vi.fn>;
	fakePanel: FakePanel;
} {
	const fakePanel = createFakePanel();
	const updateEmitter = new EventEmitter<void>();
	const listProviders = vi.fn(() => [
		{
			id: "claude-acp",
			displayName: "Claude Code",
			source: "local",
			availability: "installed",
		},
	]);
	const onStart = vi.fn(() => Promise.resolve());
	const openExternal = vi.fn(() => Promise.resolve(true));
	const createWebviewPanel = vi.fn(() => fakePanel);

	const deps: NewSessionPanelDeps = {
		listProviders:
			listProviders as unknown as NewSessionPanelDeps["listProviders"],
		onStart: onStart as unknown as NewSessionPanelDeps["onStart"],
		registryUpdateEvent: updateEmitter.event,
		extensionUri: Uri.file("/fake/extension"),
		window: {
			createWebviewPanel:
				createWebviewPanel as unknown as NewSessionPanelDeps["window"]["createWebviewPanel"],
		},
		env: {
			openExternal:
				openExternal as unknown as NewSessionPanelDeps["env"]["openExternal"],
		},
	};

	return {
		deps,
		updateEmitter,
		listProviders,
		onStart,
		openExternal,
		createWebviewPanel,
		fakePanel,
	};
}

function emitMessage(panel: FakePanel, message: unknown): void {
	for (const listener of [...panel.webview.listeners]) {
		listener(message);
	}
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe("NewSessionPanel", () => {
	let view: NewSessionPanelView;

	beforeEach(() => {
		const { deps } = createDeps();
		view = new NewSessionPanel(deps);
	});

	it("posts the provider list to the webview on open", () => {
		const { deps, fakePanel, listProviders } = createDeps();
		const panel = new NewSessionPanel(deps);
		panel.open();

		expect(listProviders).toHaveBeenCalled();
		expect(fakePanel.webview.postMessage).toHaveBeenCalledWith(
			expect.objectContaining({
				type: "new-session/providers",
			})
		);
	});

	it("forwards new-session/start to onStart and disposes the panel", async () => {
		const { deps, fakePanel, onStart } = createDeps();
		const panel = new NewSessionPanel(deps);
		panel.open();

		const payload: NewSessionPanelStartPayload = {
			agentId: "claude-acp",
			agentDisplayName: "Claude Code",
			taskInstruction: "say hi",
		};
		emitMessage(fakePanel, { type: "new-session/start", payload });
		// Allow the async handler to flush.
		await Promise.resolve();
		await Promise.resolve();

		expect(onStart).toHaveBeenCalledWith(payload);
		expect(fakePanel.dispose).toHaveBeenCalledTimes(1);
	});

	it("opens the install URL via env.openExternal on new-session/open-install-url", async () => {
		const { deps, fakePanel, openExternal } = createDeps();
		const panel = new NewSessionPanel(deps);
		panel.open();

		emitMessage(fakePanel, {
			type: "new-session/open-install-url",
			payload: { url: "https://example.com/install" },
		});
		await Promise.resolve();

		expect(openExternal).toHaveBeenCalledTimes(1);
	});

	it("re-broadcasts the provider list when registryUpdateEvent fires", () => {
		const { deps, fakePanel, listProviders, updateEmitter } = createDeps();
		const panel = new NewSessionPanel(deps);
		panel.open();

		fakePanel.webview.postMessage.mockClear();
		listProviders.mockClear();

		updateEmitter.fire();

		expect(listProviders).toHaveBeenCalled();
		expect(fakePanel.webview.postMessage).toHaveBeenCalledWith(
			expect.objectContaining({ type: "new-session/providers" })
		);
	});

	it("dispose() unsubscribes from registryUpdateEvent (no further posts)", () => {
		const { deps, fakePanel, listProviders, updateEmitter } = createDeps();
		const panel = new NewSessionPanel(deps);
		panel.open();
		panel.dispose();

		fakePanel.webview.postMessage.mockClear();
		listProviders.mockClear();

		updateEmitter.fire();

		expect(listProviders).not.toHaveBeenCalled();
		expect(fakePanel.webview.postMessage).not.toHaveBeenCalled();
	});

	it("smoke: instantiates without throwing when given the minimal deps", () => {
		expect(view).toBeDefined();
	});
});
