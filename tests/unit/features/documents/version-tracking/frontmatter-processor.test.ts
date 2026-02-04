import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
// biome-ignore lint/performance/noNamespaceImport: Required for vi.mock() to intercept fs module
import * as fs from "node:fs/promises";
import { FrontmatterProcessor } from "../../../../../src/features/documents/version-tracking/frontmatter-processor";

// Mock fs/promises module
vi.mock("node:fs/promises");

describe("FrontmatterProcessor", () => {
	let processor: FrontmatterProcessor;
	let readFileMock: ReturnType<typeof vi.fn>;
	let writeFileMock: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		processor = new FrontmatterProcessor();
		readFileMock = vi.mocked(fs.readFile);
		writeFileMock = vi.mocked(fs.writeFile);
		readFileMock.mockClear();
		writeFileMock.mockClear();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("extract()", () => {
		it("should extract version and owner from valid frontmatter", async () => {
			const content = `---
version: "1.5"
owner: "John Doe <john@example.com>"
title: "Test Spec"
---

# Content here`;

			readFileMock.mockResolvedValue(content);

			const result = await processor.extract("/path/to/spec.md");

			expect(result).toEqual({
				version: "1.5",
				owner: "John Doe <john@example.com>",
			});
			expect(readFileMock).toHaveBeenCalledWith("/path/to/spec.md", "utf-8");
		});

		it("should return default values when version/owner missing", async () => {
			const content = `---
title: "Test Spec"
---

# Content`;

			readFileMock.mockResolvedValue(content);

			const result = await processor.extract("/path/to/spec.md");

			expect(result).toEqual({
				version: "1.0",
				owner: "Unknown",
			});
		});

		it("should handle missing frontmatter", async () => {
			const content = "# Just content, no frontmatter";

			readFileMock.mockResolvedValue(content);

			const result = await processor.extract("/path/to/spec.md");

			expect(result).toEqual({
				version: "1.0",
				owner: "Unknown",
			});
		});

		it("should throw error when file read fails", async () => {
			readFileMock.mockRejectedValue(new Error("ENOENT: file not found"));

			await expect(processor.extract("/path/to/missing.md")).rejects.toThrow(
				"ENOENT: file not found"
			);
		});

		it("should handle malformed YAML gracefully", async () => {
			const content = `---
version: "1.0
owner: [unclosed array
---

# Content`;

			readFileMock.mockResolvedValue(content);

			// Should not throw, return defaults
			const result = await processor.extract("/path/to/spec.md");

			expect(result).toEqual({
				version: "1.0",
				owner: "Unknown",
			});
		});
	});

	describe("update()", () => {
		it("should update version in existing frontmatter", async () => {
			const originalContent = `---
version: "1.0"
owner: "John Doe <john@example.com>"
title: "Test Spec"
---

# Content here`;

			readFileMock.mockResolvedValue(originalContent);
			writeFileMock.mockResolvedValue(undefined);

			await processor.update("/path/to/spec.md", { version: "1.1" });

			expect(writeFileMock).toHaveBeenCalledOnce();
			const writtenContent = writeFileMock.mock.calls[0][1] as string;

			// Verify version was updated (gray-matter uses single quotes)
			// biome-ignore lint/performance/useTopLevelRegex: Test-specific regex, unique per assertion
			expect(writtenContent).toMatch(/version:\s*['"]1\.1['"]/);
			// Verify owner was preserved
			expect(writtenContent).toContain("John Doe <john@example.com>");
			// Verify body content preserved
			expect(writtenContent).toContain("# Content here");
		});

		it("should update owner in existing frontmatter", async () => {
			const originalContent = `---
version: "1.5"
owner: "Old Owner <old@example.com>"
---

Body content`;

			readFileMock.mockResolvedValue(originalContent);
			writeFileMock.mockResolvedValue(undefined);

			await processor.update("/path/to/spec.md", {
				owner: "New Owner <new@example.com>",
			});

			const writtenContent = writeFileMock.mock.calls[0][1] as string;

			// biome-ignore lint/performance/useTopLevelRegex: Test-specific regex, unique per assertion
			expect(writtenContent).toMatch(/version:\s*['"]1\.5['"]/);
			expect(writtenContent).toContain("New Owner <new@example.com>");
		});

		it("should update both version and owner simultaneously", async () => {
			const originalContent = `---
version: "1.0"
owner: "Old <old@example.com>"
title: "Spec"
---

Content`;

			readFileMock.mockResolvedValue(originalContent);
			writeFileMock.mockResolvedValue(undefined);

			await processor.update("/path/to/spec.md", {
				version: "2.0",
				owner: "New <new@example.com>",
			});

			const writtenContent = writeFileMock.mock.calls[0][1] as string;

			// biome-ignore lint/performance/useTopLevelRegex: Test-specific regex, unique per assertion
			expect(writtenContent).toMatch(/version:\s*['"]2\.0['"]/);
			expect(writtenContent).toContain("New <new@example.com>");
			expect(writtenContent).toContain("Spec");
		});

		it("should add frontmatter if document has none", async () => {
			const originalContent = "# Just content, no frontmatter";

			readFileMock.mockResolvedValue(originalContent);
			writeFileMock.mockResolvedValue(undefined);

			await processor.update("/path/to/spec.md", {
				version: "1.0",
				owner: "Author <author@example.com>",
			});

			const writtenContent = writeFileMock.mock.calls[0][1] as string;

			// biome-ignore lint/performance/useTopLevelRegex: Test-specific regex
			expect(writtenContent).toMatch(/^---\n/);
			// biome-ignore lint/performance/useTopLevelRegex: Test-specific regex, unique per assertion
			expect(writtenContent).toMatch(/version:\s*['"]1\.0['"]/);
			expect(writtenContent).toContain("Author <author@example.com>");
			expect(writtenContent).toContain("# Just content, no frontmatter");
		});

		it("should preserve other frontmatter fields", async () => {
			const originalContent = `---
version: "1.0"
owner: "Author"
title: "Important Title"
status: "draft"
tags:
  - feature
  - testing
---

Content`;

			readFileMock.mockResolvedValue(originalContent);
			writeFileMock.mockResolvedValue(undefined);

			await processor.update("/path/to/spec.md", { version: "1.1" });

			const writtenContent = writeFileMock.mock.calls[0][1] as string;

			expect(writtenContent).toContain("Important Title");
			expect(writtenContent).toContain("draft");
			expect(writtenContent).toContain("tags:");
			expect(writtenContent).toContain("- feature");
			expect(writtenContent).toContain("- testing");
		});

		it("should throw error when file write fails", async () => {
			readFileMock.mockResolvedValue("---\nversion: '1.0'\n---\nContent");
			writeFileMock.mockRejectedValue(new Error("EACCES: permission denied"));

			await expect(
				processor.update("/path/to/spec.md", { version: "1.1" })
			).rejects.toThrow("EACCES: permission denied");
		});
	});

	describe("hasValidFrontmatter()", () => {
		it("should return true for valid frontmatter with required fields", async () => {
			const content = `---
version: "1.0"
owner: "Author"
title: "Spec Title"
status: "draft"
---

Content`;

			readFileMock.mockResolvedValue(content);

			const result = await processor.hasValidFrontmatter("/path/to/spec.md");

			expect(result).toBe(true);
		});

		it("should return true even if version/owner missing (optional fields)", async () => {
			const content = `---
title: "Spec Title"
status: "active"
---

Content`;

			readFileMock.mockResolvedValue(content);

			const result = await processor.hasValidFrontmatter("/path/to/spec.md");

			expect(result).toBe(true);
		});

		it("should return false for missing frontmatter", async () => {
			const content = "# Just markdown content";

			readFileMock.mockResolvedValue(content);

			const result = await processor.hasValidFrontmatter("/path/to/spec.md");

			expect(result).toBe(false);
		});

		it("should return false for malformed YAML", async () => {
			const content = `---
title: [unclosed
status: "broken
---

Content`;

			readFileMock.mockResolvedValue(content);

			const result = await processor.hasValidFrontmatter("/path/to/spec.md");

			expect(result).toBe(false);
		});
	});

	describe("extractBodyContent()", () => {
		it("should extract body content after frontmatter", async () => {
			const content = `---
version: "1.0"
owner: "Author"
---

# Main Heading

This is the body content.

## Subheading

More content here.`;

			readFileMock.mockResolvedValue(content);

			const result = await processor.extractBodyContent("/path/to/spec.md");

			expect(result).not.toContain("version:");
			expect(result).not.toContain("owner:");
			expect(result).toContain("# Main Heading");
			expect(result).toContain("This is the body content.");
		});

		it("should normalize whitespace in body content", async () => {
			const content = `---
version: "1.0"
---

# Heading


Multiple blank lines.


End.`;

			readFileMock.mockResolvedValue(content);

			const result = await processor.extractBodyContent("/path/to/spec.md");

			// Normalized: single line breaks, trimmed
			// biome-ignore lint/performance/useTopLevelRegex: Test-specific regex for whitespace verification
			expect(result).not.toMatch(/\n{3,}/); // No triple+ newlines
			expect(result.trim()).toBeTruthy();
		});

		it("should return full content when no frontmatter exists", async () => {
			const content = `# Just content
No frontmatter here.`;

			readFileMock.mockResolvedValue(content);

			const result = await processor.extractBodyContent("/path/to/spec.md");

			expect(result).toContain("# Just content");
			expect(result).toContain("No frontmatter here.");
		});

		it("should return empty string for empty document", async () => {
			const content = `---
version: "1.0"
---`;

			readFileMock.mockResolvedValue(content);

			const result = await processor.extractBodyContent("/path/to/spec.md");

			expect(result.trim()).toBe("");
		});
	});
});
