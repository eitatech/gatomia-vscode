/**
 * Install Commands Module
 *
 * Single source of truth for dependency install commands used by the Welcome
 * Screen's "Install Missing Dependencies" button.
 *
 * Platform-aware: produces shell commands for macOS, Linux, and Windows.
 * Dependency-aware: maps each `InstallableDependency` to the canonical
 * install step(s), including transitive system prerequisites (Node.js,
 * Python, UV) when required.
 */

import type {
	InstallableDependency,
	SystemPrerequisiteKey,
} from "../../types/welcome";

export type Platform = "darwin" | "linux" | "win32";

export type InstallStepKind = "terminal" | "vscode-command" | "open-url";

export interface InstallStep {
	id: string;
	label: string;
	kind: InstallStepKind;
	/** Shell command for `terminal` steps. */
	command?: string;
	/** VS Code command identifier for `vscode-command` steps. */
	vscodeCommand?: string;
	vscodeArgs?: unknown[];
	/** URL to open for `open-url` steps. */
	url?: string;
}

const NODE_COMMAND: Record<Platform, string> = {
	darwin: "brew install node@22",
	linux:
		"curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt-get install -y nodejs",
	win32: "winget install --id OpenJS.NodeJS.LTS -e",
};

const PYTHON_COMMAND: Record<Platform, string> = {
	darwin: "brew install python@3.11",
	linux: "sudo apt-get install -y python3.11 python3.11-venv",
	win32: "winget install --id Python.Python.3.11 -e",
};

const UV_COMMAND: Record<Platform, string> = {
	darwin: "curl -LsSf https://astral.sh/uv/install.sh | sh",
	linux: "curl -LsSf https://astral.sh/uv/install.sh | sh",
	win32:
		'powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"',
};

const SPECKIT_COMMAND =
	"uv tool install specify-cli --from git+https://github.com/github/spec-kit.git";

const OPENSPEC_COMMAND = "npm install -g @fission-ai/openspec@latest";

const COPILOT_CLI_COMMAND = "npm install -g @github/copilot";

const GATOMIA_CLI_COMMAND =
	"uv tool install gatomia --from git+https://github.com/eitatech/gatomia-cli.git";

/**
 * Devin CLI install command.
 *
 * Upstream install instructions: https://cli.devin.ai/docs/installation
 *
 * The canonical install script is the same across Unix-like platforms.
 * Windows support is best-effort — the script relies on POSIX tools, so we
 * fall back to opening the install URL on `win32`.
 */
const DEVIN_INSTALL_URL = "https://cli.devin.ai/docs/installation";
const DEVIN_SHELL_COMMAND =
	"curl -fsSL https://install.devin.ai/install.sh | sh";

const GEMINI_CLI_COMMAND = "npm install -g @google/gemini-cli";

const nodeStep = (platform: Platform): InstallStep => ({
	id: "node",
	label: "Install Node.js",
	kind: "terminal",
	command: NODE_COMMAND[platform],
});

const pythonStep = (platform: Platform): InstallStep => ({
	id: "python",
	label: "Install Python 3.11+",
	kind: "terminal",
	command: PYTHON_COMMAND[platform],
});

const uvStep = (platform: Platform): InstallStep => ({
	id: "uv",
	label: "Install uv package manager",
	kind: "terminal",
	command: UV_COMMAND[platform],
});

/**
 * Returns the install step for a single system prerequisite (Node.js,
 * Python, uv) on the given platform. Used by the Welcome Screen's System
 * Prerequisites grid to trigger an individual prereq install.
 */
export const getPrerequisiteInstallStep = (
	key: SystemPrerequisiteKey,
	platform: Platform
): InstallStep => {
	switch (key) {
		case "node":
			return nodeStep(platform);
		case "python":
			return pythonStep(platform);
		case "uv":
			return uvStep(platform);
		default: {
			const _exhaustive: never = key;
			return _exhaustive;
		}
	}
};

