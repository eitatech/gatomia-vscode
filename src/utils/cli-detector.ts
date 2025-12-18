/**
 * CLI Detector Utility
 * Shared dependency detection logic with extended PATH support
 * Used by both DependenciesViewProvider and DependencyChecker
 */

import { exec } from "node:child_process";
import { homedir } from "node:os";
import { promisify } from "node:util";

const execAsync = promisify(exec);

/**
 * Get extended PATH including common CLI tool installation directories
 * This ensures we can find tools installed via UV, Cargo, Homebrew, etc.
 */
export const getExtendedPath = (): string => {
	const home = homedir();
	const additionalPaths = [
		`${home}/.local/bin`, // UV tools (specify)
		`${home}/.cargo/bin`, // Rust tools
		`${home}/.bun/bin`, // Bun
		`${home}/.deno/bin`, // Deno
		`${home}/.langflow/uv`, // UV via Langflow installation
		`${home}/.astral/uv/bin`, // UV via Astral installation
		`${home}/.uv/bin`, // Alternative UV location
		"/opt/homebrew/bin", // Homebrew on Apple Silicon
		"/usr/local/bin", // Homebrew on Intel Mac
	];
	const currentPath = process.env.PATH || "";
	return [...additionalPaths, currentPath].join(":");
};

/**
 * Version extraction patterns in order of preference
 */
const VERSION_PATTERNS = [
	/v?(\d+\.\d+\.\d+)/i,
	/version\s+(\d+\.\d+\.\d+)/i,
	/(\d+\.\d+\.\d+)/,
] as const;

/**
 * Extract version number from CLI output
 */
export const extractVersion = (output: string): string | undefined => {
	for (const pattern of VERSION_PATTERNS) {
		const match = output.match(pattern);
		if (match) {
			return match[1];
		}
	}
	return;
};

export interface CLICheckResult {
	installed: boolean;
	version: string | null;
	output?: string;
	error?: string;
}

/**
 * Check if a CLI tool is installed by running a version command
 * Uses extended PATH to find tools in common installation directories
 *
 * @param command - Command to run (e.g., "specify --version")
 * @param timeoutMs - Timeout in milliseconds (default: 5000)
 * @returns Result with installed status and version
 */
export const checkCLI = async (
	command: string,
	timeoutMs = 5000
): Promise<CLICheckResult> => {
	try {
		const { stdout, stderr } = await execAsync(command, {
			timeout: timeoutMs,
			encoding: "utf8",
			env: {
				...process.env,
				PATH: getExtendedPath(),
			},
		});

		const output = stdout.trim() || stderr.trim();

		// Try JSON parse first (some CLIs output JSON)
		try {
			const json = JSON.parse(output);
			if (json.version) {
				return {
					installed: true,
					version: json.version,
					output,
				};
			}
		} catch {
			// Not JSON, continue to regex parsing
		}

		// Extract version from text output
		const version = extractVersion(output);

		return {
			installed: true,
			version: version || output || "unknown",
			output,
		};
	} catch (error: any) {
		// Command not found (not in PATH)
		if (error.code === "ENOENT") {
			return {
				installed: false,
				version: null,
				error: "Command not found",
			};
		}

		// Timeout
		if (error.killed || error.signal === "SIGTERM") {
			return {
				installed: false,
				version: null,
				error: `Command timed out after ${timeoutMs}ms`,
			};
		}

		// Other errors
		return {
			installed: false,
			version: null,
			error: error.message || String(error),
		};
	}
};
