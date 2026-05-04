/**
 * Requirement Profile Module (webview mirror)
 *
 * Mirror of `src/services/welcome/requirements.ts`. Duplicated because the
 * webview bundle (Vite) cannot import from the extension bundle (esbuild).
 * A parity test under `src/services/welcome/requirements.test.ts` guards
 * against drift.
 */

import type { DependencyStatus, IdeHost, InstallableDependency } from "./types";

export type DepKey = InstallableDependency;

export interface RequirementProfile {
	required: DepKey[];
	optional: DepKey[];
	hidden: DepKey[];
	specSystemReady: boolean;
	missing: DepKey[];
}

const isAcpHost = (host: IdeHost): host is "windsurf" | "antigravity" =>
	host === "windsurf" || host === "antigravity";

const isInstalled = (dep: DepKey, deps: DependencyStatus): boolean => {
	switch (dep) {
		case "copilot-chat":
			return deps.copilotChat.installed;
		case "copilot-cli":
			return deps.copilotCli.installed;
		case "speckit":
			return deps.speckit.installed;
		case "openspec":
			return deps.openspec.installed;
		case "gatomia-cli":
			return deps.gatomiaCli.installed;
		case "devin-cli":
			return deps.devinCli?.installed ?? false;
		case "gemini-cli":
			return deps.geminiCli?.installed ?? false;
		default: {
			const _exhaustive: never = dep;
			return _exhaustive;
		}
	}
};

const getRequired = (host: IdeHost): DepKey[] => {
	if (host === "windsurf") {
		return ["devin-cli", "speckit", "openspec", "gatomia-cli"];
	}
	if (host === "antigravity") {
		return ["gemini-cli", "speckit", "openspec", "gatomia-cli"];
	}
	return ["copilot-chat", "copilot-cli", "speckit", "openspec", "gatomia-cli"];
};

const getOptional = (host: IdeHost): DepKey[] => {
	if (isAcpHost(host)) {
		// Copilot Chat is hidden on ACP hosts (incompatible), but Copilot CLI
		// is a standalone npm tool that still works for users who want it.
		return ["copilot-cli"];
	}
	return [];
};

const getHidden = (host: IdeHost): DepKey[] => {
	if (host === "windsurf") {
		return ["copilot-chat", "gemini-cli"];
	}
	if (host === "antigravity") {
		return ["copilot-chat", "devin-cli"];
	}
	return ["devin-cli", "gemini-cli"];
};

const INSTALL_ORDER: Record<DepKey, number> = {
	"copilot-chat": 0,
	"copilot-cli": 1,
	"devin-cli": 1,
	"gemini-cli": 1,
	speckit: 2,
	openspec: 2,
	"gatomia-cli": 3,
};

const installOrderWeight = (dep: DepKey): number => INSTALL_ORDER[dep];

export const computeRequirementProfile = (
	ideHost: IdeHost,
	deps: DependencyStatus
): RequirementProfile => {
	const required = getRequired(ideHost);
	const optional = getOptional(ideHost);
	const hidden = getHidden(ideHost);

	const specSystemReady = deps.speckit.installed || deps.openspec.installed;

	const missing: DepKey[] = [];
	for (const dep of required) {
		if (dep === "speckit" || dep === "openspec") {
			continue;
		}
		if (!isInstalled(dep, deps)) {
			missing.push(dep);
		}
	}

	if (!specSystemReady) {
		missing.push("speckit");
	}

	missing.sort((a, b) => installOrderWeight(a) - installOrderWeight(b));

	return {
		required,
		optional,
		hidden,
		specSystemReady,
		missing,
	};
};
