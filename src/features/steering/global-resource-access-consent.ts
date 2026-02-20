import {
	commands,
	ConfigurationTarget,
	type ExtensionContext,
	type OutputChannel,
	Uri,
	window,
	workspace,
} from "vscode";
import { VSC_CONFIG_NAMESPACE } from "../../constants";

const GLOBAL_ACCESS_DEFAULT_KEY = "steering.globalResourceAccessDefault";
const WORKSPACE_ACCESS_OVERRIDE_KEY = "steering.workspaceGlobalResourceAccess";
const WORKSPACE_ACCESS_FALLBACK_STATE_KEY =
	"gatomia.steering.workspaceGlobalResourceAccessFallback";
const WORKSPACE_OVERRIDE_SETTING_KEY = `${VSC_CONFIG_NAMESPACE}.steering.workspaceGlobalResourceAccess`;
const FILE_NOT_FOUND_ERROR_PATTERN = /FileNotFound|ENOENT|not found/i;

const ALLOW_WORKSPACE_OPTION = "Allow for This Workspace";
const DENY_WORKSPACE_OPTION = "Deny for This Workspace";
const OPEN_SETTINGS_OPTION = "Open Settings";

let dismissedConsentPromptInSession = false;

type GlobalAccessDefault = "ask" | "allow" | "deny";
type WorkspaceAccessOverride = "inherit" | "allow" | "deny";
type EffectiveAccess = "ask" | "allow" | "deny";

function parseWorkspaceAccessOverride(
	value: unknown
): WorkspaceAccessOverride | undefined {
	if (value === "allow" || value === "deny" || value === "inherit") {
		return value;
	}
}

function getConfig() {
	return workspace.getConfiguration(VSC_CONFIG_NAMESPACE);
}

function getWorkspaceSettingsFileUri(): Uri | undefined {
	const ws = workspace.workspaceFolders?.[0];
	if (!ws) {
		return;
	}

	return Uri.joinPath(ws.uri, ".vscode", "settings.json");
}

async function readWorkspaceSettings(
	settingsUri: Uri,
	outputChannel?: OutputChannel
): Promise<Record<string, unknown>> {
	try {
		const bytes = await workspace.fs.readFile(settingsUri);
		if (!bytes.length) {
			return {};
		}

		const parsed = JSON.parse(Buffer.from(bytes).toString("utf8"));
		if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
			return parsed as Record<string, unknown>;
		}

		outputChannel?.appendLine(
			"[Steering Consent] Workspace settings.json is not a JSON object. Replacing with a new object."
		);
		return {};
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		if (FILE_NOT_FOUND_ERROR_PATTERN.test(message)) {
			return {};
		}

		throw error;
	}
}

async function persistWorkspaceOverrideInSettingsFile(
	value: Exclude<WorkspaceAccessOverride, "inherit">,
	outputChannel?: OutputChannel
): Promise<boolean> {
	const settingsUri = getWorkspaceSettingsFileUri();
	const ws = workspace.workspaceFolders?.[0];
	if (!settingsUri) {
		return false;
	}
	if (!ws) {
		return false;
	}

	try {
		const settingsDirectoryUri = Uri.joinPath(ws.uri, ".vscode");
		await workspace.fs.createDirectory(settingsDirectoryUri);

		const settings = await readWorkspaceSettings(settingsUri, outputChannel);
		settings[WORKSPACE_OVERRIDE_SETTING_KEY] = value;

		const serialized = `${JSON.stringify(settings, null, 2)}\n`;
		await workspace.fs.writeFile(settingsUri, Buffer.from(serialized, "utf8"));
		outputChannel?.appendLine(
			"[Steering Consent] Workspace override persisted in .vscode/settings.json"
		);
		return true;
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		outputChannel?.appendLine(
			`[Steering Consent] Failed to persist override in .vscode/settings.json (${message})`
		);
		return false;
	}
}

