/**
 * WorktreeBanner tests (T054).
 * TDD: red before T064.
 *
 * Covers the two-step cleanup confirmation flow from
 * contracts/agent-chat-panel-protocol.md §5 and §4.7.
 */

import {
	cleanup,
	fireEvent,
	render,
	screen,
	within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WorktreeBanner } from "@/features/agent-chat/components/worktree-banner";

const CLEANUP_BUTTON_RE = /clean up/i;
const CONFIRM_BUTTON_RE = /^confirm cleanup/i;
const CANCEL_BUTTON_RE = /cancel/i;
const WARNING_RE = /uncommitted|unpushed|destructive/i;
const PATH_RE = /\.gatomia\/worktrees\//;
const BRANCH_RE = /gatomia\/agent-chat\//;

afterEach(() => {
	cleanup();
});

describe("WorktreeBanner", () => {
	it("renders path, branch, and status", () => {
		render(
			<WorktreeBanner
				branch="gatomia/agent-chat/sess-1"
				onConfirmCleanup={vi.fn()}
				onRequestCleanup={vi.fn()}
				path=".gatomia/worktrees/sess-1/"
				status="created"
				warning={undefined}
			/>
		);
		expect(screen.getByText(PATH_RE)).toBeInTheDocument();
		expect(screen.getByText(BRANCH_RE)).toBeInTheDocument();
	});

	it("shows Clean up button on a clean worktree; clicking emits onRequestCleanup", () => {
		const onRequestCleanup = vi.fn();
		render(
			<WorktreeBanner
				branch="gatomia/agent-chat/sess-1"
				onConfirmCleanup={vi.fn()}
				onRequestCleanup={onRequestCleanup}
				path=".gatomia/worktrees/sess-1/"
				status="in-use"
				warning={undefined}
			/>
		);
		fireEvent.click(screen.getByRole("button", { name: CLEANUP_BUTTON_RE }));
		expect(onRequestCleanup).toHaveBeenCalledTimes(1);
	});

	it("shows warning dialog when a warning is provided; Confirm emits onConfirmCleanup", () => {
		const onConfirmCleanup = vi.fn();
		render(
			<WorktreeBanner
				branch="gatomia/agent-chat/sess-1"
				onConfirmCleanup={onConfirmCleanup}
				onRequestCleanup={vi.fn()}
				path=".gatomia/worktrees/sess-1/"
				status="in-use"
				warning={{ uncommittedPaths: [" M a.ts"], unpushedCommits: 1 }}
			/>
		);
		const dialog = screen.getByRole("alertdialog");
		expect(within(dialog).getAllByText(WARNING_RE).length).toBeGreaterThan(0);
		fireEvent.click(
			within(dialog).getByRole("button", { name: CONFIRM_BUTTON_RE })
		);
		expect(onConfirmCleanup).toHaveBeenCalledTimes(1);
	});

	it("Cancel inside the dialog does NOT emit onConfirmCleanup", () => {
		const onConfirmCleanup = vi.fn();
		render(
			<WorktreeBanner
				branch="gatomia/agent-chat/sess-1"
				onConfirmCleanup={onConfirmCleanup}
				onRequestCleanup={vi.fn()}
				path=".gatomia/worktrees/sess-1/"
				status="in-use"
				warning={{ uncommittedPaths: [" M a.ts"], unpushedCommits: 1 }}
			/>
		);
		const dialog = screen.getByRole("alertdialog");
		fireEvent.click(
			within(dialog).getByRole("button", { name: CANCEL_BUTTON_RE })
		);
		expect(onConfirmCleanup).not.toHaveBeenCalled();
	});
});
