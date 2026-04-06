/**
 * Devin API Client Factory
 *
 * Creates the appropriate API client based on the token prefix.
 * - cog_* tokens -> v3 client (organization-scoped)
 * - apk_* tokens -> v1/v2 client (legacy)
 *
 * @see specs/001-devin-integration/research.md:L162-L166
 */

import { detectApiVersion } from "./api-version-detector";
import type { DevinApiClientInterface } from "./devin-api-client";
import { DevinApiClientV1 } from "./devin-api-client-v1";
import { DevinApiClientV3 } from "./devin-api-client-v3";
import { DevinOrgIdRequiredError } from "./errors";
import { ApiVersion } from "./types";

/**
 * Options for creating a Devin API client.
 */
export interface CreateClientOptions {
	/** Devin API token */
	readonly token: string;
	/** Organization ID (required for v3) */
	readonly orgId?: string;
	/** Override base URL (for testing) */
	readonly baseUrl?: string;
}

/**
 * Create a Devin API client based on the token prefix.
 *
 * @param options - Client creation options
 * @returns The appropriate API client for the detected version
 * @throws {DevinInvalidTokenError} If the token format is not recognized
 * @throws {DevinOrgIdRequiredError} If v3 token is used without orgId
 */
export function createDevinApiClient(
	options: CreateClientOptions
): DevinApiClientInterface {
	const version = detectApiVersion(options.token);

	if (version === ApiVersion.V3) {
		if (!options.orgId || options.orgId.trim().length === 0) {
			throw new DevinOrgIdRequiredError();
		}
		return new DevinApiClientV3(options.token, options.orgId, options.baseUrl);
	}

	return new DevinApiClientV1(options.token, options.baseUrl);
}
