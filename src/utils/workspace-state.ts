/**
 * Workspace State Utilities
 * Helper functions for managing welcome screen workspace-specific state
 * Based on specs/006-welcome-screen/research.md section 2
 */

import type * as vscode from "vscode";

/**
 * Workspace state keys for welcome screen
 */
export const WelcomeStateKeys = {
	HAS_SHOWN: "gatomia.welcomeScreen.hasShown",
	DONT_SHOW: "gatomia.welcomeScreen.dontShow",
} as const;

/**
 * Check if welcome screen has been shown before in current workspace
 * @param context - Extension context with workspace state
 * @returns true if shown before, false for first time
 */
export function hasShownWelcomeBefore(
	context: vscode.ExtensionContext
): boolean {
	return context.workspaceState.get<boolean>(WelcomeStateKeys.HAS_SHOWN, false);
}

/**
 * Mark welcome screen as shown in current workspace
 * @param context - Extension context with workspace state
 */
export async function markWelcomeAsShown(
	context: vscode.ExtensionContext
): Promise<void> {
	await context.workspaceState.update(WelcomeStateKeys.HAS_SHOWN, true);
}

/**
 * Get user preference for "don't show on startup"
 * @param context - Extension context with workspace state
 * @returns true if user doesn't want automatic display, false otherwise
 */
export function getDontShowOnStartup(
	context: vscode.ExtensionContext
): boolean {
	return context.workspaceState.get<boolean>(WelcomeStateKeys.DONT_SHOW, false);
}

/**
 * Set user preference for "don't show on startup"
 * @param context - Extension context with workspace state
 * @param value - true to suppress automatic display, false to allow
 */
export async function setDontShowOnStartup(
	context: vscode.ExtensionContext,
	value: boolean
): Promise<void> {
	await context.workspaceState.update(WelcomeStateKeys.DONT_SHOW, value);
}

/**
 * Check if welcome screen should be shown automatically
 * Considers both first-time status and user preference
 * @param context - Extension context with workspace state
 * @returns true if should show automatically, false otherwise
 */
export function shouldShowWelcomeAutomatically(
	context: vscode.ExtensionContext
): boolean {
	// Don't show if user has opted out
	if (getDontShowOnStartup(context)) {
		return false;
	}

	// Show if this is first time in workspace
	return !hasShownWelcomeBefore(context);
}

/**
 * Reset welcome screen state (for testing or manual reset)
 * @param context - Extension context with workspace state
 */
export async function resetWelcomeState(
	context: vscode.ExtensionContext
): Promise<void> {
	await context.workspaceState.update(WelcomeStateKeys.HAS_SHOWN, undefined);
	await context.workspaceState.update(WelcomeStateKeys.DONT_SHOW, undefined);
}

/**
 * Get all welcome screen workspace state (for debugging)
 * @param context - Extension context with workspace state
 */
export function getWelcomeState(context: vscode.ExtensionContext): {
	hasShown: boolean;
	dontShow: boolean;
} {
	return {
		hasShown: hasShownWelcomeBefore(context) ?? false,
		dontShow: getDontShowOnStartup(context) ?? false,
	};
}
