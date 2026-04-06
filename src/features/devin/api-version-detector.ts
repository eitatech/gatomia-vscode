/**
 * API Version Detection Utility
 *
 * Detects the Devin API version from an API token prefix.
 * - cog_* -> v3 (service users with RBAC)
 * - apk_user_* -> v1 (personal keys)
 * - apk_* -> v1 (service keys, v1 and v2 share endpoints)
 *
 * @see specs/001-devin-integration/research.md:L162-L166
 * @see specs/001-devin-integration/contracts/devin-api.ts:L20-L28
 */

import { V3_TOKEN_PREFIX, LEGACY_SERVICE_TOKEN_PREFIX } from "./config";
import { DevinInvalidTokenError } from "./errors";
import { ApiVersion } from "./types";

/**
 * Detect API version from token prefix.
 *
 * @param token - The Devin API token
 * @returns The detected API version
 * @throws {DevinInvalidTokenError} If the token format is not recognized
 */
export function detectApiVersion(token: string): ApiVersion {
	if (!token || token.trim().length === 0) {
		throw new DevinInvalidTokenError("API token must not be empty.");
	}

	const trimmed = token.trim();

	if (trimmed.startsWith(V3_TOKEN_PREFIX)) {
		return ApiVersion.V3;
	}

	if (trimmed.startsWith(LEGACY_SERVICE_TOKEN_PREFIX)) {
		return ApiVersion.V1;
	}

	throw new DevinInvalidTokenError(
		`Unrecognized token prefix. Expected '${V3_TOKEN_PREFIX}' (v3) or '${LEGACY_SERVICE_TOKEN_PREFIX}' (v1/v2).`
	);
}

/**
 * Check whether a token is a v3 (service user) token.
 */
export function isV3Token(token: string): boolean {
	return token.trim().startsWith(V3_TOKEN_PREFIX);
}

/**
 * Check whether a token is a legacy v1/v2 token.
 */
export function isLegacyToken(token: string): boolean {
	return token.trim().startsWith(LEGACY_SERVICE_TOKEN_PREFIX);
}
