import { beforeEach, describe, expect, it, vi } from "vitest";
import { Uri, workspace } from "vscode";

const UNABLE_TO_RESOLVE_HOME_DIR_PATTERN = /Unable to resolve home directory/i;

vi.mock("os", () => ({
	default: {
		homedir: vi.fn(() => "/home/testuser"),
	},
	homedir: vi.fn(() => "/home/testuser"),
}));

import {
	InstructionRuleError,
	assertFileDoesNotExist,
	buildInstructionRuleTemplate,
	normalizeInstructionRuleName,
	normalizeToKebabCase,
	projectInstructionsDirUri,
	userInstructionsDirUri,
	userInstructionsDirUriFromHomeDir,
} from "./instruction-rules";

describe("instruction-rules", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("normalizeToKebabCase", () => {
		it("normalizes to lowercase kebab-case", () => {
			expect(normalizeToKebabCase("TypeScript Rules")).toBe("typescript-rules");
			expect(normalizeToKebabCase(" type   script ")).toBe("type-script");
			expect(normalizeToKebabCase("Hello_There")).toBe("hello-there");
		});

		it("can normalize to empty", () => {
			expect(normalizeToKebabCase("---")).toBe("");
		});
	});

	describe("normalizeInstructionRuleName", () => {
		it("rejects empty/whitespace-only names", () => {
			const result = normalizeInstructionRuleName("   ");
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error).toBeInstanceOf(InstructionRuleError);
				expect(result.error.userMessage).toContain("required");
			}
		});

		it("rejects names that normalize to empty", () => {
			const result = normalizeInstructionRuleName("---");
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.userMessage).toContain("letter or number");
			}
		});

		it("accepts and returns normalized name", () => {
			const result = normalizeInstructionRuleName("TypeScript Rules");
			expect(result).toEqual({ ok: true, normalizedName: "typescript-rules" });
		});
	});

	describe("buildInstructionRuleTemplate", () => {
		it("generates standard template", () => {
			expect(buildInstructionRuleTemplate("typescript-rules")).toBe(
				"---\n" +
					"description: 'TODO: Describe this instruction'\n" +
					"applyTo: '**'\n" +
					"---\n\n" +
					"# typescript-rules\n"
			);
		});
	});

	describe("projectInstructionsDirUri", () => {
		it("computes .github/instructions path under workspace folder", () => {
			const base = Uri.file("/test/workspace");
			const uri = projectInstructionsDirUri(base);
			expect(uri.fsPath).toBe("/test/workspace/.github/instructions");
		});
	});

	describe("userInstructionsDirUri", () => {
		it("computes ~/.github/instructions using os.homedir", () => {
			const uri = userInstructionsDirUri();
			expect(uri.fsPath).toBe("/home/testuser/.github/instructions");
		});

		it("throws actionable error if home cannot be resolved", () => {
			expect(() => userInstructionsDirUriFromHomeDir("")).toThrowError(
				UNABLE_TO_RESOLVE_HOME_DIR_PATTERN
			);
		});
	});

	describe("assertFileDoesNotExist", () => {
		it("throws actionable error when file exists", async () => {
			vi.mocked(workspace.fs.stat).mockResolvedValue({} as any);

			await expect(
				assertFileDoesNotExist(Uri.file("/test/existing.instructions.md"))
			).rejects.toMatchObject({
				userMessage: expect.stringContaining("already exists"),
			});
		});

		it("resolves when file does not exist", async () => {
			vi.mocked(workspace.fs.stat).mockRejectedValue(new Error("Not found"));

			await expect(
				assertFileDoesNotExist(Uri.file("/test/new.instructions.md"))
			).resolves.toBeUndefined();
		});
	});
});
