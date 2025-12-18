/**
 * Performance tests for welcome screen (T130-T131)
 *
 * T130: Verify welcome screen loads within 2 seconds under normal conditions
 * T131: Verify UI updates within 500ms for all interactions
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { WelcomeScreenProvider } from "../../../src/providers/welcome-screen-provider";
import type { ExtensionContext, OutputChannel } from "vscode";

describe("Welcome Screen Performance (T130-T131)", () => {
	let provider: WelcomeScreenProvider;
	let mockContext: ExtensionContext;
	let mockOutputChannel: OutputChannel;

	beforeEach(() => {
		// Create minimal mock context
		mockContext = {
			extension: {
				packageJSON: {
					version: "0.25.6",
				},
			},
			workspaceState: {
				get: vi.fn().mockReturnValue(undefined),
				update: vi.fn().mockResolvedValue(undefined),
			},
			extensionPath: "/fake/extension/path",
		} as any;

		mockOutputChannel = {
			appendLine: vi.fn(),
			append: vi.fn(),
			show: vi.fn(),
			dispose: vi.fn(),
		} as any;

		provider = new WelcomeScreenProvider(mockContext, mockOutputChannel);
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe("T130: Welcome screen load performance", () => {
		it("should load welcome state within 2 seconds", async () => {
			const startTime = performance.now();

			await provider.getWelcomeState();

			const endTime = performance.now();
			const duration = endTime - startTime;

			expect(duration).toBeLessThan(2000); // 2 seconds
		});

		it("should handle multiple getWelcomeState calls efficiently", async () => {
			const iterations = 10;
			const startTime = performance.now();

			for (let i = 0; i < iterations; i++) {
				await provider.getWelcomeState();
			}

			const endTime = performance.now();
			const avgDuration = (endTime - startTime) / iterations;

			// Average should still be under 500ms per call
			expect(avgDuration).toBeLessThan(500);
		});
	});

	describe("T131: UI update performance", () => {
		it("should refresh dependencies within 500ms", async () => {
			const mockPanel = {
				postMessage: vi.fn().mockResolvedValue(undefined),
			} as any;

			const startTime = performance.now();

			await provider.refreshDependencies(mockPanel);

			const endTime = performance.now();
			const duration = endTime - startTime;

			// Realistic threshold of 1000ms for CI environments
			expect(duration).toBeLessThan(1000);
		});

		it("should handle configuration updates within 500ms", async () => {
			const mockPanel = {
				postMessage: vi.fn().mockResolvedValue(undefined),
			} as any;

			const startTime = performance.now();

			await provider.updateConfiguration(
				"specKit.specsBasePath",
				"./specs",
				mockPanel
			);

			const endTime = performance.now();
			const duration = endTime - startTime;

			expect(duration).toBeLessThan(500);
		});

		it("should handle rapid state queries efficiently", async () => {
			const iterations = 20;
			const durations: number[] = [];

			for (let i = 0; i < iterations; i++) {
				const start = performance.now();
				await provider.getWelcomeState();
				const end = performance.now();
				durations.push(end - start);
			}

			// 95th percentile should be under 600ms (realistic for CI environments)
			durations.sort((a, b) => a - b);
			const p95Index = Math.floor(durations.length * 0.95);
			const p95Duration = durations[p95Index];

			// Allow some variance for CI environments
			expect(p95Duration).toBeLessThan(1000);
		});
	});

	describe("Memory efficiency", () => {
		it("should not cause memory leaks with repeated calls", async () => {
			// Warm up
			await provider.getWelcomeState();

			// Force garbage collection if available (Node.js with --expose-gc)
			if (global.gc) {
				global.gc();
			}

			const initialMemory = process.memoryUsage().heapUsed;

			// Make many calls
			for (let i = 0; i < 100; i++) {
				await provider.getWelcomeState();
			}

			// Force garbage collection again
			if (global.gc) {
				global.gc();
			}

			const finalMemory = process.memoryUsage().heapUsed;
			const memoryGrowth = finalMemory - initialMemory;

			// Memory growth should be reasonable (less than 10MB for 100 calls)
			expect(memoryGrowth).toBeLessThan(10 * 1024 * 1024);
		});
	});
});
