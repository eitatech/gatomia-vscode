import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { KanbanBoard } from "../../../src/components/kanban/kanban-board";
import type { NormalizedTask } from "../../../../src/features/tasks/task-model";

describe("KanbanBoard", () => {
	it("renders all columns", () => {
		const { getByText } = render(<KanbanBoard tasks={[]} />);
		expect(getByText("Queued")).toBeInTheDocument();
		expect(getByText("Ready")).toBeInTheDocument();
		expect(getByText("Running")).toBeInTheDocument();
		expect(getByText("Blocked")).toBeInTheDocument();
		expect(getByText("Completed")).toBeInTheDocument();
		expect(getByText("Failed")).toBeInTheDocument();
	});

	it("groups tasks by state", () => {
		const tasks: NormalizedTask[] = [
			{
				id: "1",
				title: "Queued Task",
				status: "not-started",
				source: { system: "speckit", externalId: "1" },
				execution: { state: "queued" },
			},
			{
				id: "2",
				title: "Running Task",
				status: "in-progress",
				source: { system: "speckit", externalId: "2" },
				execution: { state: "running" },
			},
		];

		const { getByText } = render(<KanbanBoard tasks={tasks} />);
		expect(getByText("Queued Task")).toBeInTheDocument();
		expect(getByText("Running Task")).toBeInTheDocument();
	});
});
