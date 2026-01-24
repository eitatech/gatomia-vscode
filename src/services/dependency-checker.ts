/**
 * DependencyChecker Service
 * Detects installation status and versions of GatomIA dependencies
 * Based on specs/006-welcome-screen/research.md section 0
 */

import { type OutputChannel, extensions } from "vscode";
import type { DependencyStatus } from "../types/welcome";
import { checkCLI } from "../utils/cli-detector";

interface CLIDetectionResult {
	installed: boolean;
	version: string | null;
}

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
		const [speckit, openspec] = await Promise.all([
			this.checkSpecKitCLI(),
			this.checkOpenSpecCLI(),
		]);

		const result: DependencyStatus = {
			copilotChat,
			speckit,
			openspec,
			lastChecked: Date.now(),
		};

		// Update cache
		this.cache = {
			timestamp: Date.now(),
			result,
		};

		this.outputChannel.appendLine(
			`[DependencyChecker] Check complete: Copilot=${copilotChat.installed}, SpecKit=${speckit.installed}, OpenSpec=${openspec.installed}`
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
	 * Command: specify version (same as DependenciesViewProvider)
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
