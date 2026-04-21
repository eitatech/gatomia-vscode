import { env } from "vscode";

/**
 * Recognised IDE host identifiers for GatomIA multi-IDE integration.
 *
 * Windsurf and Antigravity are VS Code forks that do not expose their chat
 * window through a public API, so GatomIA routes prompts to their companion
 * CLIs (Devin / Gemini) via the Agent Client Protocol (ACP).
 */
export type IdeHost =
	| "windsurf"
	| "antigravity"
	| "cursor"
	| "vscode"
	| "vscode-insiders"
	| "vscodium"
	| "positron"
	| "unknown";

interface HostRule {
	host: IdeHost;
	pattern: RegExp;
}

/**
 * Ordered detection rules. Order matters: more specific matches first, generic
 * "Code" match last so that Insiders / forks that also contain "Code" in their
 * product name still resolve to the correct host.
 */
const HOST_RULES: readonly HostRule[] = [
	{ host: "windsurf", pattern: /windsurf/i },
	{ host: "antigravity", pattern: /antigravity/i },
	{ host: "cursor", pattern: /cursor/i },
	{ host: "vscode-insiders", pattern: /insiders/i },
	{ host: "vscodium", pattern: /vscodium/i },
	{ host: "positron", pattern: /positron/i },
	{ host: "vscode", pattern: /visual studio code|^code$|^code\b/i },
] as const;

/**
 * Detect the IDE host the extension is running in by inspecting
 * `vscode.env.appName`. Returns `"unknown"` when no rule matches.
 *
 * This function is synchronous and cheap; callers may invoke it freely.
 */
export const detectIdeHost = (): IdeHost => {
	const appName = (env.appName ?? "").trim();
	if (!appName) {
		return "unknown";
	}

	for (const rule of HOST_RULES) {
		if (rule.pattern.test(appName)) {
			return rule.host;
		}
	}

	return "unknown";
};

/**
 * Returns true when the current host is a candidate for ACP-based routing
 * (Windsurf or Antigravity), AND the extension is running locally.
 *
 * Remote workspaces (SSH, WSL, web) cannot spawn local CLI subprocesses from
 * the extension host, so ACP is disabled in those environments regardless of
 * the IDE.
 */
export const isAcpCandidateHost = (): boolean => {
	if (env.remoteName) {
		return false;
	}
	const host = detectIdeHost();
	return host === "windsurf" || host === "antigravity";
};
