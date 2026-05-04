import { access } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { checkCLI, locateCLIExecutable } from "../../../utils/cli-detector";
import type { AcpProviderProbe } from "../types";

const DEFAULT_TIMEOUT_MS = 5000;
const GEMINI_ENV_VAR = "GEMINI_API_KEY";
const GOOGLE_ENV_VAR = "GOOGLE_API_KEY";
// Match the actual CLI flag forms only:
//   - `--acp`              (current)
//   - `--experimental-acp` (legacy)
// A bare mention of "ACP" in help prose (e.g. "Agent Client Protocol") is NOT
// enough to flip `acpSupported` to true — the CLI must explicitly advertise a
// flag we can pass to the spawn invocation.
const ACP_FLAG_PATTERN = /(?:^|\s)--(?:experimental-)?acp\b/im;

/**
 * Probe the Gemini CLI to determine whether GatomIA can route prompts to it
 * through the Agent Client Protocol.
 *
 * Detection logic:
 *   1. `gemini --version` must succeed.
 *   2. Authentication is considered OK when either `GEMINI_API_KEY` /
 *      `GOOGLE_API_KEY` env var is set, OR the OAuth credentials file created
 *      by `gemini auth login` (`~/.gemini/oauth_creds.json`) is readable.
 *   3. ACP capability is detected by looking for an `--acp` or
 *      `--experimental-acp` flag in the `gemini --help` output. Bare mentions
 *      of the word "ACP" in prose do not count.
 */
export const probeGeminiCli = async (
	timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<AcpProviderProbe> => {
	try {
		const version = await checkCLI("gemini --version", timeoutMs);
		if (!version.installed) {
			return {
				installed: false,
				version: null,
				authenticated: false,
				acpSupported: false,
				executablePath: null,
				error: version.error,
			};
		}

		const [executablePath, help, oauthCredsOk] = await Promise.all([
			locateCLIExecutable("gemini", timeoutMs),
			checkCLI("gemini --help", timeoutMs),
			hasOauthCreds(),
		]);

		const helpOutput = help.output ?? "";
		const acpSupported = ACP_FLAG_PATTERN.test(helpOutput);

		const hasEnvKey = Boolean(
			process.env[GEMINI_ENV_VAR] || process.env[GOOGLE_ENV_VAR]
		);
		const authenticated = hasEnvKey || oauthCredsOk;

		const probe: AcpProviderProbe = {
			installed: true,
			version: version.version,
			authenticated,
			acpSupported,
			executablePath,
		};

		if (!authenticated) {
			probe.authHint =
				"Run 'gemini auth login' in a terminal, or set the GEMINI_API_KEY environment variable.";
		}

		return probe;
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return {
			installed: false,
			version: null,
			authenticated: false,
			acpSupported: false,
			executablePath: null,
			error: message,
		};
	}
};

const hasOauthCreds = async (): Promise<boolean> => {
	try {
		const credsPath = join(homedir(), ".gemini", "oauth_creds.json");
		await access(credsPath);
		return true;
	} catch {
		return false;
	}
};