/**
 * Returns the ordered steps needed to install a single dependency on the given
 * platform. The steps intentionally do NOT include prerequisites — use
 * {@link resolveMissingWithPrereqs} to expand a list of missing deps into a
 * fully ordered install sequence.
 */
export const getInstallPlan = (
	dep: InstallableDependency,
	platform: Platform
): InstallStep[] => {
	switch (dep) {
		case "copilot-chat":
			return [
				{
					id: "copilot-chat",
					label: "Install GitHub Copilot Chat extension",
					kind: "vscode-command",
					vscodeCommand: "workbench.extensions.installExtension",
					vscodeArgs: ["github.copilot-chat"],
				},
			];
		case "copilot-cli":
			return [
				{
					id: "copilot-cli",
					label: "Install GitHub Copilot CLI",
					kind: "terminal",
					command: COPILOT_CLI_COMMAND,
				},
			];
		case "speckit":
			return [
				{
					id: "speckit",
					label: "Install SpecKit (Specify CLI)",
					kind: "terminal",
					command: SPECKIT_COMMAND,
				},
			];
		case "openspec":
			return [
				{
					id: "openspec",
					label: "Install OpenSpec CLI",
					kind: "terminal",
					command: OPENSPEC_COMMAND,
				},
			];
		case "gatomia-cli":
			return [
				{
					id: "gatomia-cli",
					label: "Install GatomIA CLI",
					kind: "terminal",
					command: GATOMIA_CLI_COMMAND,
				},
			];
		case "devin-cli":
			if (platform === "win32") {
				return [
					{
						id: "devin-cli",
						label: "Open Devin CLI install instructions",
						kind: "open-url",
						url: DEVIN_INSTALL_URL,
					},
				];
			}
			return [
				{
					id: "devin-cli",
					label: "Install Devin CLI",
					kind: "terminal",
					command: DEVIN_SHELL_COMMAND,
				},
			];
		case "gemini-cli":
			return [
				{
					id: "gemini-cli",
					label: "Install Gemini CLI",
					kind: "terminal",
					command: GEMINI_CLI_COMMAND,
				},
			];
		default: {
			// Exhaustiveness guard for TypeScript.
			const _exhaustive: never = dep;
			return _exhaustive;
		}
	}
};

/**
 * Dependencies that are transitive prerequisites for the given install
 * target. Returned in the order they must be run.
 */
const transitivePrereqSteps = (
	dep: InstallableDependency,
	platform: Platform
): InstallStep[] => {
	switch (dep) {
		case "speckit":
		case "gatomia-cli":
			// uv tool install needs uv, which needs Python available.
			return [pythonStep(platform), uvStep(platform)];
		case "openspec":
		case "copilot-cli":
		case "gemini-cli":
			// npm install -g needs Node.js + npm.
			return [nodeStep(platform)];
		case "copilot-chat":
		case "devin-cli":
			return [];
		default: {
			const _exhaustive: never = dep;
			return _exhaustive;
		}
	}
};

/**
 * Expand a list of missing dependencies into a flat, ordered install queue,
 * prepending any transitive system prerequisites (Node.js, Python, UV) when
 * required and deduplicating steps by `id`.
 *
 * The returned list preserves the relative order of the input `missing`
 * dependencies.
 */
export const resolveMissingWithPrereqs = (
	missing: InstallableDependency[],
	platform: Platform
): InstallStep[] => {
	const seen = new Set<string>();
	const queue: InstallStep[] = [];
	const append = (step: InstallStep): void => {
		if (!seen.has(step.id)) {
			seen.add(step.id);
			queue.push(step);
		}
	};

	for (const dep of missing) {
		for (const prereq of transitivePrereqSteps(dep, platform)) {
			append(prereq);
		}
		for (const step of getInstallPlan(dep, platform)) {
			append(step);
		}
	}

	return queue;
};
