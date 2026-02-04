import { describe, it, expect } from "vitest";
import {
	parseYamlFrontmatter,
	extractDocumentTitle,
	hasFrontmatter,
} from "../../../src/utils/yaml-frontmatter-parser";

describe("yaml-frontmatter-parser", () => {
	describe("parseYamlFrontmatter", () => {
		it("should parse valid YAML front matter with title", () => {
			const content = `---
title: Project Overview
author: John Doe
---
# Content here
`;
			const result = parseYamlFrontmatter(content);

			expect(result.title).toBe("Project Overview");
			expect(result.metadata?.author).toBe("John Doe");
		});

		it("should parse title with double quotes", () => {
			const content = `---
title: "My Quoted Title"
---
Content`;
			const result = parseYamlFrontmatter(content);

			expect(result.title).toBe("My Quoted Title");
		});

		it("should parse title with single quotes", () => {
			const content = `---
title: 'Single Quoted Title'
---
Content`;
			const result = parseYamlFrontmatter(content);

			expect(result.title).toBe("Single Quoted Title");
		});

		it("should return empty result when no front matter", () => {
			const content = `# Just a Heading
Some content here.
`;
			const result = parseYamlFrontmatter(content);

			expect(result.title).toBeUndefined();
			expect(result.metadata).toBeUndefined();
		});

		it("should handle empty front matter", () => {
			const content = `---
---
# Content`;
			const result = parseYamlFrontmatter(content);

			expect(result.title).toBeUndefined();
			expect(result.metadata).toBeUndefined();
		});

		it("should handle front matter without title", () => {
			const content = `---
author: Jane Doe
date: 2024-01-15
---
# Heading`;
			const result = parseYamlFrontmatter(content);

			expect(result.title).toBeUndefined();
			expect(result.metadata?.author).toBe("Jane Doe");
			expect(result.metadata?.date).toBe("2024-01-15");
		});

		it("should handle Windows line endings", () => {
			const content = "---\r\ntitle: Windows Title\r\n---\r\nContent";
			const result = parseYamlFrontmatter(content);

			expect(result.title).toBe("Windows Title");
		});
	});

	describe("extractDocumentTitle", () => {
		it("should extract title from YAML front matter", () => {
			const content = `---
title: Frontmatter Title
---
# H1 Heading
Content`;
			const title = extractDocumentTitle(content);

			expect(title).toBe("Frontmatter Title");
		});

		it("should fall back to H1 heading when no front matter title", () => {
			const content = `---
author: Someone
---
# First Heading
Content`;
			const title = extractDocumentTitle(content);

			expect(title).toBe("First Heading");
		});

		it("should extract H1 when no front matter", () => {
			const content = `# Document Title
Some content here.
`;
			const title = extractDocumentTitle(content);

			expect(title).toBe("Document Title");
		});

		it("should return undefined when no title found", () => {
			const content = `Some content without heading or front matter.
More content.
`;
			const title = extractDocumentTitle(content);

			expect(title).toBeUndefined();
		});

		it("should prefer front matter title over H1", () => {
			const content = `---
title: Preferred Title
---
# Different H1
Content`;
			const title = extractDocumentTitle(content);

			expect(title).toBe("Preferred Title");
		});
	});

	describe("hasFrontmatter", () => {
		it("should return true for content with front matter", () => {
			const content = `---
title: Test
---
Content`;
			expect(hasFrontmatter(content)).toBe(true);
		});

		it("should return false for content without front matter", () => {
			const content = `# Just a heading
Content`;
			expect(hasFrontmatter(content)).toBe(false);
		});

		it("should return false for content with dashes mid-document", () => {
			const content = `# Heading

---
This is a horizontal rule, not front matter.
`;
			expect(hasFrontmatter(content)).toBe(false);
		});
	});
});
