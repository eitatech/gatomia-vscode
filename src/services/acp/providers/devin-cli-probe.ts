import { checkCLI, locateCLIExecutable } from "../../../utils/cli-detector";
import type { AcpProviderProbe } from "../types";

const DEFAULT_TIMEOUT_MS = 5000;
const WINDSURF_ENV_VAR = "WINDSURF_API_KEY";

/**
 * Probe the Devin CLI to determine whether GatomIA can route prompts to it via
 * the Agent Client Protocol.
 *
 * The probe is **non-throwing by contract**: any unexpected error is captured
 * in the returned object so upstream code can report it without try/catch.
 *
 * Detection logic:
 *   1. `devin --version` must succeed → sets `installed` / `version`.
 *   2. Authentication is considered OK when either `devin auth status` exits 0
 *      OR the `WINDSURF_API_KEY` environment variable is populated (Windsurf
 *      injects this in-process when the user is signed in to the IDE).
 *   3. ACP capability is confirmed via `devin acp --help`.
 */
export const probeDevinCli = async (
	timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<AcpProviderProbe> => {
	try {
		const version = await checkCLI("devin --version", timeoutMs);
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

		const [executablePath, auth, acpHelp] = await Promise.all([
			locateCLIExecutable("devin", timeoutMs),
			checkCLI("devin auth status", timeoutMs),
			checkCLI("devin acp --help", timeoutMs),
		]);

		const hasWindsurfKey = Boolean(process.env[WINDSURF_ENV_VAR]);
		const authenticated = auth.installed || hasWindsurfKey;

		const probe: AcpProviderProbe = {
			installed: true,
			version: version.version,
			authenticated,
			acpSupported: acpHelp.installed,
			executablePath,
		};

		if (!authenticated) {
			probe.authHint =
				"Run 'devin auth login' in a terminal, or set the WINDSURF_API_KEY environment variable.";
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
