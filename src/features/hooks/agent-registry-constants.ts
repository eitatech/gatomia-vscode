/**
 * Agent Registry Configuration Constants
 *
 * Defines all configuration constants for the Agent Registry feature including
 * discovery timeouts, limits, file watching debounce timing, and storage keys.
 *
 * @see specs/011-custom-agent-hooks/contracts/agent-registry-api.ts
 * @see specs/011-custom-agent-hooks/research.md (for debounce timing decision)
 */

// ============================================================================
// Discovery Configuration
// ============================================================================

/**
 * Maximum time to wait for agent discovery from a single source (milliseconds)
 * @see specs/011-custom-agent-hooks/contracts/agent-registry-api.ts:L342
 */
export const DISCOVERY_TIMEOUT_MS = 5000; // 5 seconds

/**
 * Maximum number of agents allowed per discovery source
 * Prevents memory issues from malformed agent directories
 */
export const MAX_AGENTS_PER_SOURCE = 100;

/**
 * Maximum total agents across all sources
 * Prevents performance degradation from excessive agent lists
 */
export const MAX_TOTAL_AGENTS = 200;

// ============================================================================
// File Watching Configuration
// ============================================================================

/**
 * Debounce delay for file change events (milliseconds)
 * Prevents excessive rescanning when multiple files change rapidly
 * @see specs/011-custom-agent-hooks/research.md:L116 (500ms chosen over 300ms)
 */
export const FILE_WATCH_DEBOUNCE_MS = 500; // 0.5 seconds

/**
 * Glob pattern for agent files
 * Matches all .agent.md files recursively in .github/agents/
 */
export const FILE_WATCH_GLOB_PATTERN = "**/*.agent.md";

/**
 * Agents directory path relative to workspace root
 */
export const AGENTS_DIR_RELATIVE_PATH = ".github/agents";

// ============================================================================
// Extension Scanning Configuration
// ============================================================================

/**
 * Interval for periodic extension registry checks (milliseconds)
 * Used as fallback if extension change events are unreliable
 */
export const EXTENSION_SCAN_INTERVAL_MS = 10_000; // 10 seconds

/**
 * Package.json contribution point for chat participants
 * @see https://code.visualstudio.com/docs/copilot/agents/overview
 */
export const CHAT_PARTICIPANTS_CONTRIBUTION_POINT = "chatParticipants";

// ============================================================================
// Storage Configuration
// ============================================================================

/**
 * VS Code workspace state key for agent registry cache
 */
export const STORAGE_KEY = "gatomia.agents.registry";

/**
 * Registry storage format version
 * Increment when schema changes to invalidate old cached data
 */
export const STORAGE_VERSION = 1;

// ============================================================================
// Agent ID Formatting
// ============================================================================

/**
 * Agent ID separator character
 * Format: "{source}:{name}"
 * Example: "local:code-reviewer", "extension:copilot"
 */
export const AGENT_ID_SEPARATOR = ":";

/**
 * Source prefixes for agent IDs
 */
export const AGENT_ID_PREFIX = {
	FILE: "local",
	EXTENSION: "extension",
} as const;

// ============================================================================
// Display Name Disambiguation
// ============================================================================

/**
 * Suffix for local agents when name collision occurs
 * @see specs/011-custom-agent-hooks/spec.md:FR-002
 */
export const LOCAL_AGENT_SUFFIX = " (Local)";

/**
 * Suffix for extension agents when name collision occurs
 * @see specs/011-custom-agent-hooks/spec.md:FR-002
 */
export const EXTENSION_AGENT_SUFFIX = " (Extension)";

// ============================================================================
// Validation Limits
// ============================================================================

/**
 * Maximum length for agent name field
 */
export const MAX_AGENT_NAME_LENGTH = 100;

/**
 * Maximum length for agent description field
 */
export const MAX_AGENT_DESCRIPTION_LENGTH = 500;

/**
 * Maximum file size for .agent.md files (bytes)
 * Prevents parsing extremely large files
 */
export const MAX_AGENT_FILE_SIZE_BYTES = 1024 * 1024; // 1 MB

// ============================================================================
// Performance Goals
// ============================================================================

/**
 * Target time for initial agent dropdown population (milliseconds)
 * @see specs/011-custom-agent-hooks/spec.md:SC-002
 */
export const TARGET_DROPDOWN_LOAD_TIME_MS = 2000; // 2 seconds

/**
 * Target time for file system changes to be reflected (milliseconds)
 * @see specs/011-custom-agent-hooks/spec.md:SC-006
 */
export const TARGET_REFRESH_TIME_MS = 5000; // 5 seconds
