/**
 * SessionsList tests.
 *
 * The list is rendered at the top of the empty-state surface. It echoes
 * the bridge `state.sessions` array, exposes a click affordance per row,
 * and lazily reveals older sessions through a "MORE" toggle once the
 * list grows past the visible-row cap (5).
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SessionsList } from "@/features/agent-chat/components/sessions-list";
import type { SidebarSessionListItem } from "@/features/agent-chat/types";

const SHOW_MORE_RE = /Show \d+ more sessions/i;
const NOW = 1_700_000_000_000;

afterEach(() => {
	cleanup();
});

function makeSession(
	overrides: Partial<SidebarSessionListItem> = {}
): SidebarSessionListItem {
	return {
		id: "session-1",
		agentDisplayName: "Claude",
		lifecycleState: "running",
		updatedAt: NOW,
		isTerminal: false,
		...overrides,
	};
}

describe("SessionsList", () => {
	it("renders nothing when there are no sessions", () => {
		const { container } = render(
			<SessionsList onPick={vi.fn()} sessions={[]} />
		);
		expect(container.firstChild).toBeNull();
	});

	it("renders the SESSIONS header and one row per session", () => {
		const sessions: SidebarSessionListItem[] = [
			makeSession({ id: "a", title: "First task" }),
			makeSession({ id: "b", title: "Second task" }),
		];
		render(<SessionsList onPick={vi.fn()} sessions={sessions} />);

		expect(screen.getByText("SESSIONS")).toBeDefined();
		expect(screen.getByText("First task")).toBeDefined();
		expect(screen.getByText("Second task")).toBeDefined();
	});

	it("falls back to agentDisplayName when title is missing", () => {
		const sessions = [makeSession({ id: "a", agentDisplayName: "Devin" })];
		render(<SessionsList onPick={vi.fn()} sessions={sessions} />);

		expect(screen.getByText("Devin")).toBeDefined();
	});

	it("invokes onPick with the session id when a row is clicked", () => {
		const onPick = vi.fn();
		const sessions = [makeSession({ id: "x-1", title: "Pickable" })];
		render(<SessionsList onPick={onPick} sessions={sessions} />);

		fireEvent.click(screen.getByText("Pickable"));

		expect(onPick).toHaveBeenCalledWith("x-1");
	});

	it("marks the active session row with aria-current=true", () => {
		const sessions = [
			makeSession({ id: "a", title: "Inactive" }),
			makeSession({ id: "b", title: "Active" }),
		];
		render(
			<SessionsList activeSessionId="b" onPick={vi.fn()} sessions={sessions} />
		);

		const activeButton = screen.getByText("Active").closest("button");
		expect(activeButton?.getAttribute("aria-current")).toBe("true");

		const otherButton = screen.getByText("Inactive").closest("button");
		expect(otherButton?.getAttribute("aria-current")).toBe("false");
	});

	it("collapses sessions past the cap and exposes a MORE toggle", () => {
		// 7 sessions -> 5 visible by default, 2 hidden.
		const sessions = Array.from({ length: 7 }, (_, i) =>
			makeSession({ id: `s-${i}`, title: `Session ${i}` })
		);
		render(<SessionsList onPick={vi.fn()} sessions={sessions} />);

		expect(screen.queryByText("Session 5")).toBeNull();
		expect(screen.queryByText("Session 6")).toBeNull();

		fireEvent.click(screen.getByRole("button", { name: SHOW_MORE_RE }));

		expect(screen.getByText("Session 5")).toBeDefined();
		expect(screen.getByText("Session 6")).toBeDefined();
	});

	it("does not render the MORE toggle when sessions fit under the cap", () => {
		const sessions = Array.from({ length: 3 }, (_, i) =>
			makeSession({ id: `s-${i}`, title: `Session ${i}` })
		);
		render(<SessionsList onPick={vi.fn()} sessions={sessions} />);

		expect(screen.queryByRole("button", { name: SHOW_MORE_RE })).toBeNull();
	});
});
