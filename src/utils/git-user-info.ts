import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

/**
 * Git user information from git config
 */
export interface GitUserInfo {
	name: string;
	email: string;
}

/**
 * Get Git user information from git config.
 * Falls back to "Unknown" for name and "" for email if not configured.
 */
export async function getGitUserInfo(): Promise<GitUserInfo> {
	try {
		const [nameResult, emailResult] = await Promise.all([
			execAsync("git config user.name").catch(() => ({ stdout: "" })),
			execAsync("git config user.email").catch(() => ({ stdout: "" })),
		]);

		const name = nameResult.stdout.trim() || "Unknown";
		const email = emailResult.stdout.trim();

		return { name, email };
	} catch (error) {
		// Fallback if Git is not available or configured
		return {
			name: "Unknown",
			email: "",
		};
	}
}

/**
 * Format Git user info as "Name <email>" or just "Name" if email is empty
 */
export function formatGitUser(userInfo: GitUserInfo): string {
	if (userInfo.email) {
		return `${userInfo.name} <${userInfo.email}>`;
	}
	return userInfo.name;
}
