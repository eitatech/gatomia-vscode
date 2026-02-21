/**
 * CLI Detector Utility
 * Shared dependency detection logic with extended PATH support
 * Used by both DependenciesViewProvider and DependencyChecker
 */

import { exec } from "node:child_process";
import { homedir } from "node:os";
import { promisify } from "node:util";

const execAsync = promisify(exec);
const COMMAND_SPLIT_REGEX = /\s+/u;
const NEWLINE_SPLIT_REGEX = /\r?\n/u;

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
	const binaryName = command.trim().split(COMMAND_SPLIT_REGEX)[0];
	const extractOutputVersion = (output: string): string | null => {
		const version = extractVersion(output);
		return version || null;
	};

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
			version: version || output || null,
			output,
		};
	} catch (error: unknown) {
		const typedError = error as {
			code?: string | number;
			killed?: boolean;
			signal?: string;
			message?: string;
			stdout?: string;
			stderr?: string;
		};

		// Timeout
		if (typedError.killed || typedError.signal === "SIGTERM") {
			return {
				installed: false,
				version: null,
				error: `Command timed out after ${timeoutMs}ms`,
			};
		}

		const executablePath = await locateCLIExecutable(binaryName, timeoutMs);
		if (executablePath) {
			const output =
				`${typedError.stdout || ""}${typedError.stderr || ""}`.trim();
			return {
				installed: true,
				version: extractOutputVersion(output),
				output: output || executablePath,
				error: typedError.message || String(error),
			};
		}

		// Other errors
		return {
			installed: false,
			version: null,
			error: typedError.message || String(error),
		};
	}
};

export const locateCLIExecutable = async (
	binaryName: string,
	timeoutMs = 5000
): Promise<string | null> => {
	if (!binaryName) {
		return null;
	}

	const lookupCommand =
		process.platform === "win32"
			? `where ${binaryName}`
			: `which ${binaryName}`;

	try {
		const { stdout } = await execAsync(lookupCommand, {
			timeout: timeoutMs,
			encoding: "utf8",
			env: {
				...process.env,
				PATH: getExtendedPath(),
			},
		});

		const executablePath = stdout
			.trim()
			.split(NEWLINE_SPLIT_REGEX)
			.find((line) => line.length > 0);
		return executablePath || null;
	} catch {
		return null;
	}
};
