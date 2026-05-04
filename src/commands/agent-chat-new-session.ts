/**
 * agent-chat-new-session — interactive QuickPick flow used by the
 * `gatomia.agentChat.newSession` command and the `+ New session` tree leaf.
 *
 * Plan B.1 (spec 018, Phase 4): groups providers by detection tier
 * (Installed / Available via npx / Install required), prompts for a task, and
 * delegates the actual session creation to the injected `startNew` callback.
 *
 * The module is pure-ish: every VS Code surface is passed in via `deps` so it
 * can be unit-tested without spawning an Extension Development Host.
 */

import type { QuickPickItem, QuickPickItemKind, Uri } from "vscode";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type NewSessionAvailability =
	| "installed"
	| "available-via-npx"
	| "install-required";

export interface NewSessionProviderItem {
	id: string;
	displayName: string;
	description?: string;
	source: "built-in" | "local" | "remote";
	availability: NewSessionAvailability;
	npxPackage?: string;
	installUrl?: string;
}

export interface NewSessionStartPayload {
	agentId: string;
	agentDisplayName: string;
	agentCommand?: string;
	taskInstruction: string;
}

interface NewSessionWindow {
	showQuickPick: <T extends QuickPickItem>(
		items: readonly T[] | Thenable<readonly T[]>,
		options?: {
			placeHolder?: string;
			ignoreFocusOut?: boolean;
			matchOnDescription?: boolean;
			matchOnDetail?: boolean;
		}
	) => Thenable<T | undefined>;
	showInputBox: (options?: {
		prompt?: string;
		placeHolder?: string;
		value?: string;
		ignoreFocusOut?: boolean;
	}) => Thenable<string | undefined>;
	showWarningMessage: (
		message: string,
		options?: { modal?: boolean },
		...items: string[]
	) => Thenable<string | undefined>;
}

interface NewSessionEnv {
	openExternal: (uri: Uri) => Thenable<boolean>;
}

export interface NewSessionDeps {
	listProviders: () => readonly NewSessionProviderItem[];
	startNew: (payload: NewSessionStartPayload) => Promise<void> | void;
	window: NewSessionWindow;
	env: NewSessionEnv;
	parseUri?: (value: string) => Uri;
}

// ---------------------------------------------------------------------------
// QuickPick item shape
// ---------------------------------------------------------------------------

interface NewSessionQuickPickItem extends QuickPickItem {
	providerId?: string;
	action?: "open-install-url";
	availability?: NewSessionAvailability;
	npxPackage?: string;
	installUrl?: string;
	displayName?: string;
}

// VS Code's QuickPickItemKind.Separator === 1; we avoid a hard dependency by
// reading the enum lazily so unit tests don't have to stub it.
let separatorKindCache: QuickPickItemKind | undefined;
function separatorKind(): QuickPickItemKind {
	if (separatorKindCache !== undefined) {
		return separatorKindCache;
	}
	try {
		// Resolved at runtime in the extension host; in unit tests we never
		// touch the real enum because the test inspector treats the kind as
		// opaque metadata.
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		const vscode = require("vscode") as {
			QuickPickItemKind: { Separator: QuickPickItemKind };
		};
		separatorKindCache = vscode.QuickPickItemKind.Separator;
	} catch {
		separatorKindCache = 1 as QuickPickItemKind;
	}
	return separatorKindCache;
}

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

const TIER_ORDER: NewSessionAvailability[] = [
	"installed",
	"available-via-npx",
	"install-required",
];

const TIER_LABEL: Record<NewSessionAvailability, string> = {
	installed: "Installed",
	"available-via-npx": "Available via npx",
	"install-required": "Install required",
};

