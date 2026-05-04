import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { KanbanColumn } from "../../../src/components/kanban/kanban-column";
import type { NormalizedTask } from "../../../../src/features/tasks/task-model";

describe("KanbanColumn", () => {
	it("renders column title and task count", () => {
		const tasks: NormalizedTask[] = [
			{
				id: "1",
				title: "Test Task",
				status: "not-started",
				source: { system: "test", externalId: "1" },
				execution: { state: "queued" },
			},
		];

		const { getByText } = render(
			<KanbanColumn state="queued" tasks={tasks} title="Queued" />
		);

		expect(getByText("Queued")).toBeInTheDocument();
		expect(getByText("1")).toBeInTheDocument();
		expect(getByText("Test Task")).toBeInTheDocument();
	});

	it("renders empty state when no tasks", () => {
		const { getByText } = render(
			<KanbanColumn state="queued" tasks={[]} title="Queued" />
		);

		expect(getByText("No tasks")).toBeInTheDocument();
		expect(getByText("0")).toBeInTheDocument();
	});
});
