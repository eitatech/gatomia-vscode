/**
 * KnownAgentCatalog
 *
 * Hardcoded catalog of ACP-compatible agents that GatomIA supports out of the box.
 * Users only need to indicate they have a given agent installed; the command is
 * derived automatically from this catalog.
 *
 * No I/O, no network — pure static data.
 *
 * @feature 001-hooks-refactor Phase 8
 */

// ============================================================================
// Types
// ============================================================================

/** Union of all known agent identifiers. */
export type KnownAgentId =
	| "claude-acp"
	| "kimi"
	| "gemini"
	| "github-copilot"
	| "codex-acp"
	| "mistral-vibe"
	| "opencode";

/**
 * Strategy for detecting whether a known agent is installed on the system.
 * - `npm-global`: check via `npm list -g <target> --depth=0 --json`
 * - `path`: check via `which <target>` (Unix) / `where <target>` (Windows)
 *   The detector expands PATH with common package manager bin dirs before running.
 */
export type InstallCheckStrategy =
	| { strategy: "npm-global"; target: string }
	| { strategy: "path"; target: string };

/** A single entry in the known agent catalog. */
export interface KnownAgentEntry {
	/** Stable identifier matching the ACP public registry id. */
	id: KnownAgentId;
	/** Human-readable label shown in the UI. */
	displayName: string;
	/** The shell command used to spawn the agent in ACP mode. */
	agentCommand: string;
	/**
	 * Ordered list of detection strategies tried in sequence.
	 * The agent is considered installed if ANY strategy succeeds.
	 */
	installChecks: InstallCheckStrategy[];
}

// ============================================================================
// Catalog
// ============================================================================

/**
 * The 7 known ACP-compatible agents supported out-of-the-box.
 * Command strings are derived from the ACP public registry
 * at https://cdn.agentclientprotocol.com/registry/v1/latest/registry.json
 *
 * Each entry has multiple detection strategies to handle:
 * - Agents installed via bun, volta, mise, nvm (non-standard PATH locations)
 * - Agents whose CLI binary name differs from the npm package name
 * - Agents that run via npx (no global install needed — detected by binary name)
 */
export const KNOWN_AGENTS: readonly KnownAgentEntry[] = [
	{
		id: "claude-acp",
		displayName: "Claude Code",
		agentCommand: "npx @zed-industries/claude-agent-acp",
		installChecks: [
			{ strategy: "npm-global", target: "@zed-industries/claude-agent-acp" },
			{ strategy: "path", target: "claude" },
		],
	},
	{
		id: "kimi",
		displayName: "Kimi Code CLI",
		agentCommand: "kimi acp",
		installChecks: [{ strategy: "path", target: "kimi" }],
	},
	{
		id: "gemini",
		displayName: "Gemini CLI",
		agentCommand: "npx @google/gemini-cli --experimental-acp",
		installChecks: [
			// Installed as a binary (bun install -g, npm install -g, etc.)
			{ strategy: "path", target: "gemini" },
			// Installed as npm global package
			{ strategy: "npm-global", target: "@google/gemini-cli" },
		],
	},
	{
		id: "github-copilot",
		displayName: "GitHub Copilot",
		agentCommand: "npx @github/copilot-language-server --acp",
		installChecks: [
			// npm global install: the binary is named copilot-language-server (not github-copilot-language-server)
			{ strategy: "npm-global", target: "@github/copilot-language-server" },
			// Binary present in PATH — installed via npm -g, the binary is copilot-language-server
			{ strategy: "path", target: "copilot-language-server" },
		],
	},
	{
		id: "codex-acp",
		displayName: "OpenAI Codex",
		// The ACP-capable wrapper from Zed Industries (not the openai/codex CLI which lacks --acp)
		agentCommand: "npx @zed-industries/codex-acp",
		installChecks: [
			// Zed Industries ACP wrapper — the only codex variant with ACP support
			{ strategy: "npm-global", target: "@zed-industries/codex-acp" },
			// Binary released as a standalone download: codex-acp
			{ strategy: "path", target: "codex-acp" },
		],
	},
	{
		id: "mistral-vibe",
		displayName: "Mistral Vibe",
		agentCommand: "vibe-acp",
		installChecks: [{ strategy: "path", target: "vibe-acp" }],
	},
	{
		id: "opencode",
		displayName: "OpenCode",
		agentCommand: "opencode acp",
		installChecks: [{ strategy: "path", target: "opencode" }],
	},
] as const;

// ============================================================================
// Helpers
// ============================================================================

/**
 * Looks up a known agent by id.
 * Returns `undefined` if the id is not in the catalog.
 */
export function getKnownAgent(id: KnownAgentId): KnownAgentEntry | undefined {
	return KNOWN_AGENTS.find((a) => a.id === id);
}
