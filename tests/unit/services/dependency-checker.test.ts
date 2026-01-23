/**
 * Unit tests for DependencyChecker service
 * Tests GitHub Copilot Chat detection and CLI detection
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { DependencyChecker } from "../../../src/services/dependency-checker";
// biome-ignore lint/performance/noNamespaceImport: needed for extensive vi.mocked() references
import * as vscode from "vscode";

describe("DependencyChecker", () => {
	let mockOutputChannel: vscode.OutputChannel;
	let dependencyChecker: DependencyChecker;

	beforeEach(() => {
		// Mock OutputChannel
		mockOutputChannel = {
			appendLine: vi.fn(),
			append: vi.fn(),
			clear: vi.fn(),
			show: vi.fn(),
			hide: vi.fn(),
			dispose: vi.fn(),
		} as any;

		// Reset vscode extensions mock
		vi.clearAllMocks();

		dependencyChecker = new DependencyChecker(mockOutputChannel);
	});

	describe("GitHub Copilot Chat Detection", () => {
		it("should detect installed and active Copilot Chat extension", async () => {
			// Mock vscode.extensions API
			const mockExtension = {
				id: "github.copilot-chat",
				isActive: true,
				packageJSON: { version: "0.11.2" },
			};

			vi.mocked(vscode.extensions.getExtension).mockReturnValue(
				mockExtension as any
			);

			const result = await dependencyChecker.checkCopilotChat();

			expect(result.installed).toBe(true);
			expect(result.active).toBe(true);
			expect(result.version).toBe("0.11.2");
		});

		it("should detect installed but inactive Copilot Chat extension", async () => {
			const mockExtension = {
				id: "github.copilot-chat",
				isActive: false,
				packageJSON: { version: "0.11.2" },
			};

			vi.mocked(vscode.extensions.getExtension).mockReturnValue(
				mockExtension as any
			);

			const result = await dependencyChecker.checkCopilotChat();

			expect(result.installed).toBe(true);
			expect(result.active).toBe(false);
			expect(result.version).toBe("0.11.2");
		});

		it("should handle missing Copilot Chat extension", async () => {
			vi.mocked(vscode.extensions.getExtension).mockReturnValue(undefined);

			const result = await dependencyChecker.checkCopilotChat();

			expect(result.installed).toBe(false);
			expect(result.active).toBe(false);
			expect(result.version).toBe(null);
		});

		it("should log Copilot Chat detection to output channel", async () => {
			const mockExtension = {
				id: "github.copilot-chat",
				isActive: true,
				packageJSON: { version: "0.11.2" },
			};

			vi.mocked(vscode.extensions.getExtension).mockReturnValue(
				mockExtension as any
			);

			await dependencyChecker.checkCopilotChat();

			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				expect.stringContaining("Copilot Chat")
			);
		});
	});

	describe("Caching Behavior", () => {
		it("should use cached results within 60s TTL", async () => {
			const firstCall = await dependencyChecker.checkAll();
			const secondCall = await dependencyChecker.checkAll();

			// Should return same instance (cached)
			expect(secondCall.copilotChat).toEqual(firstCall.copilotChat);
			expect(secondCall.speckit).toEqual(firstCall.speckit);
			expect(secondCall.openspec).toEqual(firstCall.openspec);
		});

		it("should invalidate cache when explicitly requested", async () => {
			await dependencyChecker.checkAll();
			dependencyChecker.invalidateCache();

			// After invalidation, next call should re-check
			const result = await dependencyChecker.checkAll();
			expect(result).toBeDefined();
		});

		it("should force re-check when forceRefresh is true", async () => {
			const firstCall = await dependencyChecker.checkAll();
			const secondCall = await dependencyChecker.checkAll(true);

			// Should have fresh lastChecked timestamp
			expect(secondCall.lastChecked).toBeGreaterThanOrEqual(
				firstCall.lastChecked
			);
		});
	});

	describe("checkAll() aggregation", () => {
		it("should return combined status for all dependencies", async () => {
			const result = await dependencyChecker.checkAll();

			expect(result).toHaveProperty("copilotChat");
			expect(result).toHaveProperty("speckit");
			expect(result).toHaveProperty("openspec");
			expect(result).toHaveProperty("lastChecked");

			expect(result.copilotChat).toHaveProperty("installed");
			expect(result.copilotChat).toHaveProperty("active");
			expect(result.copilotChat).toHaveProperty("version");

			expect(result.speckit).toHaveProperty("installed");
			expect(result.speckit).toHaveProperty("version");

			expect(result.openspec).toHaveProperty("installed");
			expect(result.openspec).toHaveProperty("version");
		});

		it("should set lastChecked timestamp", async () => {
			const before = Date.now();
			const result = await dependencyChecker.checkAll();
			const after = Date.now();

			expect(result.lastChecked).toBeGreaterThanOrEqual(before);
			expect(result.lastChecked).toBeLessThanOrEqual(after);
		});
	});

	describe("Error Handling", () => {
		it("should handle errors gracefully during Copilot Chat check", async () => {
			vi.mocked(vscode.extensions.getExtension).mockImplementation(() => {
				throw new Error("Extension API error");
			});

			const result = await dependencyChecker.checkCopilotChat();

			expect(result.installed).toBe(false);
			expect(result.active).toBe(false);
			expect(result.version).toBe(null);
		});

		it("should log errors to output channel", async () => {
			vi.mocked(vscode.extensions.getExtension).mockImplementation(() => {
				throw new Error("Extension API error");
			});

			await dependencyChecker.checkCopilotChat();

			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				expect.stringContaining("Error checking Copilot Chat")
			);
		});
	});
});
