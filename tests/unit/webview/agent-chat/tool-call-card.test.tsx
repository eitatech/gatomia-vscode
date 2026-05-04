/**
 * ToolCallCard — unit tests for the diff card surfaced on tool messages.
 *
 * Coverage target:
 *   - Single-file mode renders the file basename and `+N -M` totals.
 *   - Multi-file mode shows the aggregate header and expands into a
 *     row-per-file list when toggled.
 *   - Returns `null` when the affectedFiles array is empty so the
 *     parent `ChatMessageItem` can fall back to a plain title row.
 *   - Status modifier propagates to the card root for theming.
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ToolCallCard } from "@/features/agent-chat/components/tool-call-card";
import type { ToolCallAffectedFile } from "@/features/agent-chat/types";

afterEach(() => {
	cleanup();
});

const SINGLE_FILE: readonly ToolCallAffectedFile[] = [
	{
		path: "/abs/repo/src/services/acp-client.ts",
		linesAdded: 47,
		linesRemoved: 1,
		languageId: "typescript",
	},
];

const MULTI_FILES: readonly ToolCallAffectedFile[] = [
	{
		path: "src/foo.ts",
		linesAdded: 10,
		linesRemoved: 0,
		languageId: "typescript",
	},
	{
		path: "src/bar.tsx",
		linesAdded: 3,
		linesRemoved: 5,
		languageId: "typescriptreact",
	},
	{
		path: "README.md",
		linesAdded: 1,
		linesRemoved: 1,
		languageId: "markdown",
	},
];

describe("ToolCallCard", () => {
	it("returns null when affectedFiles is empty (caller renders fallback)", () => {
		const { container } = render(
			<ToolCallCard
				affectedFiles={[]}
				status="succeeded"
				toolCallId="tc-empty"
			/>
		);
		expect(container.firstChild).toBeNull();
	});

	it("renders the file basename + totals in single-file mode", () => {
		render(
			<ToolCallCard
				affectedFiles={SINGLE_FILE}
				status="succeeded"
				toolCallId="tc-single"
			/>
		);
		expect(screen.getByText("acp-client.ts")).toBeInTheDocument();
		expect(screen.getByText("+47")).toBeInTheDocument();
		expect(screen.getByText("-1")).toBeInTheDocument();
	});

	it("uses the language badge for the header pill", () => {
		const { container } = render(
			<ToolCallCard
				affectedFiles={SINGLE_FILE}
				status="running"
				toolCallId="tc-lang"
			/>
		);
		const badge = container.querySelector(".agent-chat-tool-card__lang");
		expect(badge?.textContent).toBe("TS");
	});

	it("disables expand toggle in single-file mode", () => {
		render(
			<ToolCallCard
				affectedFiles={SINGLE_FILE}
				status="succeeded"
				toolCallId="tc-disabled"
			/>
		);
		const button = screen.getByRole("button");
		expect(button).toBeDisabled();
	});

	it("aggregates totals across files in multi-file mode", () => {
		render(
			<ToolCallCard
				affectedFiles={MULTI_FILES}
				status="succeeded"
				toolCallId="tc-multi"
			/>
		);
		// 10 + 3 + 1 = 14, 0 + 5 + 1 = 6
		expect(screen.getByText("3 files")).toBeInTheDocument();
		expect(screen.getByText("+14")).toBeInTheDocument();
		expect(screen.getByText("-6")).toBeInTheDocument();
	});

	it("expands into a per-file list when toggled", () => {
		render(
			<ToolCallCard
				affectedFiles={MULTI_FILES}
				status="succeeded"
				toolCallId="tc-expand"
			/>
		);
		// Initially collapsed — none of the row file names visible.
		expect(screen.queryByText("foo.ts")).toBeNull();
		fireEvent.click(screen.getByRole("button"));
		expect(screen.getByText("foo.ts")).toBeInTheDocument();
		expect(screen.getByText("bar.tsx")).toBeInTheDocument();
		expect(screen.getByText("README.md")).toBeInTheDocument();
	});

	it("propagates status to the card root className for theming", () => {
		const { container } = render(
			<ToolCallCard
				affectedFiles={SINGLE_FILE}
				status="failed"
				toolCallId="tc-failed"
			/>
		);
		const root = container.querySelector(".agent-chat-tool-card");
		expect(root?.className).toContain("agent-chat-tool-card--failed");
	});
});