function buildQuickPickItems(
	providers: readonly NewSessionProviderItem[]
): NewSessionQuickPickItem[] {
	const grouped = new Map<NewSessionAvailability, NewSessionProviderItem[]>();
	for (const tier of TIER_ORDER) {
		grouped.set(tier, []);
	}
	for (const provider of providers) {
		grouped.get(provider.availability)?.push(provider);
	}

	const items: NewSessionQuickPickItem[] = [];
	for (const tier of TIER_ORDER) {
		const tierProviders = grouped.get(tier) ?? [];
		if (tierProviders.length === 0) {
			continue;
		}
		items.push({
			label: TIER_LABEL[tier],
			kind: separatorKind(),
		});
		for (const provider of tierProviders) {
			items.push({
				label: provider.displayName,
				description: describeSource(provider),
				detail: provider.description,
				providerId: provider.id,
				displayName: provider.displayName,
				availability: provider.availability,
				npxPackage: provider.npxPackage,
				installUrl: provider.installUrl,
				action:
					provider.availability === "install-required"
						? "open-install-url"
						: undefined,
			});
		}
	}
	return items;
}

function describeSource(provider: NewSessionProviderItem): string {
	switch (provider.source) {
		case "built-in":
			return "$(verified) Built-in";
		case "local":
			return "$(library) Local catalog";
		default:
			return "$(globe) Remote registry";
	}
}

// ---------------------------------------------------------------------------
// Main flow
// ---------------------------------------------------------------------------

export async function handleNewSession(deps: NewSessionDeps): Promise<void> {
	const providers = deps.listProviders();
	const items = buildQuickPickItems(providers);

	const picked = await deps.window.showQuickPick(items, {
		placeHolder: "Select an ACP agent for the new session",
		ignoreFocusOut: true,
		matchOnDescription: true,
		matchOnDetail: true,
	});
	if (!picked) {
		return;
	}
	if (!picked.providerId) {
		return;
	}

	// Re-resolve against the original provider list: VS Code's QuickPick may
	// return an item that doesn't preserve our extra fields, and the unit
	// tests intentionally inject a minimal `{label, providerId}` shape.
	const provider = providers.find((p) => p.id === picked.providerId);
	const availability = picked.availability ?? provider?.availability;
	const installUrl = picked.installUrl ?? provider?.installUrl;
	const displayName =
		picked.displayName ?? provider?.displayName ?? picked.label;

	if (
		picked.action === "open-install-url" ||
		availability === "install-required"
	) {
		await openInstallUrl(deps, installUrl);
		return;
	}

	const taskInstruction = await deps.window.showInputBox({
		prompt: `Describe the task for ${displayName}`,
		placeHolder: "e.g. Refactor the auth module to use middleware",
		ignoreFocusOut: true,
	});
	if (taskInstruction === undefined) {
		return;
	}

	// `available-via-npx` agents used to require an additional
	// confirmation modal here. We removed it because the QuickPick choice
	// is already an explicit opt-in and the modal interrupted every
	// launch without adding real safety. The spawn now starts straight
	// through `deps.startNew`.
	await deps.startNew({
		agentId: picked.providerId,
		agentDisplayName: displayName,
		taskInstruction,
	});
}

async function openInstallUrl(
	deps: NewSessionDeps,
	url: string | undefined
): Promise<void> {
	if (!url) {
		return;
	}
	const parsed = parseUriSafe(deps, url);
	try {
		await deps.env.openExternal(parsed);
	} catch {
		// Swallow: openExternal failures are surfaced by VS Code itself; we
		// don't want to abort the New Session flow over a logging detail.
	}
}

function parseUriSafe(deps: NewSessionDeps, url: string): Uri {
	if (deps.parseUri) {
		return deps.parseUri(url);
	}
	try {
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		const vscode = require("vscode") as {
			Uri: { parse: (value: string) => Uri };
		};
		return vscode.Uri.parse(url);
	} catch {
		// Tests don't load the real `vscode` module, so we hand the URL back
		// as a Uri-shaped opaque object. `openExternal` is mocked in tests
		// and never inspects the value.
		return { toString: () => url } as unknown as Uri;
	}
}
