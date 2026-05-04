/**
 * DependencyChecker Service
 * Detects installation status and versions of GatomIA dependencies and
 * system-level prerequisites (Node.js, Python, uv).
 * Based on specs/006-welcome-screen/research.md section 0.
 */

import { type OutputChannel, extensions } from "vscode";
import type {
	DependencyStatus,
	SystemPrerequisiteKey,
	SystemPrerequisiteStatus,
} from "../types/welcome";
import { checkCLI } from "../utils/cli-detector";
import { probeDevinCli } from "./acp/providers/devin-cli-probe";
import { probeGeminiCli } from "./acp/providers/gemini-cli-probe";

interface CacheEntry {
	timestamp: number;
	result: DependencyStatus;
}

export class DependencyChecker {
	private static readonly CACHE_TTL_MS = 60_000; // 60 seconds
	/**
	 * CLI invocation timeout.
	 * Shorten automatically under Vitest to keep unit tests below the default 5s test timeout.
	 * Can also be overridden via GATOMIA_CLI_TIMEOUT_MS for debugging.
	 */
	private static readonly CLI_TIMEOUT_MS: number = Number.parseInt(
		process.env.GATOMIA_CLI_TIMEOUT_MS ??
			(process.env.VITEST_WORKER_ID ? "1000" : "5000"),
		10
	);

	private cache: CacheEntry | null = null;
	private readonly outputChannel: OutputChannel;

	constructor(outputChannel: OutputChannel) {
		this.outputChannel = outputChannel;
	}

	/**
	 * Check all dependencies with caching
	 * @param forceRefresh - Bypass cache and re-check
	 */
	async checkAll(forceRefresh = false): Promise<DependencyStatus> {
		// Return cached result if valid and not forcing refresh
		if (!forceRefresh && this.cache && this.isCacheValid()) {
			this.outputChannel.appendLine(
				"[DependencyChecker] Returning cached dependency status"
			);
			return this.cache.result;
		}

		this.outputChannel.appendLine(
			"[DependencyChecker] Checking all dependencies..."
		);

		const copilotChat = this.checkCopilotChat();
		const [
			speckit,
			openspec,
			copilotCli,
			gatomiaCli,
			devinProbe,
			geminiProbe,
			node,
			python,
			uv,
		] = await Promise.all([
			this.checkSpecKitCLI(),
			this.checkOpenSpecCLI(),
			this.checkCopilotCLI(),
			this.checkGatomiaCLI(),
			probeDevinCli(DependencyChecker.CLI_TIMEOUT_MS),
			probeGeminiCli(DependencyChecker.CLI_TIMEOUT_MS),
			this.checkNode(),
			this.checkPython(),
			this.checkUv(),
		]);

		const result: DependencyStatus = {
			copilotChat,
			speckit,
			openspec,
			copilotCli,
			gatomiaCli,
			devinCli: {
				installed: devinProbe.installed,
				version: devinProbe.version,
				authenticated: devinProbe.authenticated,
				acpSupported: devinProbe.acpSupported,
			},
			geminiCli: {
				installed: geminiProbe.installed,
				version: geminiProbe.version,
				authenticated: geminiProbe.authenticated,
				acpSupported: geminiProbe.acpSupported,
			},
			prerequisites: {
				node,
				python,
				uv,
			},
			lastChecked: Date.now(),
		};

		// Update cache
		this.cache = {
			timestamp: Date.now(),
			result,
		};

		this.outputChannel.appendLine(
			`[DependencyChecker] Check complete: Copilot=${copilotChat.installed}, SpecKit=${speckit.installed}, OpenSpec=${openspec.installed}, CopilotCLI=${copilotCli.installed}, GatomIA=${gatomiaCli.installed}, Devin=${devinProbe.installed}(auth=${devinProbe.authenticated}), Gemini=${geminiProbe.installed}(auth=${geminiProbe.authenticated}), Node=${node.installed}, Python=${python.installed}, UV=${uv.installed}`
		);

		return result;
	}

	/**
	 * Invalidate cache to force re-check on next call
	 */
	invalidateCache(): void {
		this.outputChannel.appendLine("[DependencyChecker] Cache invalidated");
		this.cache = null;
	}

	/**
	 * Check GitHub Copilot Chat extension
	 * Uses VS Code extension API (synchronous, no timeout needed)
	 */
	private checkCopilotChat(): DependencyStatus["copilotChat"] {
		try {
			const extension = extensions.getExtension("github.copilot-chat");

			if (!extension) {
				this.outputChannel.appendLine(
					"[DependencyChecker] GitHub Copilot Chat: NOT installed"
				);
				return {
					installed: false,
					active: false,
					version: null,
				};
			}

			const version = extension.packageJSON?.version || null;
			const active = extension.isActive;

			this.outputChannel.appendLine(
				`[DependencyChecker] GitHub Copilot Chat: installed (v${version || "unknown"}), ${active ? "active" : "inactive"}`
			);

			return {
				installed: true,
				active,
				version,
			};
		} catch (error) {
			this.outputChannel.appendLine(
				`[DependencyChecker] Error checking Copilot Chat: ${error}`
			);
			return {
				installed: false,
				active: false,
				version: null,
			};
		}
	}

