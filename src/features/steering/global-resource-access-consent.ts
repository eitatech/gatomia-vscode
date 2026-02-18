import type { OutputChannel } from "vscode";
import {
	commands,
	ConfigurationTarget,
	type ExtensionContext,
	window,
	workspace,
} from "vscode";
import { VSC_CONFIG_NAMESPACE } from "../../constants";

const GLOBAL_ACCESS_DEFAULT_KEY = "steering.globalResourceAccessDefault";
const WORKSPACE_ACCESS_OVERRIDE_KEY = "steering.workspaceGlobalResourceAccess";

const ALLOW_WORKSPACE_OPTION = "Allow for This Workspace";
const DENY_WORKSPACE_OPTION = "Deny for This Workspace";
const OPEN_SETTINGS_OPTION = "Open Settings";

let dismissedConsentPromptInSession = false;

type GlobalAccessDefault = "ask" | "allow" | "deny";
type WorkspaceAccessOverride = "inherit" | "allow" | "deny";
type EffectiveAccess = "ask" | "allow" | "deny";

function getConfig() {
	return workspace.getConfiguration(VSC_CONFIG_NAMESPACE);
}

function getGlobalAccessDefault(): GlobalAccessDefault {
	const value = getConfig().get<GlobalAccessDefault>(GLOBAL_ACCESS_DEFAULT_KEY);
	if (value === "allow" || value === "deny" || value === "ask") {
		return value;
	}

	return "ask";
}

function getWorkspaceAccessOverride(): WorkspaceAccessOverride {
	const value = getConfig().get<WorkspaceAccessOverride>(
		WORKSPACE_ACCESS_OVERRIDE_KEY
	);
	if (value === "allow" || value === "deny" || value === "inherit") {
		return value;
	}

	return "inherit";
}

export function getEffectiveGlobalResourceAccess(): EffectiveAccess {
	const workspaceOverride = getWorkspaceAccessOverride();
	if (workspaceOverride === "allow" || workspaceOverride === "deny") {
		return workspaceOverride;
	}

	return getGlobalAccessDefault();
}

export function isGlobalResourceAccessAllowed(): boolean {
	return getEffectiveGlobalResourceAccess() === "allow";
}

export async function setWorkspaceGlobalResourceAccess(
	value: Exclude<WorkspaceAccessOverride, "inherit">
): Promise<void> {
	await getConfig().update(
		WORKSPACE_ACCESS_OVERRIDE_KEY,
		value,
		ConfigurationTarget.Workspace
	);
}

export async function openGlobalResourceAccessSettings(): Promise<void> {
	await commands.executeCommand(
		"workbench.action.openSettings",
		`${VSC_CONFIG_NAMESPACE}.steering.workspaceGlobalResourceAccess`
	);
}

export async function ensureGlobalResourceAccessConsent(
	context: ExtensionContext,
	outputChannel?: OutputChannel
): Promise<boolean> {
	const effectiveAccess = getEffectiveGlobalResourceAccess();
	if (effectiveAccess === "allow") {
		return true;
	}

	if (effectiveAccess === "deny") {
		return false;
	}

	if (dismissedConsentPromptInSession) {
		return false;
	}

	const choice = await window.showInformationMessage(
		"GatomIA needs your permission to read global Copilot resources in your home directory for this workspace. This may include ~/.github/copilot-instructions.md, ~/.github/instructions/*.instructions.md, and global Prompts/Skills/Agents paths when available.",
		{ modal: true },
		ALLOW_WORKSPACE_OPTION,
		DENY_WORKSPACE_OPTION,
		OPEN_SETTINGS_OPTION
	);

	if (choice === ALLOW_WORKSPACE_OPTION) {
		await setWorkspaceGlobalResourceAccess("allow");
		await context.workspaceState.update(
			"gatomia.steering.globalResourceAccess.lastDecision",
			"allow"
		);
		outputChannel?.appendLine("[Steering Consent] Workspace decision: allow");
		return true;
	}

	if (choice === DENY_WORKSPACE_OPTION) {
		await setWorkspaceGlobalResourceAccess("deny");
		await context.workspaceState.update(
			"gatomia.steering.globalResourceAccess.lastDecision",
			"deny"
		);
		outputChannel?.appendLine("[Steering Consent] Workspace decision: deny");
		return false;
	}

	if (choice === OPEN_SETTINGS_OPTION) {
		await openGlobalResourceAccessSettings();
	}

	dismissedConsentPromptInSession = true;
	outputChannel?.appendLine(
		"[Steering Consent] Prompt dismissed for current session"
	);
	return false;
}

export function resetGlobalResourceAccessConsentSessionForTests(): void {
	dismissedConsentPromptInSession = false;
}
