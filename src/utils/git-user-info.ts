// biome-ignore lint/performance/noNamespaceImport: Required for dependency injection testability
import * as childProcess from "node:child_process";
import { userInfo } from "node:os";
import type {
	IGitUserInfoProvider,
	GitUserInfo,
} from "../features/documents/version-tracking/types";

/**
 * Type for execSync function signature
 */
type ExecSyncFn = typeof childProcess.execSync;

/**
 * Provides Git user.name and user.email for owner attribution.
 * Falls back to system username if Git not configured.
 *
 * Usage:
 * ```typescript
 * const provider = new GitUserInfoProvider();
 * const info = provider.getUserInfo();
 * const owner = provider.formatOwner(info); // "Italo <email>"
 * ```
 */
export class GitUserInfoProvider implements IGitUserInfoProvider {
	/**
	 * Default email suffix for system username fallback
	 */
	private readonly DEFAULT_EMAIL_DOMAIN = "localhost";

	/**
	 * execSync function (can be mocked for testing)
	 */
	private readonly execSync: ExecSyncFn;

	/**
	 * Create GitUserInfoProvider instance.
	 *
	 * @param execSync Optional execSync function for testing
	 */
	constructor(execSync: ExecSyncFn = childProcess.execSync) {
		this.execSync = execSync;
	}

	/**
	 * Get Git user.name and user.email from Git config.
	 * Falls back to system username if Git not configured.
	 *
	 * @returns GitUserInfo object with name and email
	 */
	getUserInfo(): GitUserInfo {
		const name =
			this.getGitConfigValue("user.name") || this.getSystemUsername();
		const email =
			this.getGitConfigValue("user.email") || this.getDefaultEmail();

		return { name, email };
	}

	/**
	 * Format owner string in standard format "[Name] <[email]>".
	 *
	 * @param info Git user info
	 * @returns Formatted owner string
	 */
	formatOwner(info: GitUserInfo): string {
		return `${info.name} <${info.email}>`;
	}

	/**
	 * Check if Git is available and configured.
	 *
	 * @returns true if git config user.name and user.email are set
	 */
	isGitConfigured(): boolean {
		const name = this.getGitConfigValue("user.name");
		const email = this.getGitConfigValue("user.email");

		return Boolean(name && email);
	}

	/**
	 * Execute git config command to read a value.
	 * Returns empty string if command fails or value is not set.
	 *
	 * @param key Git config key (e.g., "user.name")
	 * @returns Config value trimmed, or empty string if not available
	 */
	private getGitConfigValue(key: string): string {
		try {
			const result = this.execSync(`git config ${key}`, {
				encoding: "utf8",
				stdio: ["pipe", "pipe", "ignore"], // Suppress stderr
			});
			return result.trim();
		} catch {
			// Git not available or key not set
			return "";
		}
	}

	/**
	 * Get system username as fallback.
	 *
	 * @returns System username
	 */
	private getSystemUsername(): string {
		return userInfo().username || "unknown";
	}

	/**
	 * Generate default email from system username.
	 *
	 * @returns Default email in format "username@localhost"
	 */
	private getDefaultEmail(): string {
		return `${this.getSystemUsername()}@${this.DEFAULT_EMAIL_DOMAIN}`;
	}
}
