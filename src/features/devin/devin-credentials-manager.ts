/**
 * Devin Credentials Manager
 *
 * Manages Devin API credentials using VS Code SecretStorage for secure
 * encrypted storage. Handles credential validation, version detection,
 * and organization ID management.
 *
 * @see specs/001-devin-integration/data-model.md:L63-L82
 * @see specs/001-devin-integration/contracts/extension-api.ts:L255-L258
 */

import type * as vscode from "vscode";
import { STORAGE_KEY_CREDENTIALS, STORAGE_KEY_API_KEY } from "./config";
import { detectApiVersion } from "./api-version-detector";
import type { DevinCredentials } from "./entities";
import { DevinCredentialsNotFoundError } from "./errors";
import { ApiVersion } from "./types";

/**
 * Credentials metadata stored separately from the raw API key.
 * This JSON blob never contains the API key itself.
 */
interface CredentialsMetadata {
	readonly apiVersion: ApiVersion;
	readonly orgId?: string;
	readonly createdAt: number;
	readonly lastUsedAt?: number;
	readonly isValid: boolean;
}

/**
 * Manages Devin API credentials with secure storage.
 */
export class DevinCredentialsManager {
	private readonly secretStorage: vscode.SecretStorage;

	constructor(secretStorage: vscode.SecretStorage) {
		this.secretStorage = secretStorage;
	}

	/**
	 * Store credentials securely.
	 * Detects API version from token prefix and validates orgId requirement.
	 *
	 * @param apiKey - The Devin API token
	 * @param orgId - Organization ID (required for v3)
	 * @returns The stored credentials metadata
	 * @throws {DevinInvalidTokenError} If the token format is not recognized
	 * @throws {DevinOrgIdRequiredError} If v3 token is used without orgId
	 */
	async store(apiKey: string, orgId?: string): Promise<DevinCredentials> {
		const apiVersion = detectApiVersion(apiKey);

		if (apiVersion === ApiVersion.V3 && (!orgId || orgId.trim().length === 0)) {
			const { DevinOrgIdRequiredError } = await import("./errors");
			throw new DevinOrgIdRequiredError();
		}

		const metadata: CredentialsMetadata = {
			apiVersion,
			orgId: orgId?.trim(),
			createdAt: Date.now(),
			isValid: true,
		};

		await this.secretStorage.store(STORAGE_KEY_API_KEY, apiKey);
		await this.secretStorage.store(
			STORAGE_KEY_CREDENTIALS,
			JSON.stringify(metadata)
		);

		return { apiKey, ...metadata };
	}

	/**
	 * Retrieve stored credentials.
	 *
	 * @returns The stored credentials, or undefined if none exist
	 */
	async get(): Promise<DevinCredentials | undefined> {
		const [raw, apiKey] = await Promise.all([
			this.secretStorage.get(STORAGE_KEY_CREDENTIALS),
			this.secretStorage.get(STORAGE_KEY_API_KEY),
		]);
		if (!(raw && apiKey)) {
			// Backward-compat: try legacy format where apiKey was inside the JSON
			if (raw) {
				try {
					const legacy = JSON.parse(raw) as Record<string, unknown>;
					if (typeof legacy.apiKey === "string") {
						return legacy as unknown as DevinCredentials;
					}
				} catch {
					// corrupted
				}
			}
			return;
		}

		try {
			const metadata = JSON.parse(raw) as CredentialsMetadata;
			return { apiKey, ...metadata };
		} catch {
			return;
		}
	}

	/**
	 * Retrieve stored credentials, throwing if not found.
	 *
	 * @returns The stored credentials
	 * @throws {DevinCredentialsNotFoundError} If no credentials are configured
	 */
	async getOrThrow(): Promise<DevinCredentials> {
		const credentials = await this.get();
		if (!credentials) {
			throw new DevinCredentialsNotFoundError();
		}
		return credentials;
	}

	/**
	 * Delete stored credentials.
	 */
	async delete(): Promise<void> {
		await Promise.all([
			this.secretStorage.delete(STORAGE_KEY_CREDENTIALS),
			this.secretStorage.delete(STORAGE_KEY_API_KEY),
		]);
	}

	/**
	 * Check if credentials are stored.
	 */
	async hasCredentials(): Promise<boolean> {
		const raw = await this.secretStorage.get(STORAGE_KEY_CREDENTIALS);
		return raw !== undefined;
	}

	/**
	 * Update the lastUsedAt timestamp for stored credentials.
	 */
	async markUsed(): Promise<void> {
		const raw = await this.secretStorage.get(STORAGE_KEY_CREDENTIALS);
		if (!raw) {
			return;
		}

		try {
			const metadata = JSON.parse(raw) as CredentialsMetadata;
			const updated: CredentialsMetadata = {
				...metadata,
				lastUsedAt: Date.now(),
			};
			await this.secretStorage.store(
				STORAGE_KEY_CREDENTIALS,
				JSON.stringify(updated)
			);
		} catch {
			// corrupted metadata; skip
		}
	}

	/**
	 * Mark credentials as invalid (e.g., after authentication failure).
	 */
	async markInvalid(): Promise<void> {
		const raw = await this.secretStorage.get(STORAGE_KEY_CREDENTIALS);
		if (!raw) {
			return;
		}

		try {
			const metadata = JSON.parse(raw) as CredentialsMetadata;
			const updated: CredentialsMetadata = {
				...metadata,
				isValid: false,
			};
			await this.secretStorage.store(
				STORAGE_KEY_CREDENTIALS,
				JSON.stringify(updated)
			);
		} catch {
			// corrupted metadata; skip
		}
	}
}
