/**
 * Requirement Profile Module
 *
 * Computes which dependencies are required, optional, or hidden on a given
 * IDE host. This is the single source of truth shared by the Welcome Screen
 * provider (extension side) and its React view (webview side), so UI state
 * and install-all logic can never drift.
 *
 * Rules:
 * - Windsurf → Devin CLI required; Copilot CLI optional;
 *   Copilot Chat + Gemini CLI hidden (Copilot Chat is not compatible with
 *   Windsurf, chat is routed via Devin ACP).
 * - Antigravity → Gemini CLI required; Copilot CLI optional;
 *   Copilot Chat + Devin CLI hidden (Copilot Chat is not compatible with
 *   Antigravity, chat is routed via Gemini ACP).
 * - VS Code / Cursor / VSCodium / Insiders / Positron / unknown → Copilot
 *   Chat + Copilot CLI required; Devin + Gemini hidden (current behaviour
 *   preserved).
 *
 * SpecKit and OpenSpec are always both visible. The spec-system requirement
 * is satisfied if at least one of them is installed; the `missing` list
 * recommends SpecKit by default when neither is present.
 */

import type { IdeHost } from "../../utils/ide-host-detector";
import type {
	DependencyStatus,
	InstallableDependency,
} from "../../types/welcome";

export type DepKey = InstallableDependency;

export interface RequirementProfile {
	required: DepKey[];
	optional: DepKey[];
	hidden: DepKey[];
	/** True when `speckit` or `openspec` is installed. */
	specSystemReady: boolean;
	/**
	 * Required dependencies that are not yet installed. The ordering is
	 * install-friendly: CLI prerequisites (Copilot CLI / Devin / Gemini)
	 * come before spec systems and GatomIA CLI, which depend on them.
	 */
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

/**
 * Compute the required/optional/hidden/missing profile for a given IDE host
 * and dependency snapshot.
 *
 * Pure function — no side effects, no VS Code API usage — so it can be
 * shared with the webview.
 */
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
		// Recommend SpecKit as the default spec system when neither is
		// installed. Users can still install OpenSpec individually from the
		// per-card button.
		missing.push("speckit");
	}

	// GatomIA CLI depends on the preferred provider CLI + a spec system.
	// Ensure the provider CLI comes before the spec system which comes
	// before gatomia-cli in `missing` to support chained install.
	missing.sort((a, b) => installOrderWeight(a) - installOrderWeight(b));

	return {
		required,
		optional,
		hidden,
		specSystemReady,
		missing,
	};
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