function getGlobalAccessDefault(): GlobalAccessDefault {
	const value = getConfig().get<GlobalAccessDefault>(GLOBAL_ACCESS_DEFAULT_KEY);
	if (value === "allow" || value === "deny" || value === "ask") {
		return value;
	}

	return "ask";
}

function getWorkspaceAccessOverride(
	context?: ExtensionContext
): WorkspaceAccessOverride {
	const value = parseWorkspaceAccessOverride(
		getConfig().get<WorkspaceAccessOverride>(WORKSPACE_ACCESS_OVERRIDE_KEY)
	);
	if (value) {
		return value;
	}

	const fallbackValue = parseWorkspaceAccessOverride(
		context?.workspaceState.get<WorkspaceAccessOverride>(
			WORKSPACE_ACCESS_FALLBACK_STATE_KEY
		)
	);
	if (fallbackValue) {
		return fallbackValue;
	}

	return "inherit";
}

export function getEffectiveGlobalResourceAccess(
	context?: ExtensionContext
): EffectiveAccess {
	const workspaceOverride = getWorkspaceAccessOverride(context);
	if (workspaceOverride === "allow" || workspaceOverride === "deny") {
		return workspaceOverride;
	}

	return getGlobalAccessDefault();
}

export function isGlobalResourceAccessAllowed(
	context?: ExtensionContext
): boolean {
	return getEffectiveGlobalResourceAccess(context) === "allow";
}

export async function setWorkspaceGlobalResourceAccess(
	value: Exclude<WorkspaceAccessOverride, "inherit">,
	context?: ExtensionContext,
	outputChannel?: OutputChannel
): Promise<void> {
	try {
		await getConfig().update(
			WORKSPACE_ACCESS_OVERRIDE_KEY,
			value,
			ConfigurationTarget.Workspace
		);
		if (context) {
			await context.workspaceState.update(
				WORKSPACE_ACCESS_FALLBACK_STATE_KEY,
				undefined
			);
		}
		return;
	} catch (error) {
		if (!context) {
			throw error;
		}

		const message = error instanceof Error ? error.message : String(error);

		try {
			await getConfig().update(
				WORKSPACE_ACCESS_OVERRIDE_KEY,
				value,
				ConfigurationTarget.Global
			);
			await context.workspaceState.update(
				WORKSPACE_ACCESS_FALLBACK_STATE_KEY,
				undefined
			);
			outputChannel?.appendLine(
				`[Steering Consent] Failed to persist workspace setting (${message}). Persisted in user profile settings.`
			);
			return;
		} catch {
			// Ignore and continue with workspace settings file fallback.
		}

		const persistedInSettingsFile =
			await persistWorkspaceOverrideInSettingsFile(value, outputChannel);
		if (persistedInSettingsFile) {
			await context.workspaceState.update(
				WORKSPACE_ACCESS_FALLBACK_STATE_KEY,
				undefined
			);
			outputChannel?.appendLine(
				`[Steering Consent] Failed to persist workspace setting (${message}). Persisted in .vscode/settings.json fallback.`
			);
			return;
		}

		await context.workspaceState.update(
			WORKSPACE_ACCESS_FALLBACK_STATE_KEY,
			value
		);
		outputChannel?.appendLine(
			`[Steering Consent] Failed to persist workspace setting (${message}). Using workspace state fallback.`
		);
	}
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
	const effectiveAccess = getEffectiveGlobalResourceAccess(context);
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
		await setWorkspaceGlobalResourceAccess("allow", context, outputChannel);
		await context.workspaceState.update(
			"gatomia.steering.globalResourceAccess.lastDecision",
			"allow"
		);
		outputChannel?.appendLine("[Steering Consent] Workspace decision: allow");
		return true;
	}

	if (choice === DENY_WORKSPACE_OPTION) {
		await setWorkspaceGlobalResourceAccess("deny", context, outputChannel);
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
