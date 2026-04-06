import { describe, expect, it, vi, beforeEach } from "vitest";
import path from "node:path";
import { workspace, type Uri, window, ViewColumn } from "vscode";

// Create mock functions via vi.hoisted() so they are available in module factories
const { mockExistsSync } = vi.hoisted(() => ({
	mockExistsSync: vi.fn(),
}));

vi.mock("fs", () => ({
	default: { existsSync: mockExistsSync },
	existsSync: mockExistsSync,
}));
vi.mock("node:fs", () => ({
	default: { existsSync: mockExistsSync },
	existsSync: mockExistsSync,
}));

// biome-ignore lint/performance/noNamespaceImport: Required for vitest mocking with vi.mocked()
import * as fs from "fs";
import { ConstitutionManager } from "./constitution-manager";

describe("ConstitutionManager", () => {
	const mockWorkspaceRoot = "/test/workspace";
	let manager: ConstitutionManager;

	beforeEach(() => {
		vi.clearAllMocks();
		manager = new ConstitutionManager(mockWorkspaceRoot);
	});

	describe("getConstitutionPath", () => {
		it("should return constitution path in .specify/memory directory", () => {
			const result = manager.getConstitutionPath();

			expect(result).toBe(
				path.join(mockWorkspaceRoot, ".specify", "memory", "constitution.md")
			);
		});
	});

	describe("ensureConstitutionExists", () => {
		it("should return true when constitution file exists", () => {
			vi.mocked(fs.existsSync).mockReturnValue(true);

			const result = manager.ensureConstitutionExists();

			expect(result).toBe(true);
		});

		it("should return false when constitution file does not exist", () => {
			vi.mocked(fs.existsSync).mockReturnValue(false);

			const result = manager.ensureConstitutionExists();

			expect(result).toBe(false);
		});
	});

	describe("openConstitution", () => {
		it("should open existing constitution file", async () => {
			vi.mocked(fs.existsSync).mockReturnValue(true);
			vi.mocked(workspace.openTextDocument).mockResolvedValue({} as any);
			vi.mocked(window.showTextDocument).mockResolvedValue({} as any);

			await manager.openConstitution();

			expect(workspace.openTextDocument).toHaveBeenCalled();
			expect(window.showTextDocument).toHaveBeenCalledWith(
				expect.anything(),
				expect.objectContaining({
					preview: false,
					viewColumn: ViewColumn.Active,
				})
			);
		});

		it("should offer to create constitution when it does not exist", async () => {
			vi.mocked(fs.existsSync).mockReturnValue(false);
			vi.mocked(window.showInformationMessage).mockResolvedValue(undefined);

			await manager.openConstitution();

			expect(window.showInformationMessage).toHaveBeenCalledWith(
				"Constitution file not found. Create one?",
				"Yes",
				"No"
			);
		});

		it("should create constitution when user confirms", async () => {
			vi.mocked(fs.existsSync).mockReturnValue(false);
			vi.mocked(window.showInformationMessage).mockResolvedValue("Yes" as any);
			vi.mocked(workspace.openTextDocument).mockResolvedValue({} as any);
			vi.mocked(window.showTextDocument).mockResolvedValue({} as any);
			vi.mocked(workspace.fs.createDirectory).mockResolvedValue(undefined);
			vi.mocked(workspace.fs.writeFile).mockResolvedValue(undefined);

			await manager.openConstitution();

			expect(workspace.fs.writeFile).toHaveBeenCalled();
		});

		it("should not create constitution when user declines", async () => {
			vi.mocked(fs.existsSync).mockReturnValue(false);
			vi.mocked(window.showInformationMessage).mockResolvedValue("No" as any);

			await manager.openConstitution();

			expect(workspace.fs.writeFile).not.toHaveBeenCalled();
		});
	});

	describe("createDefaultConstitution", () => {
		it("should create constitution with default content", async () => {
			vi.mocked(workspace.fs.createDirectory).mockResolvedValue(undefined);
			vi.mocked(workspace.fs.writeFile).mockResolvedValue(undefined);

			await manager.createDefaultConstitution();

			expect(workspace.fs.writeFile).toHaveBeenCalled();
			const writeCall = vi.mocked(workspace.fs.writeFile).mock.calls[0];
			const uri = writeCall[0] as Uri;
			expect(uri.fsPath).toContain("constitution.md");
		});

		it("should include core principles in default content", async () => {
			vi.mocked(workspace.fs.createDirectory).mockResolvedValue(undefined);
			vi.mocked(workspace.fs.writeFile).mockResolvedValue(undefined);

			await manager.createDefaultConstitution();

			const writeCall = vi.mocked(workspace.fs.writeFile).mock.calls[0];
			const content = Buffer.from(writeCall[1] as Uint8Array).toString();
			expect(content).toContain("# Project Constitution");
			expect(content).toContain("Core Principles");
			expect(content).toContain("Technical Standards");
		});

		it("should handle directory creation error gracefully", async () => {
			vi.mocked(workspace.fs.createDirectory).mockRejectedValue(
				new Error("Directory exists")
			);
			vi.mocked(workspace.fs.writeFile).mockResolvedValue(undefined);

			// Should not throw
			await expect(manager.createDefaultConstitution()).resolves.not.toThrow();
		});
	});

	describe("validateConstitution", () => {
		it("should return true for validation placeholder", () => {
			const result = manager.validateConstitution();

			expect(result).toBe(true);
		});
	});
});