	/**
	 * Check SpecKit CLI installation
	 * Command: specify version
	 * Uses extended PATH to find UV-installed tools
	 */
	private async checkSpecKitCLI(): Promise<DependencyStatus["speckit"]> {
		const result = await checkCLI(
			"specify version",
			DependencyChecker.CLI_TIMEOUT_MS
		);

		this.outputChannel.appendLine(
			`[DependencyChecker] SpecKit CLI: ${result.installed ? `installed (v${result.version || "unknown"})` : "NOT installed"}${result.error ? ` - ${result.error}` : ""}`
		);

		return {
			installed: result.installed,
			version: result.version,
		};
	}

	/**
	 * Check OpenSpec CLI installation
	 * Command: openspec --version
	 * Uses extended PATH to find installed tools
	 */
	private async checkOpenSpecCLI(): Promise<DependencyStatus["openspec"]> {
		const result = await checkCLI(
			"openspec --version",
			DependencyChecker.CLI_TIMEOUT_MS
		);

		this.outputChannel.appendLine(
			`[DependencyChecker] OpenSpec CLI: ${result.installed ? `installed (v${result.version || "unknown"})` : "NOT installed"}${result.error ? ` - ${result.error}` : ""}`
		);

		return {
			installed: result.installed,
			version: result.version,
		};
	}

	private async checkCopilotCLI(): Promise<DependencyStatus["copilotCli"]> {
		const primary = await checkCLI(
			"copilot --version",
			DependencyChecker.CLI_TIMEOUT_MS
		);
		const result = primary.installed
			? primary
			: await checkCLI(
					"github-copilot --version",
					DependencyChecker.CLI_TIMEOUT_MS
				);

		this.outputChannel.appendLine(
			`[DependencyChecker] Copilot CLI: ${result.installed ? `installed (v${result.version || "unknown"})` : "NOT installed"}${result.error ? ` - ${result.error}` : ""}`
		);

		return {
			installed: result.installed,
			version: result.version,
		};
	}

	private async checkGatomiaCLI(): Promise<DependencyStatus["gatomiaCli"]> {
		const primary = await checkCLI(
			"gatomia --version",
			DependencyChecker.CLI_TIMEOUT_MS
		);
		const result = primary.installed
			? primary
			: await checkCLI("mia --version", DependencyChecker.CLI_TIMEOUT_MS);

		this.outputChannel.appendLine(
			`[DependencyChecker] GatomIA CLI: ${result.installed ? `installed (v${result.version || "unknown"})` : "NOT installed"}${result.error ? ` - ${result.error}` : ""}`
		);

		return {
			installed: result.installed,
			version: result.version,
		};
	}

	/**
	 * Check Node.js installation.
	 * Uses `node --version` which returns e.g. `v20.10.0`.
	 */
	private checkNode(): Promise<SystemPrerequisiteStatus> {
		return this.checkPrerequisite("node", "node --version");
	}

	/**
	 * Check Python installation.
	 * Prefers `python3 --version` (macOS/Linux convention) and falls back to
	 * `python --version` (Windows + some Linux distros).
	 */
	private async checkPython(): Promise<SystemPrerequisiteStatus> {
		const primary = await checkCLI(
			"python3 --version",
			DependencyChecker.CLI_TIMEOUT_MS
		);
		const result = primary.installed
			? primary
			: await checkCLI("python --version", DependencyChecker.CLI_TIMEOUT_MS);

		this.outputChannel.appendLine(
			`[DependencyChecker] Python: ${result.installed ? `installed (v${result.version || "unknown"})` : "NOT installed"}${result.error ? ` - ${result.error}` : ""}`
		);

		return {
			installed: result.installed,
			version: result.version,
		};
	}

	/**
	 * Check the uv package manager installation.
	 * uv is required to install SpecKit and GatomIA CLI via `uv tool install`.
	 */
	private checkUv(): Promise<SystemPrerequisiteStatus> {
		return this.checkPrerequisite("uv", "uv --version");
	}

	/**
	 * Shared helper for prerequisites with a single probing command.
	 */
	private async checkPrerequisite(
		key: SystemPrerequisiteKey,
		command: string
	): Promise<SystemPrerequisiteStatus> {
		const result = await checkCLI(command, DependencyChecker.CLI_TIMEOUT_MS);

		this.outputChannel.appendLine(
			`[DependencyChecker] ${key}: ${result.installed ? `installed (v${result.version || "unknown"})` : "NOT installed"}${result.error ? ` - ${result.error}` : ""}`
		);

		return {
			installed: result.installed,
			version: result.version,
		};
	}

	/**
	 * Check if cache is still valid based on TTL
	 */
	private isCacheValid(): boolean {
		if (!this.cache) {
			return false;
		}

		const age = Date.now() - this.cache.timestamp;
		return age < DependencyChecker.CACHE_TTL_MS;
	}

	/**
	 * Get cache age in milliseconds (for testing/debugging)
	 */
	getCacheAge(): number | null {
		if (!this.cache) {
			return null;
		}
		return Date.now() - this.cache.timestamp;
	}
}
