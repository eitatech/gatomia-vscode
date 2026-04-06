/**
 * KnownAgentDetector
 *
 * Checks whether a known ACP agent is installed on the local system.
 * Supports two strategies:
 *   - `npm-global`: runs `npm list -g <package> --depth=0 --json`
 *   - `path`: resolves the binary through the user's login shell
 *
 * On macOS/Linux the binary check is run inside the user's login shell
 * (`$SHELL -l -c "command -v <binary>"`), so any PATH configuration in
 * `.zshrc`, `.bashrc`, fish config, etc. is honoured — regardless of how
 * the tool was installed (brew, bun, volta, asdf, mise, nix, npm, yarn…).
 * The `-i` (interactive) flag is intentionally omitted to avoid loading
 * prompt integrations (oh-my-zsh, iTerm shell integration, etc.) that
 * pollute stdout. `command -v` is used instead of `which` as it is
 * POSIX-standard and produces no extra output.
 *
 * On Windows `where.exe` is used with the inherited process PATH, which
 * is sufficient because Windows package managers (scoop, winget, choco)
 * all write to the system/user PATH that the Extension Host inherits.
 *
 * Results are cached internally for the lifetime of the instance.
 * Call `preloadAll(entries)` at extension activation time to warm the
 * cache in the background before the user opens the Hooks panel.
 *
 * Never throws — always resolves to a boolean.
 *
 * @feature 001-hooks-refactor Phase 8
 */

import { execFile as execFileCb } from "node:child_process";
import { platform } from "node:os";
import type {
	KnownAgentEntry,
	InstallCheckStrategy,
} from "./known-agent-catalog";

const LOG_PREFIX = "[KnownAgentDetector]";
const EXEC_TIMEOUT_MS = 10_000;

// ============================================================================
// Shell resolution helpers
// ============================================================================

/**
 * Returns the user's login shell on Unix systems.
 * Falls back to `/bin/sh` when $SHELL is not set or is empty.
 */
const getUserShell = (): string => process.env.SHELL || "/bin/sh";

/**
 * Derives a stable cache key from an ordered list of install-check strategies.
 * Uses the first strategy's target as the key — sufficient because each known
 * agent has a unique primary binary/package name.
 */
const cacheKeyFor = (strategies: InstallCheckStrategy[]): string =>
	strategies.length > 0
		? `${strategies[0].strategy}:${strategies[0].target}`
		: "";

// ============================================================================
// Implementation
// ============================================================================

/**
 * Detects whether a known ACP agent is locally installed.
 *
 * Caches results in memory so subsequent calls never re-spawn subprocesses.
 * Use `preloadAll()` at extension activation to warm the cache eagerly.
 */
export class KnownAgentDetector {
	/**
	 * In-memory cache keyed by the first strategy's `strategy:target`.
	 * Entries are never invalidated during the session — installing/uninstalling
	 * a binary requires a window reload anyway.
	 */
	private readonly cache = new Map<string, boolean>();

	// -------------------------------------------------------------------------
	// Public API
	// -------------------------------------------------------------------------

	/**
	 * Warms the cache for every entry in `catalog` by running detection for all
	 * agents concurrently. Designed to be called once during extension activation
	 * so results are ready before the user opens the Hooks panel.
	 *
	 * Never throws — individual failures are silently treated as "not installed".
	 */
	async preloadAll(catalog: readonly KnownAgentEntry[]): Promise<void> {
		await Promise.allSettled(
			catalog.map((entry) => this.isInstalledAny(entry.installChecks))
		);
	}

	/**
	 * Tries each strategy in `strategies` in order.
	 * Returns `true` as soon as one succeeds, `false` if all fail.
	 * Results are cached; subsequent calls with the same strategies return
	 * immediately without spawning a subprocess.
	 * Never throws.
	 */
	async isInstalledAny(strategies: InstallCheckStrategy[]): Promise<boolean> {
		const key = cacheKeyFor(strategies);
		if (key && this.cache.has(key)) {
			return this.cache.get(key) as boolean;
		}

		let result = false;
		for (const strategy of strategies) {
			try {
				const found = await this.isInstalled(strategy);
				if (found) {
					result = true;
					break;
				}
			} catch (err) {
				console.log(
					`${LOG_PREFIX} Unexpected error during install check: ${(err as Error).message}`
				);
			}
		}

		if (key) {
			this.cache.set(key, result);
		}
		return result;
	}

