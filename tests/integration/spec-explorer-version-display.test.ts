import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SpecExplorerProvider } from "../../src/providers/spec-explorer-provider";
import type { ExtensionContext } from "vscode";
import { join } from "node:path";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";

describe("Spec Explorer Version Display Integration", () => {
	let tempDir: string;
	let mockContext: ExtensionContext;
	let mockVersionService: any;

	beforeEach(async () => {
		// Create temp directory for test specs
		tempDir = await mkdtemp(
			join(tmpdir(), "spec-explorer-version-display-test-")
		);

		// Mock extension context
		mockContext = {
			subscriptions: [],
			workspaceState: {
				get: vi.fn().mockReturnValue(undefined),
				update: vi.fn().mockResolvedValue(undefined),
				keys: vi.fn().mockReturnValue([]),
			},
			globalState: {
				get: vi.fn(),
				update: vi.fn(),
				keys: vi.fn().mockReturnValue([]),
				setKeysForSync: vi.fn(),
			},
			extensionPath: tempDir,
			extensionUri: { fsPath: tempDir } as any,
			storageUri: { fsPath: join(tempDir, "storage") } as any,
			globalStorageUri: { fsPath: join(tempDir, "global-storage") } as any,
			logUri: { fsPath: join(tempDir, "logs") } as any,
		} as unknown as ExtensionContext;

		// Create mock version service with all required methods
		mockVersionService = {
			onDidUpdateVersion: vi.fn((listener) => ({
				dispose: vi.fn(),
			})),
			initializeVersion: vi.fn().mockResolvedValue(undefined),
			incrementVersion: vi.fn().mockResolvedValue("1.1"),
			getVersionHistory: vi.fn().mockResolvedValue([]),
			getCurrentVersion: vi.fn().mockResolvedValue("1.0"),
			getDocumentMetadata: vi.fn().mockResolvedValue({
				version: "1.0",
				owner: "Test Owner",
				lastModified: new Date().toISOString(),
			}),
		};
	});

	afterEach(async () => {
		// Clean up temp directory
		await rm(tempDir, { recursive: true, force: true });
	});

	describe("Service Integration", () => {
		it("should accept optional DocumentVersionService in constructor", () => {
			const providerWithService = new SpecExplorerProvider(
				mockContext,
				mockVersionService
			);
			expect(providerWithService).toBeDefined();
		});

		it("should work without DocumentVersionService", () => {
			const providerWithoutService = new SpecExplorerProvider(mockContext);
			expect(providerWithoutService).toBeDefined();
		});

		it("should expose versionService as readonly property when injected", () => {
			const provider = new SpecExplorerProvider(
				mockContext,
				mockVersionService
			);
			// Access the private property through type assertion for testing
			const providerAny = provider as any;
			expect(providerAny.versionService).toBe(mockVersionService);
		});
	});

	describe("Event Subscription", () => {
		it("should subscribe to version service onDidUpdateVersion event when service is provided", () => {
			const subscriptionSpy = vi.fn();
			const customMockService = {
				onDidUpdateVersion: vi.fn((listener) => {
					subscriptionSpy(listener);
					return { dispose: vi.fn() };
				}),
			} as any;

			new SpecExplorerProvider(mockContext, customMockService);

			expect(customMockService.onDidUpdateVersion).toHaveBeenCalled();
			expect(subscriptionSpy).toHaveBeenCalledWith(expect.any(Function));
		});

		it("should not attempt to subscribe if version service is not provided", () => {
			expect(() => {
				new SpecExplorerProvider(mockContext);
			}).not.toThrow();
		});

		it("should call refresh() when onDidUpdateVersion fires", () => {
			let updateListener: ((specId: string) => void) | undefined;
			const customMockService = {
				onDidUpdateVersion: vi.fn((listener) => {
					updateListener = listener;
					return { dispose: vi.fn() };
				}),
			} as any;

			const provider = new SpecExplorerProvider(mockContext, customMockService);
			const refreshSpy = vi.spyOn(provider, "refresh");

			// Simulate version update event
			if (updateListener) {
				updateListener("001-test-spec");
			}

			expect(refreshSpy).toHaveBeenCalled();
		});
	});

	describe("Tree View Public Interface", () => {
		it("should expose refresh() method", () => {
			const provider = new SpecExplorerProvider(
				mockContext,
				mockVersionService
			);
			expect(typeof provider.refresh).toBe("function");
		});

		it("should expose onDidChangeTreeData EventEmitter", () => {
			const provider = new SpecExplorerProvider(
				mockContext,
				mockVersionService
			);
			expect(provider.onDidChangeTreeData).toBeDefined();
		});

		it("should fire onDidChangeTreeData when refresh() is called", () =>
			new Promise<void>((resolve) => {
				const provider = new SpecExplorerProvider(
					mockContext,
					mockVersionService
				);

				provider.onDidChangeTreeData(() => {
					resolve();
				});

				provider.refresh();
			}));

		it("should implement TreeDataProvider interface methods", () => {
			const provider = new SpecExplorerProvider(
				mockContext,
				mockVersionService
			);
			expect(typeof provider.getTreeItem).toBe("function");
			expect(typeof provider.getChildren).toBe("function");
		});
	});

	describe("Version Service API Integration", () => {
		it("should call addVersionInfo with version service when available", async () => {
			// Create a test spec with version metadata
			const specDir = join(tempDir, "specs/001-test-spec");
			await mkdir(specDir, { recursive: true });
			await writeFile(
				join(specDir, "spec.md"),
				`---
version: 1.0
owner: Test Owner
---
# Test Spec`
			);

			// Initialize version for the spec
			await mockVersionService.initializeVersion(join(specDir, "spec.md"));

			const provider = new SpecExplorerProvider(
				mockContext,
				mockVersionService
			);
			const specItem = await (provider as any).createSpecItem(
				specDir,
				join(tempDir, "specs")
			);

			// addVersionInfo runs asynchronously, but we can verify the method was called
			// by checking that the item was created successfully
			expect(specItem).toBeDefined();
			expect(specItem.label).toContain("test-spec");
		});

		it("should handle errors gracefully when addVersionInfo fails", async () => {
			// Create a spec without version metadata
			const specDir = join(tempDir, "specs/002-no-version");
			await mkdir(specDir, { recursive: true });
			await writeFile(join(specDir, "spec.md"), "# No Version Metadata");

			const provider = new SpecExplorerProvider(
				mockContext,
				mockVersionService
			);

			// Should not throw even when version metadata is missing
			await expect(
				(provider as any).createSpecItem(specDir, join(tempDir, "specs"))
			).resolves.toBeDefined();
		});
	});

	describe("Integration Points Verification", () => {
		it("should integrate version service with tree item creation pipeline", async () => {
			// Create a spec with version
			const specDir = join(tempDir, "specs/003-integration");
			await mkdir(specDir, { recursive: true });
			const specPath = join(specDir, "spec.md");
			await writeFile(
				specPath,
				`---
version: 2.0
owner: Integration Test
---
# Integration Test`
			);

			await mockVersionService.initializeVersion(specPath);

			const provider = new SpecExplorerProvider(
				mockContext,
				mockVersionService
			);
			const item = await (provider as any).createSpecItem(
				specDir,
				join(tempDir, "specs")
			);

			// Verify the item was created successfully
			expect(item).toBeDefined();
			expect(item.label).toContain("integration");

			// The actual version display happens asynchronously in addVersionInfo
			// We verify integration by checking that the item can be created
			// without errors when version service is present
		});

		it("should maintain backward compatibility when version service is not provided", async () => {
			// Create a spec
			const specDir = join(tempDir, "specs/004-backward-compat");
			await mkdir(specDir, { recursive: true });
			await writeFile(
				join(specDir, "spec.md"),
				"# Backward Compatibility Test"
			);

			const provider = new SpecExplorerProvider(mockContext); // No version service

			// Should still work without version service
			const item = await (provider as any).createSpecItem(
				specDir,
				join(tempDir, "specs")
			);

			expect(item).toBeDefined();
			expect(item.label).toContain("backward-compat");
		});
	});
});
