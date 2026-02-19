import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Stats } from "fs";
import { window } from "vscode";

// Create mock functions via vi.hoisted() so they are available in module factories
const fsMockModule = vi.hoisted(() => ({
	existsSync: vi.fn(),
	readdirSync: vi.fn(),
	statSync: vi.fn(),
	mkdirSync: vi.fn(),
	copyFileSync: vi.fn(),
	readFileSync: vi.fn(),
	writeFileSync: vi.fn(),
}));

const {
	existsSync: mockExistsSync,
	readdirSync: mockReaddirSync,
	statSync: mockStatSync,
	mkdirSync: mockMkdirSync,
	copyFileSync: mockCopyFileSync,
	readFileSync: mockReadFileSync,
	writeFileSync: mockWriteFileSync,
} = fsMockModule;

vi.mock("fs", () => ({ default: fsMockModule, ...fsMockModule }));
vi.mock("node:fs", () => ({ default: fsMockModule, ...fsMockModule }));

// biome-ignore lint/performance/noNamespaceImport: Required for vitest mocking with vi.mocked()
import * as fs from "fs";
import { SpecKitMigration } from "./spec-kit-migration";

describe("SpecKitMigration", () => {
	let migration: SpecKitMigration;
	const workspaceRoot = "/test/workspace";

	beforeEach(() => {
		vi.clearAllMocks();
		migration = new SpecKitMigration(workspaceRoot);
	});

	describe("createBackup", () => {
		it("should return null if openspec directory does not exist", () => {
			vi.mocked(fs.existsSync).mockReturnValue(false);

			const result = migration.createBackup();

			expect(result).toBeNull();
		});

		it("should create backup directory with timestamp", () => {
			vi.mocked(fs.existsSync).mockImplementation(
				(path) =>
					path.toString().includes("openspec") &&
					!path.toString().includes(".openspec-backup")
			);
			vi.mocked(fs.readdirSync).mockReturnValue([] as any);
			vi.mocked(fs.statSync).mockReturnValue({
				isDirectory: () => false,
			} as Stats);

			const result = migration.createBackup();

			expect(result).not.toBeNull();
			expect(result).toContain(".openspec-backup-");
			expect(fs.mkdirSync).toHaveBeenCalled();
		});

		it("should copy files recursively during backup", () => {
			// Track call count to prevent infinite recursion
			let readdirCallCount = 0;

			vi.mocked(fs.existsSync).mockImplementation((path) => {
				const pathStr = path.toString();
				return (
					pathStr.includes("openspec") && !pathStr.includes(".openspec-backup")
				);
			});
			vi.mocked(fs.readdirSync).mockImplementation(() => {
				readdirCallCount += 1;
				// Return empty array after first call to stop recursion
				if (readdirCallCount > 1) {
					return [] as any;
				}
				return ["AGENTS.md"] as any;
			});
			vi.mocked(fs.statSync).mockImplementation(
				() =>
					({
						isDirectory: () => false, // Files, not directories
					}) as Stats
			);

			const result = migration.createBackup();

			expect(result).not.toBeNull();
			expect(fs.mkdirSync).toHaveBeenCalled();
		});
	});

	describe("generateConstitution", () => {
		it("should create default constitution when no source files exist", async () => {
			vi.mocked(fs.existsSync).mockReturnValue(false);
			vi.mocked(window.showWarningMessage).mockResolvedValue(undefined);

			const result = await migration.generateConstitution();

			expect(result).toBe(true);
			expect(fs.writeFileSync).toHaveBeenCalled();
			expect(fs.mkdirSync).toHaveBeenCalled();
		});

		it("should merge content from AGENTS.md if it exists", async () => {
			vi.mocked(fs.existsSync).mockImplementation(
				(path: string | Buffer | URL) => path.toString().includes("AGENTS.md")
			);
			vi.mocked(fs.readFileSync).mockReturnValue(
				"# Agent Instructions\nTest content"
			);

			const result = await migration.generateConstitution();

			expect(result).toBe(true);
			const writeCall = vi.mocked(fs.writeFileSync).mock.calls[0];
			const content = writeCall[1] as string;
			expect(content).toContain("Agent Instructions");
		});

		it("should merge content from multiple source files", async () => {
			vi.mocked(fs.existsSync).mockImplementation(
				(path: string | Buffer | URL) => {
					const pathStr = path.toString();
					return (
						pathStr.includes("AGENTS.md") ||
						pathStr.includes("CLAUDE.md") ||
						pathStr.includes("project.md")
					);
				}
			);
			vi.mocked(fs.readFileSync).mockImplementation((path) => {
				const pathStr = path.toString();
				if (pathStr.includes("AGENTS.md")) {
					return "# Agents";
				}
				if (pathStr.includes("CLAUDE.md")) {
					return "# Claude";
				}
				if (pathStr.includes("project.md")) {
					return "# Project";
				}
				return "";
			});

			const result = await migration.generateConstitution();

			expect(result).toBe(true);
			const writeCall = vi.mocked(fs.writeFileSync).mock.calls[0];
			const content = writeCall[1] as string;
			expect(content).toContain("generated from existing project guidelines");
		});

		it("should ask for confirmation if constitution already exists", async () => {
			vi.mocked(fs.existsSync).mockImplementation(
				(path: string | Buffer | URL) =>
					path.toString().includes("constitution.md")
			);
			vi.mocked(window.showWarningMessage).mockResolvedValue("No" as any);

			const result = await migration.generateConstitution();

			expect(result).toBe(false);
			expect(window.showWarningMessage).toHaveBeenCalled();
		});
	});

	describe("migrateAllSpecs", () => {
		it("should show info message when no specs to migrate", async () => {
			vi.mocked(fs.existsSync).mockReturnValue(false);

			const result = await migration.migrateAllSpecs();

			expect(result.success).toBe(true);
			expect(result.migratedSpecs).toBe(0);
			expect(window.showInformationMessage).toHaveBeenCalledWith(
				"No OpenSpec specs found to migrate."
			);
		});

		it("should ask for confirmation before migration", async () => {
			vi.mocked(fs.existsSync).mockReturnValue(true);
			vi.mocked(fs.readdirSync).mockReturnValue([
				"feature-1",
				"feature-2",
			] as any);
			vi.mocked(fs.statSync).mockReturnValue({
				isDirectory: () => true,
			} as Stats);
			vi.mocked(window.showWarningMessage).mockResolvedValue("No" as any);

			const result = await migration.migrateAllSpecs();

			expect(result.success).toBe(false);
			expect(window.showWarningMessage).toHaveBeenCalled();
		});

		it("should migrate specs when user confirms", async () => {
			// Track call count to prevent infinite recursion
			let readdirCallCount = 0;

			// Setup mocks for successful migration
			vi.mocked(fs.existsSync).mockImplementation(
				(path: string | Buffer | URL) => {
					const pathStr = path.toString();
					// Return true for source paths, false for constitution check
					if (pathStr.includes("constitution.md")) {
						return false;
					}
					if (pathStr.includes(".openspec-backup")) {
						return false;
					}
					return true;
				}
			);
			vi.mocked(fs.readdirSync).mockImplementation((path) => {
				readdirCallCount += 1;
				const pathStr = path.toString();
				// Limit recursion
				if (readdirCallCount > 5) {
					return [] as any;
				}
				if (pathStr.includes("openspec/specs")) {
					return ["feature-1"] as any;
				}
				if (pathStr.includes("feature-1")) {
					return ["spec.md", "tasks.md"] as any;
				}
				if (pathStr.includes("specs") && !pathStr.includes("openspec")) {
					return [] as any;
				}
				return ["specs"] as any;
			});
			vi.mocked(fs.statSync).mockImplementation((path) => {
				const pathStr = path.toString();
				return {
					isDirectory: () =>
						!pathStr.includes(".md") &&
						(pathStr.includes("openspec") || pathStr.includes("feature-1")),
				} as Stats;
			});
			vi.mocked(window.showWarningMessage).mockResolvedValue("Yes" as any);
			vi.mocked(window.showInformationMessage).mockResolvedValue(undefined);

			const result = await migration.migrateAllSpecs();

			expect(result.migratedSpecs).toBe(1);
			expect(fs.mkdirSync).toHaveBeenCalled();
			expect(fs.copyFileSync).toHaveBeenCalled();
		});

		it("should create backup before migration", async () => {
			// Track call count to prevent infinite recursion
			let readdirCallCount = 0;

			vi.mocked(fs.existsSync).mockImplementation(
				(path: string | Buffer | URL) => {
					const pathStr = path.toString();
					if (pathStr.includes("constitution.md")) {
						return false;
					}
					if (pathStr.includes(".openspec-backup")) {
						return false;
					}
					return true;
				}
			);
			vi.mocked(fs.readdirSync).mockImplementation((path) => {
				readdirCallCount += 1;
				const pathStr = path.toString();
				// Limit recursion by returning empty after a few calls
				if (readdirCallCount > 3) {
					return [] as any;
				}
				if (pathStr.includes("openspec/specs")) {
					return ["feature-1"] as any;
				}
				if (pathStr.includes("specs") && !pathStr.includes("openspec")) {
					return [] as any;
				}
				if (pathStr.includes("feature-1")) {
					return ["spec.md"] as any;
				}
				return ["specs"] as any;
			});
			vi.mocked(fs.statSync).mockImplementation((path) => {
				const pathStr = path.toString();
				return {
					isDirectory: () =>
						!pathStr.includes(".md") &&
						(pathStr.includes("openspec") || pathStr.includes("feature-1")),
				} as Stats;
			});
			vi.mocked(window.showWarningMessage).mockResolvedValue("Yes" as any);

			const result = await migration.migrateAllSpecs();

			expect(result.backupPath).not.toBeNull();
		});

		it("should handle migration errors gracefully", async () => {
			vi.mocked(fs.existsSync).mockReturnValue(true);
			vi.mocked(fs.readdirSync).mockImplementation((path) => {
				const pathStr = path.toString();
				if (pathStr.includes("openspec/specs")) {
					return ["feature-1"] as any;
				}
				if (pathStr.includes("specs") && !pathStr.includes("openspec")) {
					return [] as any;
				}
				return [] as any;
			});
			vi.mocked(fs.statSync).mockReturnValue({
				isDirectory: () => true,
			} as Stats);
			vi.mocked(window.showWarningMessage).mockResolvedValue("Yes" as any);
			vi.mocked(fs.mkdirSync).mockImplementation(() => {
				throw new Error("Permission denied");
			});

			const result = await migration.migrateAllSpecs();

			expect(result.errors.length).toBeGreaterThan(0);
			expect(window.showErrorMessage).toHaveBeenCalled();
		});
	});
});
