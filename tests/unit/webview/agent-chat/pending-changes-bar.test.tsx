/**
 * PendingChangesBar — unit tests for the file-write review bar.
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PendingChangesBar } from "@/features/agent-chat/components/pending-changes-bar";
import type { PendingFileWriteSummary } from "@/features/agent-chat/types";

afterEach(() => {
	cleanup();
});

const SINGLE: readonly PendingFileWriteSummary[] = [
	{
		id: "w-1",
		path: "/repo/src/foo.ts",
		linesAdded: 58,
		linesRemoved: 2,
		languageId: "typescript",
	},
];

const MULTI: readonly PendingFileWriteSummary[] = [
	{ id: "w-1", path: "src/foo.ts", linesAdded: 10, linesRemoved: 1 },
	{ id: "w-2", path: "src/bar.tsx", linesAdded: 3, linesRemoved: 4 },
];

const REJECT_ALL_RE = /reject all/i;
const ACCEPT_ALL_RE = /accept all/i;
const REJECT_FILE_RE = /reject .*foo\.ts/i;
const ACCEPT_FILE_RE = /accept .*foo\.ts/i;

describe("PendingChangesBar", () => {
	it("returns null when there are no pending writes", () => {
		const { container } = render(
			<PendingChangesBar
				onAcceptAll={vi.fn()}
				onAcceptOne={vi.fn()}
				onRejectAll={vi.fn()}
				onRejectOne={vi.fn()}
				writes={[]}
			/>
		);
		expect(container.firstChild).toBeNull();
	});

	it("renders single-file summary with totals", () => {
		render(
			<PendingChangesBar
				onAcceptAll={vi.fn()}
				onAcceptOne={vi.fn()}
				onRejectAll={vi.fn()}
				onRejectOne={vi.fn()}
				writes={SINGLE}
			/>
		);
		expect(screen.getByText("1 file")).toBeInTheDocument();
		expect(screen.getByText("+58")).toBeInTheDocument();
		expect(screen.getByText("-2")).toBeInTheDocument();
	});

	it("aggregates totals in multi-file mode", () => {
		render(
			<PendingChangesBar
				onAcceptAll={vi.fn()}
				onAcceptOne={vi.fn()}
				onRejectAll={vi.fn()}
				onRejectOne={vi.fn()}
				writes={MULTI}
			/>
		);
		expect(screen.getByText("2 files")).toBeInTheDocument();
		// Aggregated totals appear in the row stats (the per-file
		// stats appear once expanded). +13 -5
		expect(screen.getByText("+13")).toBeInTheDocument();
		expect(screen.getByText("-5")).toBeInTheDocument();
	});

	it("calls onAcceptAll / onRejectAll when the bulk buttons are clicked", () => {
		const onAcceptAll = vi.fn();
		const onRejectAll = vi.fn();
		render(
			<PendingChangesBar
				onAcceptAll={onAcceptAll}
				onAcceptOne={vi.fn()}
				onRejectAll={onRejectAll}
				onRejectOne={vi.fn()}
				writes={SINGLE}
			/>
		);
		fireEvent.click(screen.getByRole("button", { name: REJECT_ALL_RE }));
		fireEvent.click(screen.getByRole("button", { name: ACCEPT_ALL_RE }));
		expect(onRejectAll).toHaveBeenCalledTimes(1);
		expect(onAcceptAll).toHaveBeenCalledTimes(1);
	});

	it("expands into a per-file list and surfaces individual Accept/Reject", () => {
		const onAcceptOne = vi.fn();
		const onRejectOne = vi.fn();
		render(
			<PendingChangesBar
				onAcceptAll={vi.fn()}
				onAcceptOne={onAcceptOne}
				onRejectAll={vi.fn()}
				onRejectOne={onRejectOne}
				writes={SINGLE}
			/>
		);
		// Toggle expanded mode (summary button is the first button).
		fireEvent.click(screen.getAllByRole("button")[0]);
		// Now the per-file Reject/Accept buttons exist.
		fireEvent.click(screen.getByRole("button", { name: REJECT_FILE_RE }));
		expect(onRejectOne).toHaveBeenCalledWith("w-1");
		fireEvent.click(screen.getByRole("button", { name: ACCEPT_FILE_RE }));
		expect(onAcceptOne).toHaveBeenCalledWith("w-1");
	});
});