	/**
	 * Checks if the agent described by `strategy` is installed.
	 * Returns `false` on any error — never throws.
	 *
	 * @deprecated Prefer `isInstalledAny` with the full `installChecks` array.
	 */
	async isInstalled(strategy: InstallCheckStrategy): Promise<boolean> {
		try {
			if (strategy.strategy === "npm-global") {
				return await this.checkNpmGlobal(strategy.target);
			}
			return await this.checkPath(strategy.target);
		} catch (err) {
			console.log(
				`${LOG_PREFIX} Unexpected error during install check: ${(err as Error).message}`
			);
			return false;
		}
	}

	// -------------------------------------------------------------------------
	// Private helpers
	// -------------------------------------------------------------------------

	private checkNpmGlobal(packageName: string): Promise<boolean> {
		return new Promise<boolean>((resolve) => {
			execFileCb(
				"npm",
				["list", "-g", packageName, "--depth=0", "--json"],
				{ timeout: EXEC_TIMEOUT_MS },
				(err, stdout) => {
					if (err) {
						console.log(
							`${LOG_PREFIX} npm list -g ${packageName} failed: ${err.message}`
						);
						resolve(false);
						return;
					}
					try {
						const parsed = JSON.parse(stdout) as {
							dependencies?: Record<string, unknown>;
						};
						const installed =
							parsed.dependencies !== undefined &&
							Object.hasOwn(parsed.dependencies, packageName);
						resolve(installed);
					} catch {
						console.log(
							`${LOG_PREFIX} Failed to parse npm list output for ${packageName}`
						);
						resolve(false);
					}
				}
			);
		});
	}

	/**
	 * Resolves a binary through the user's actual shell PATH.
	 *
	 * macOS / Linux:
	 *   Spawns `$SHELL -l -c "command -v <binary>"` so that the shell loads its
	 *   login profile (`.zshrc`, `.bashrc`, fish config, etc.) and any PATH
	 *   entries added by bun, volta, asdf, mise, Homebrew, etc. are visible.
	 *   The `-i` (interactive) flag is omitted to prevent prompt integrations
	 *   (oh-my-zsh, iTerm, onefetch) from polluting stdout.
	 *
	 * Windows:
	 *   Uses `where.exe <binary>` with the inherited process PATH, which is
	 *   sufficient because Windows package managers write to the system/user
	 *   PATH that the VS Code Extension Host inherits.
	 */
	private checkPath(binary: string): Promise<boolean> {
		if (platform() === "win32") {
			return this.checkPathWindows(binary);
		}
		return this.checkPathUnix(binary);
	}

	private checkPathUnix(binary: string): Promise<boolean> {
		const shell = getUserShell();
		const commandV = `command -v ${binary}`;

		return new Promise<boolean>((resolve) => {
			execFileCb(
				shell,
				["-l", "-c", commandV],
				{ timeout: EXEC_TIMEOUT_MS },
				(err, stdout) => {
					if (err) {
						console.log(
							`${LOG_PREFIX} ${shell} -l -c "command -v ${binary}" failed: ${err.message}`
						);
						resolve(false);
						return;
					}
					resolve(stdout.trim().length > 0);
				}
			);
		});
	}

	private checkPathWindows(binary: string): Promise<boolean> {
		return new Promise<boolean>((resolve) => {
			execFileCb(
				"where.exe",
				[binary],
				{ timeout: EXEC_TIMEOUT_MS },
				(err, stdout) => {
					if (err) {
						console.log(
							`${LOG_PREFIX} where.exe ${binary} failed: ${err.message}`
						);
						resolve(false);
						return;
					}
					resolve(stdout.trim().length > 0);
				}
			);
		});
	}
}
