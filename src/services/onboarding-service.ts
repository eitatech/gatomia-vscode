import { Uri, env, window } from "vscode";
import type { AcpProviderDescriptor } from "./acp/types";

export interface OnboardingStore {
	get<T>(key: string, fallback?: T): T;
	update(key: string, value: unknown): Thenable<void> | Promise<void>;
}

const INSTALL_LABEL = "Install";
const USE_COPILOT_LABEL = "Use Copilot Chat";
const AUTH_LABEL = "Authenticate";
const DISMISS_LABEL = "Don't ask again";

const dismissalKey = (providerId: string): string =>
	`gatomia.onboarding.acp.${providerId}.dismissed`;

/**
 * Coordinates first-run onboarding for ACP providers.
 *
 * The service presents a single notification per provider whenever the router
 * cannot reach the preferred CLI (missing or unauthenticated). Users can
 * choose to install/authenticate, switch to Copilot Chat, or dismiss the
 * prompt permanently (tracked in `globalState`).
 *
 * Prompts are also silenced for the remainder of the session once the user
 * interacts with them, regardless of the persisted choice, to avoid
 * notification spam during a single VS Code session.
 */
export class OnboardingService {
	private readonly store: OnboardingStore;
	private readonly sessionDismissed = new Set<string>();

	constructor(store: OnboardingStore) {
		this.store = store;
	}

	async promptInstall(descriptor: AcpProviderDescriptor): Promise<void> {
		if (this.shouldSkip(descriptor.id)) {
			return;
		}

		const choice = await window.showInformationMessage(
			`GatomIA detected ${descriptor.displayName} is not installed. Install it to route prompts via ACP.`,
			INSTALL_LABEL,
			USE_COPILOT_LABEL,
			DISMISS_LABEL
		);

		this.sessionDismissed.add(descriptor.id);

		if (choice === INSTALL_LABEL) {
			await env.openExternal(Uri.parse(descriptor.installUrl));
		} else if (choice === DISMISS_LABEL) {
			await this.store.update(dismissalKey(descriptor.id), true);
		}
	}

	async promptAuth(descriptor: AcpProviderDescriptor): Promise<void> {
		if (this.shouldSkip(descriptor.id)) {
			return;
		}

		const choice = await window.showInformationMessage(
			`GatomIA detected ${descriptor.displayName} is installed but not authenticated.`,
			AUTH_LABEL,
			USE_COPILOT_LABEL,
			DISMISS_LABEL
		);

		this.sessionDismissed.add(descriptor.id);

		if (choice === AUTH_LABEL) {
			const terminal = window.createTerminal({
				name: `${descriptor.displayName} Auth`,
			});
			terminal.show();
			terminal.sendText(descriptor.authCommand);
		} else if (choice === DISMISS_LABEL) {
			await this.store.update(dismissalKey(descriptor.id), true);
		}
	}

	/**
	 * Clears all dismissal flags for the given provider so future prompts
	 * reappear. Invoked from the "reprobe" command.
	 */
	async reset(descriptor: AcpProviderDescriptor): Promise<void> {
		this.sessionDismissed.delete(descriptor.id);
		await this.store.update(dismissalKey(descriptor.id), false);
	}

	private shouldSkip(providerId: string): boolean {
		if (this.sessionDismissed.has(providerId)) {
			return true;
		}
		return this.store.get<boolean>(dismissalKey(providerId), false) === true;
	}
}
