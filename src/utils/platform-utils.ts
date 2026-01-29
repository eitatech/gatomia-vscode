import { exec } from "child_process";
import { homedir, release } from "os";
import { join } from "path";
import { promisify } from "util";
import { readdir, stat } from "fs/promises";
// biome-ignore lint/performance/noNamespaceImport: Need vscode.env.appName
import * as vscode from "vscode";

const WSL_REGEX = /microsoft|wsl/i;

export function isWindowsOrWsl(): boolean {
	return (
		process.platform === "win32" ||
		(process.platform === "linux" &&
			(WSL_REGEX.test(release()) || !!process.env.WSL_DISTRO_NAME))
	);
}

/**
 * Get the IDE directory name based on the application name
 * Supports VS Code, VS Code Insiders, Cursor, Windsurf, and other forks
 */
function getIDEDirectoryName(): string {
	const appName = vscode.env.appName;

	// Map common IDE names to their directory names
	// VS Code Insiders
	if (appName.toLowerCase().includes("insiders")) {
		return "Code - Insiders";
	}

	// Cursor IDE
	if (appName.toLowerCase().includes("cursor")) {
		return "Cursor";
	}

	// Windsurf IDE
	if (appName.toLowerCase().includes("windsurf")) {
		return "windsurf";
	}

	// Positron IDE
	if (appName.toLowerCase().includes("positron")) {
		return "Positron";
	}

	// VSCodium
	if (appName.toLowerCase().includes("vscodium")) {
		return "VSCodium";
	}

	// Default to "Code" for standard VS Code and unknown forks
	return "Code";
}

export async function getVSCodeUserDataPath(): Promise<string> {
	const ideDir = getIDEDirectoryName();

	const isWsl =
		process.platform === "linux" &&
		(WSL_REGEX.test(release()) || !!process.env.WSL_DISTRO_NAME);

	if (process.platform === "win32") {
		return join(process.env.APPDATA || "", ideDir, "User");
	}

	if (isWsl) {
		try {
			const execAsync = promisify(exec);
			const { stdout: winAppData } = await execAsync(
				'cmd.exe /C "echo %APPDATA%"'
			);
			const trimmedWinAppData = winAppData.trim();
			const { stdout: wslPath } = await execAsync(
				`wslpath -u "${trimmedWinAppData}"`
			);
			const appDataPath = wslPath.trim();
			return join(appDataPath, ideDir, "User");
		} catch (error) {
			console.error(`Failed to resolve Windows path in WSL: ${error}`);
			// Fallback to Linux path if resolution fails
		}
	}

	if (process.platform === "darwin") {
		return join(homedir(), "Library", "Application Support", ideDir, "User");
	}

	return join(homedir(), ".config", ideDir, "User");
}

/**
 * Get the path to the MCP configuration file (mcp.json)
 * Automatically detects the correct location based on VS Code configuration
 *
 * Priority (in order):
 * 1. User/profiles/{profile-id}/mcp.json - Profile-specific config (uses most recently modified if multiple profiles exist)
 * 2. User/mcp.json - Default location without profiles (checked for existence)
 * 3. User/mcp.json - Returns path even if file doesn't exist (for future creation)
 *
 * @returns Absolute path to mcp.json (existing or default location)
 */
export async function getMcpConfigPath(): Promise<string> {
	const userDataPath = await getVSCodeUserDataPath();
	const profilesDir = join(userDataPath, "profiles");

	try {
		// Check if profiles directory exists
		const profilesStat = await stat(profilesDir);
		if (profilesStat.isDirectory()) {
			// List all profiles
			const profiles = await readdir(profilesDir);

			// Find mcp.json in each profile and get modification time
			const mcpConfigFiles: Array<{ path: string; mtime: Date }> = [];

			for (const profile of profiles) {
				const mcpPath = join(profilesDir, profile, "mcp.json");
				try {
					const mcpStat = await stat(mcpPath);
					if (mcpStat.isFile()) {
						mcpConfigFiles.push({ path: mcpPath, mtime: mcpStat.mtime });
					}
				} catch {
					// Profile doesn't have mcp.json, skip
				}
			}

			// If profiles with mcp.json were found, return the most recent
			if (mcpConfigFiles.length > 0) {
				// Sort by modification time (newest first)
				mcpConfigFiles.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
				console.log(
					`[MCP] Found ${mcpConfigFiles.length} profile(s) with mcp.json, using most recent: ${mcpConfigFiles[0].path}`
				);
				return mcpConfigFiles[0].path;
			}
		}
	} catch (error) {
		// Profiles directory doesn't exist or error reading it
		console.log("[MCP] No profiles directory found, checking User directory");
	}

	// Fallback to User/mcp.json (check if it exists)
	const defaultMcpPath = join(userDataPath, "mcp.json");
	try {
		const defaultStat = await stat(defaultMcpPath);
		if (defaultStat.isFile()) {
			console.log(
				`[MCP] Using mcp.json from User directory: ${defaultMcpPath}`
			);
			return defaultMcpPath;
		}
	} catch {
		// File doesn't exist yet, but return the path anyway for future creation
		console.log(
			`[MCP] No mcp.json found, will use default location: ${defaultMcpPath}`
		);
	}

	return defaultMcpPath;
}
