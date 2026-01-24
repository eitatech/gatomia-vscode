/**
 * Integration test for resource loading
 * Tests full resource loading pipeline with real file system
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { promises as fs } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ResourceCache } from "../../../src/features/agents/resource-cache";
import type { OutputChannel } from "vscode";

// Mock VS Code workspace.fs to use real filesystem for integration tests
vi.mock("vscode", async () => {
	const actual = await vi.importActual("vscode");
	return {
		...actual,
		workspace: {
			fs: {
				stat: async (uri: { fsPath: string }) => {
					const stats = await fs.stat(uri.fsPath);
					return {
						type: stats.isDirectory() ? 2 : 1,
						ctime: stats.ctimeMs,
						mtime: stats.mtimeMs,
						size: stats.size,
					};
				},
				readDirectory: async (uri: { fsPath: string }) => {
					const entries = await fs.readdir(uri.fsPath, { withFileTypes: true });
					return entries.map((entry) => [
						entry.name,
						entry.isDirectory() ? 2 : 1,
					]);
				},
				readFile: async (uri: { fsPath: string }) => {
					const content = await fs.readFile(uri.fsPath);
					return content;
				},
			},
		},
		Uri: {
			file: (path: string) => ({ fsPath: path, scheme: "file", path }),
		},
	};
});

describe("Resource Loading Integration", () => {
	let tempDir: string;
	let resourcesDir: string;

	beforeEach(async () => {
		// Create temp directory structure
		tempDir = join(tmpdir(), `resource-integration-${Date.now()}`);
		resourcesDir = join(tempDir, "resources");

		await fs.mkdir(join(resourcesDir, "prompts"), { recursive: true });
		await fs.mkdir(join(resourcesDir, "skills"), { recursive: true });
		await fs.mkdir(join(resourcesDir, "instructions"), { recursive: true });
	});

	afterEach(async () => {
		try {
			await fs.rm(tempDir, { recursive: true, force: true });
		} catch (error) {
			// Ignore cleanup errors
		}
	});

	it("should load all resource types on initialization", async () => {
		// Create comprehensive set of resources
		await fs.writeFile(
			join(resourcesDir, "prompts", "code-review.prompt.md"),
			"# Code Review Prompt\nReview the following code..."
		);
		await fs.writeFile(
			join(resourcesDir, "prompts", "test-gen.prompt.md"),
			"# Test Generation Prompt\nGenerate tests for..."
		);

		await fs.writeFile(
			join(resourcesDir, "skills", "python-expert.skill.md"),
			"# Python Expert Skill\nExpert in Python development..."
		);

		await fs.writeFile(
			join(resourcesDir, "instructions", "security.instructions.md"),
			"# Security Instructions\nFollow OWASP guidelines..."
		);

		const mockOutputChannel = {
			appendLine: () => {
				// Intentionally empty for testing
			},
			dispose: () => {
				// Intentionally empty for testing
			},
		} as unknown as OutputChannel;

		const cache = new ResourceCache(mockOutputChannel);

		const startTime = Date.now();
		await cache.load(resourcesDir);
		const loadTime = Date.now() - startTime;

		// Verify load time performance requirement
		expect(loadTime).toBeLessThan(5000);

		// Verify all resources loaded
		expect(cache.get("prompt", "code-review.prompt.md")).toContain(
			"Code Review Prompt"
		);
		expect(cache.get("prompt", "test-gen.prompt.md")).toContain(
			"Test Generation Prompt"
		);
		expect(cache.get("skill", "python-expert.skill.md")).toContain(
			"Python Expert Skill"
		);
		expect(cache.get("instruction", "security.instructions.md")).toContain(
			"Security Instructions"
		);

		cache.dispose();
	});

	it("should handle hot-reload of changed resources", async () => {
		await fs.writeFile(
			join(resourcesDir, "prompts", "dynamic.prompt.md"),
			"Version 1"
		);

		const mockOutputChannel = {
			appendLine: () => {
				// Intentionally empty for testing
			},
			dispose: () => {
				// Intentionally empty for testing
			},
		} as unknown as OutputChannel;

		const cache = new ResourceCache(mockOutputChannel);
		await cache.load(resourcesDir);

		expect(cache.get("prompt", "dynamic.prompt.md")).toBe("Version 1");

		// Simulate file change
		await fs.writeFile(
			join(resourcesDir, "prompts", "dynamic.prompt.md"),
			"Version 2 - Updated"
		);

		// Reload changed file
		await cache.reload([join(resourcesDir, "prompts", "dynamic.prompt.md")]);

		expect(cache.get("prompt", "dynamic.prompt.md")).toBe(
			"Version 2 - Updated"
		);

		cache.dispose();
	});

	it("should maintain cache consistency across reload operations", async () => {
		// Create multiple resources
		await fs.writeFile(
			join(resourcesDir, "prompts", "stable.prompt.md"),
			"Stable content"
		);
		await fs.writeFile(
			join(resourcesDir, "prompts", "changing.prompt.md"),
			"Original"
		);
		await fs.writeFile(
			join(resourcesDir, "skills", "skill.skill.md"),
			"Skill content"
		);

		const mockOutputChannel = {
			appendLine: () => {
				// Intentionally empty for testing
			},
			dispose: () => {
				// Intentionally empty for testing
			},
		} as unknown as OutputChannel;

		const cache = new ResourceCache(mockOutputChannel);
		await cache.load(resourcesDir);

		// Modify one file
		await fs.writeFile(
			join(resourcesDir, "prompts", "changing.prompt.md"),
			"Updated"
		);
		await cache.reload([join(resourcesDir, "prompts", "changing.prompt.md")]);

		// Verify only changed file updated
		expect(cache.get("prompt", "stable.prompt.md")).toBe("Stable content");
		expect(cache.get("prompt", "changing.prompt.md")).toBe("Updated");
		expect(cache.get("skill", "skill.skill.md")).toBe("Skill content");

		cache.dispose();
	});

	it("should handle resource deletion during hot-reload", async () => {
		await fs.writeFile(
			join(resourcesDir, "prompts", "temp.prompt.md"),
			"Temporary"
		);

		const mockOutputChannel = {
			appendLine: () => {
				// Intentionally empty for testing
			},
			dispose: () => {
				// Intentionally empty for testing
			},
		} as unknown as OutputChannel;

		const cache = new ResourceCache(mockOutputChannel);
		await cache.load(resourcesDir);

		expect(cache.get("prompt", "temp.prompt.md")).toBe("Temporary");

		// Delete file
		await fs.unlink(join(resourcesDir, "prompts", "temp.prompt.md"));
		await cache.reload([join(resourcesDir, "prompts", "temp.prompt.md")]);

		expect(cache.get("prompt", "temp.prompt.md")).toBeUndefined();

		cache.dispose();
	});

	it("should handle large number of resources efficiently", async () => {
		// Create 100 resource files
		const promises: Promise<void>[] = [];
		for (let i = 0; i < 100; i += 1) {
			promises.push(
				fs.writeFile(
					join(resourcesDir, "prompts", `prompt-${i}.prompt.md`),
					`# Prompt ${i}\nContent for prompt ${i}`
				)
			);
		}
		await Promise.all(promises);

		const mockOutputChannel = {
			appendLine: () => {
				// Intentionally empty for testing
			},
			dispose: () => {
				// Intentionally empty for testing
			},
		} as unknown as OutputChannel;

		const cache = new ResourceCache(mockOutputChannel);

		const startTime = Date.now();
		await cache.load(resourcesDir);
		const loadTime = Date.now() - startTime;

		// Should still be fast with many files
		expect(loadTime).toBeLessThan(5000);

		// Verify random samples loaded correctly
		expect(cache.get("prompt", "prompt-0.prompt.md")).toContain("Prompt 0");
		expect(cache.get("prompt", "prompt-50.prompt.md")).toContain("Prompt 50");
		expect(cache.get("prompt", "prompt-99.prompt.md")).toContain("Prompt 99");

		// Verify all files loaded
		const allPrompts = cache.getAll("prompt");
		expect(allPrompts.size).toBe(100);

		cache.dispose();
	});

	it("should handle nested directory structures", async () => {
		// Create nested structure
		await fs.mkdir(join(resourcesDir, "prompts", "nested"), {
			recursive: true,
		});
		await fs.writeFile(
			join(resourcesDir, "prompts", "nested", "deep.prompt.md"),
			"Nested prompt"
		);

		const mockOutputChannel = {
			appendLine: () => {
				// Intentionally empty for testing
			},
			dispose: () => {
				// Intentionally empty for testing
			},
		} as unknown as OutputChannel;

		const cache = new ResourceCache(mockOutputChannel);
		await cache.load(resourcesDir);

		// Should load nested files with relative path
		const nestedPrompt = cache.get("prompt", "nested/deep.prompt.md");
		expect(nestedPrompt).toBe("Nested prompt");

		cache.dispose();
	});
});
