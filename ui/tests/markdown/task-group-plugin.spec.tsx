import { describe, expect, it } from "vitest";
import MarkdownIt from "markdown-it";
import { taskGroupPlugin } from "../../src/lib/markdown/plugins/task-group-plugin";

describe("taskGroupPlugin", () => {
	it("detects Phase headers and injects execute buttons", () => {
		const md = new MarkdownIt();
		md.use(taskGroupPlugin);

		const markdown = "## Phase 1: Foundation & Core Types\n\nContent here";
		const html = md.render(markdown);

		// Should contain the button with the data-execute-task-group attribute
		expect(html).toContain("data-execute-task-group");
		// The heading text will be there
		expect(html).toContain("Foundation");
		expect(html).toContain("Core");
		expect(html).toContain("Execute Group");
	});

	it("handles Phase headers with priority tags", () => {
		const md = new MarkdownIt();
		md.use(taskGroupPlugin);

		const markdown = "## Phase 2: Core Features (P1)\n\nContent here";
		const html = md.render(markdown);

		expect(html).toContain("data-execute-task-group");
		expect(html).toContain("Execute Group");
	});

	it("handles Phase headers with emoji", () => {
		const md = new MarkdownIt();
		md.use(taskGroupPlugin);

		const markdown = "## Phase 3: User Story 1 - MVP 🎯\n\nContent here";
		const html = md.render(markdown);

		expect(html).toContain("data-execute-task-group");
		expect(html).toContain("Execute Group");
	});

	it("does not inject buttons for h1 or h3 headings", () => {
		const md = new MarkdownIt();
		md.use(taskGroupPlugin);

		const markdown =
			"# Phase 1: This is h1\n### Phase 2: This is h3\n\nContent";
		const html = md.render(markdown);

		// Should have exactly 0 buttons (no data-execute-task-group)
		const matches = html.match(/data-execute-task-group/g);
		expect(matches).toBeNull();
	});

	it("does not inject buttons for non-Phase headers", () => {
		const md = new MarkdownIt();
		md.use(taskGroupPlugin);

		const markdown = "## Regular Header\n\nContent here";
		const html = md.render(markdown);

		expect(html).not.toContain("data-execute-task-group");
	});

	it("escapes HTML special characters in group names", () => {
		const md = new MarkdownIt();
		md.use(taskGroupPlugin);

		const markdown = "## Phase 1: Features & <Scripts>\n\nContent here";
		const html = md.render(markdown);

		// Check that HTML entities are used
		expect(html).toContain("&amp;");
		expect(html).toContain("&lt;");
		expect(html).toContain("&gt;");
	});

	it("renders button with correct styling classes", () => {
		const md = new MarkdownIt();
		md.use(taskGroupPlugin);

		const markdown = "## Phase 1: Foundation\n\nContent";
		const html = md.render(markdown);

		// Should have button styling classes
		expect(html).toContain("rounded");
		expect(html).toContain("border");
		expect(html).toContain("px-2");
		expect(html).toContain("py-1");
		expect(html).toContain("text-xs");
	});

	it("handles multiple Phase headers in the same document", () => {
		const md = new MarkdownIt();
		md.use(taskGroupPlugin);

		const markdown = `
## Phase 1: Foundation
Content for phase 1

## Phase 2: Features
Content for phase 2

## Phase 3: Polish
Content for phase 3
`;
		const html = md.render(markdown);

		// Should have 3 buttons
		const matches = html.match(/data-execute-task-group/g);
		expect(matches?.length).toBe(3);
	});
});
