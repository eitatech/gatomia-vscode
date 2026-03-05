/**
 * Devin Integration Configuration Constants
 *
 * Defines all configuration constants for the Devin remote implementation
 * integration feature including API endpoints, polling intervals, retry
 * limits, storage keys, and credential detection patterns.
 *
 * @see specs/001-devin-integration/contracts/devin-api.ts
 * @see specs/001-devin-integration/contracts/extension-api.ts
 * @see specs/001-devin-integration/research.md
 */

// ============================================================================
// API Endpoints
// ============================================================================

/**
 * Base URL for all Devin API requests
 * @see specs/001-devin-integration/research.md
 */
export const DEVIN_API_BASE_URL = "https://api.devin.ai";

/**
 * API path prefixes by version
 */
export const API_PATH_PREFIX = {
	V1: "/v1",
	V2: "/v2",
	V3: "/v3",
} as const;

// ============================================================================
// API Version Detection
// ============================================================================

/**
 * Token prefix for v3 API (service users)
 * @see specs/001-devin-integration/research.md:L29
 */
export const V3_TOKEN_PREFIX = "cog_";

/**
 * Token prefix for v1/v2 API (personal keys)
 * @see specs/001-devin-integration/research.md:L39
 */
export const LEGACY_PERSONAL_TOKEN_PREFIX = "apk_user_";

/**
 * Token prefix for v1/v2 API (service keys)
 * @see specs/001-devin-integration/research.md:L39
 */
export const LEGACY_SERVICE_TOKEN_PREFIX = "apk_";

// ============================================================================
// Polling Configuration
// ============================================================================

/**
 * Default polling interval for session status updates (seconds)
 * @see specs/001-devin-integration/research.md:L169-L172
 */
export const DEFAULT_POLLING_INTERVAL_SECONDS = 5;

/**
 * Minimum polling interval (seconds)
 * Prevents excessive API calls
 */
export const MIN_POLLING_INTERVAL_SECONDS = 3;

/**
 * Maximum polling interval (seconds)
 * Ensures reasonable update frequency
 */
export const MAX_POLLING_INTERVAL_SECONDS = 60;

// ============================================================================
// Retry Configuration
// ============================================================================

/**
 * Maximum number of retry attempts for failed API calls
 * @see specs/001-devin-integration/plan.md:L26
 */
export const MAX_RETRY_ATTEMPTS = 3;

/**
 * Base delay for exponential backoff (milliseconds)
 * Actual delay: baseDelay * 2^(attempt - 1)
 */
export const RETRY_BASE_DELAY_MS = 1000;

/**
 * Maximum delay between retries (milliseconds)
 * Caps the exponential backoff to prevent excessive waits
 */
export const RETRY_MAX_DELAY_MS = 30_000;

// ============================================================================
// Session Storage
// ============================================================================

/**
 * VS Code workspace state key for Devin sessions
 * @see specs/001-devin-integration/contracts/extension-api.ts:L256
 */
export const STORAGE_KEY_SESSIONS = "gatomia.devin.sessions";

/**
 * VS Code SecretStorage key for Devin credentials metadata
 * @see specs/001-devin-integration/contracts/extension-api.ts:L257
 */
export const STORAGE_KEY_CREDENTIALS = "gatomia.devin.credentials";

/**
 * VS Code SecretStorage key for Devin API key (stored separately from metadata)
 */
export const STORAGE_KEY_API_KEY = "gatomia.devin.apiKey";

/**
 * VS Code workspace state key for Devin configuration
 * @see specs/001-devin-integration/contracts/extension-api.ts:L258
 */
export const STORAGE_KEY_CONFIGURATION = "gatomia.devin.configuration";

/**
 * Session retention period (milliseconds)
 * Sessions older than this are cleaned up
 * @see specs/001-devin-integration/data-model.md:L37
 */
export const SESSION_RETENTION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// ============================================================================
// VS Code Commands
// ============================================================================

/**
 * Command identifiers for Devin integration
 * @see specs/001-devin-integration/contracts/extension-api.ts:L243-L249
 */
export const DEVIN_COMMANDS = {
	START_TASK: "gatomia.devin.startTask",
	START_ALL_TASKS: "gatomia.devin.startAllTasks",
	OPEN_PROGRESS: "gatomia.devin.openProgress",
	CANCEL_SESSION: "gatomia.devin.cancelSession",
	CONFIGURE_CREDENTIALS: "gatomia.devin.configureCredentials",
	RUN_WITH_DEVIN: "gatomia.devin.runWithDevin",
} as const;

// ============================================================================
// VS Code Configuration Keys
// ============================================================================

/**
 * VS Code settings section for Devin configuration
 */
export const CONFIGURATION_SECTION = "gatomia.devin";

/**
 * Individual setting keys (under gatomia.devin.*)
 */
export const CONFIGURATION_KEYS = {
	POLLING_INTERVAL: "pollingInterval",
	MAX_RETRIES: "maxRetries",
	VERBOSE_LOGGING: "verboseLogging",
} as const;

// ============================================================================
// Performance Goals
// ============================================================================

/**
 * Target time to initiate a task (milliseconds)
 * @see specs/001-devin-integration/plan.md:L25
 */
export const TARGET_INITIATION_TIME_MS = 30_000; // 30 seconds

/**
 * Target latency for progress updates (milliseconds)
 * @see specs/001-devin-integration/plan.md:L25
 */
export const TARGET_UPDATE_LATENCY_MS = 10_000; // 10 seconds

// ============================================================================
// Output Channel
// ============================================================================

/**
 * Name of the VS Code output channel for Devin logs
 */
export const OUTPUT_CHANNEL_NAME = "GatomIA Devin";

// ============================================================================
// Telemetry Event Names
// ============================================================================

/**
 * Telemetry event name prefix for all Devin-related events
 */
export const TELEMETRY_PREFIX = "devin";

// ============================================================================
// Default Configuration
// ============================================================================

/**
 * Default configuration values for the Devin integration
 * @see specs/001-devin-integration/contracts/extension-api.ts:L226-L237
 */
export const DEFAULT_CONFIGURATION = {
	pollingInterval: DEFAULT_POLLING_INTERVAL_SECONDS,
	maxRetries: MAX_RETRY_ATTEMPTS,
	verboseLogging: false,
} as const;
