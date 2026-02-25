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
import { STORAGE_KEY_CREDENTIALS } from "./config";
import { detectApiVersion } from "./api-version-detector";
import type { DevinCredentials } from "./entities";
import { DevinCredentialsNotFoundError } from "./errors";
import { ApiVersion } from "./types";

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

		const credentials: DevinCredentials = {
			apiKey,
			apiVersion,
			orgId: orgId?.trim(),
			createdAt: Date.now(),
			isValid: true,
		};

		await this.secretStorage.store(
			STORAGE_KEY_CREDENTIALS,
			JSON.stringify(credentials)
		);

		return credentials;
	}

	/**
	 * Retrieve stored credentials.
	 *
	 * @returns The stored credentials, or undefined if none exist
	 */
	async get(): Promise<DevinCredentials | undefined> {
		const raw = await this.secretStorage.get(STORAGE_KEY_CREDENTIALS);
		if (!raw) {
			return;
		}

		try {
			return JSON.parse(raw) as DevinCredentials;
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
		await this.secretStorage.delete(STORAGE_KEY_CREDENTIALS);
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
		const credentials = await this.get();
		if (!credentials) {
			return;
		}

		const updated: DevinCredentials = {
			...credentials,
			lastUsedAt: Date.now(),
		};

		await this.secretStorage.store(
			STORAGE_KEY_CREDENTIALS,
			JSON.stringify(updated)
		);
	}

	/**
	 * Mark credentials as invalid (e.g., after authentication failure).
	 */
	async markInvalid(): Promise<void> {
		const credentials = await this.get();
		if (!credentials) {
			return;
		}

		const updated: DevinCredentials = {
			...credentials,
			isValid: false,
		};

		await this.secretStorage.store(
			STORAGE_KEY_CREDENTIALS,
			JSON.stringify(updated)
		);
	}
}
