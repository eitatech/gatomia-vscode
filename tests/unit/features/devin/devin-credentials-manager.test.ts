import { describe, it, expect, beforeEach, vi } from "vitest";
import { DevinCredentialsManager } from "../../../../src/features/devin/devin-credentials-manager";
import {
	DevinCredentialsNotFoundError,
	DevinInvalidTokenError,
	DevinOrgIdRequiredError,
} from "../../../../src/features/devin/errors";
import { STORAGE_KEY_CREDENTIALS } from "../../../../src/features/devin/config";

function createMockSecretStorage() {
	const store = new Map<string, string>();
	return {
		get: vi.fn((key: string) => Promise.resolve(store.get(key))),
		store: vi.fn((key: string, value: string) => {
			store.set(key, value);
			return Promise.resolve();
		}),
		delete: vi.fn((key: string) => {
			store.delete(key);
			return Promise.resolve();
		}),
		onDidChange: vi.fn(),
		_store: store,
	};
}

describe("DevinCredentialsManager", () => {
	let mockStorage: ReturnType<typeof createMockSecretStorage>;
	let manager: DevinCredentialsManager;

	beforeEach(() => {
		vi.clearAllMocks();
		mockStorage = createMockSecretStorage();
		manager = new DevinCredentialsManager(mockStorage as any);
	});

	describe("store", () => {
		it("stores v3 credentials with orgId", async () => {
			const creds = await manager.store("cog_test_key", "org-123");

			expect(creds.apiKey).toBe("cog_test_key");
			expect(creds.apiVersion).toBe("v3");
			expect(creds.orgId).toBe("org-123");
			expect(creds.isValid).toBe(true);
			expect(mockStorage.store).toHaveBeenCalledWith(
				STORAGE_KEY_CREDENTIALS,
				expect.any(String)
			);
		});

		it("stores v1 credentials without orgId", async () => {
			const creds = await manager.store("apk_test_key");

			expect(creds.apiKey).toBe("apk_test_key");
			expect(creds.apiVersion).toBe("v1");
			expect(creds.orgId).toBeUndefined();
			expect(creds.isValid).toBe(true);
		});

		it("throws DevinOrgIdRequiredError for v3 token without orgId", async () => {
			await expect(manager.store("cog_test_key")).rejects.toThrow(
				DevinOrgIdRequiredError
			);
		});

		it("throws DevinInvalidTokenError for unknown token format", async () => {
			await expect(manager.store("unknown_token")).rejects.toThrow(
				DevinInvalidTokenError
			);
		});
	});

	describe("get", () => {
		it("returns undefined when no credentials stored", async () => {
			const result = await manager.get();
			expect(result).toBeUndefined();
		});

		it("returns stored credentials", async () => {
			await manager.store("apk_test_key");
			const result = await manager.get();

			expect(result).toBeDefined();
			expect(result?.apiKey).toBe("apk_test_key");
		});

		it("returns undefined for corrupted data", async () => {
			mockStorage._store.set(STORAGE_KEY_CREDENTIALS, "not-json");
			const result = await manager.get();
			expect(result).toBeUndefined();
		});
	});

	describe("getOrThrow", () => {
		it("throws DevinCredentialsNotFoundError when no credentials", async () => {
			await expect(manager.getOrThrow()).rejects.toThrow(
				DevinCredentialsNotFoundError
			);
		});

		it("returns credentials when they exist", async () => {
			await manager.store("apk_test_key");
			const result = await manager.getOrThrow();
			expect(result.apiKey).toBe("apk_test_key");
		});
	});

	describe("delete", () => {
		it("removes stored credentials", async () => {
			await manager.store("apk_test_key");
			await manager.delete();

			expect(mockStorage.delete).toHaveBeenCalledWith(STORAGE_KEY_CREDENTIALS);
			const result = await manager.get();
			expect(result).toBeUndefined();
		});
	});

	describe("hasCredentials", () => {
		it("returns false when no credentials stored", async () => {
			const result = await manager.hasCredentials();
			expect(result).toBe(false);
		});

		it("returns true when credentials exist", async () => {
			await manager.store("apk_test_key");
			const result = await manager.hasCredentials();
			expect(result).toBe(true);
		});
	});

	describe("markUsed", () => {
		it("updates lastUsedAt timestamp", async () => {
			await manager.store("apk_test_key");
			await manager.markUsed();

			const creds = await manager.get();
			expect(creds?.lastUsedAt).toBeDefined();
			expect(creds?.lastUsedAt).toBeGreaterThan(0);
		});

		it("does nothing when no credentials exist", async () => {
			await manager.markUsed();
			expect(mockStorage.store).not.toHaveBeenCalled();
		});
	});

	describe("markInvalid", () => {
		it("sets isValid to false", async () => {
			await manager.store("apk_test_key");
			await manager.markInvalid();

			const creds = await manager.get();
			expect(creds?.isValid).toBe(false);
		});
	});
});
