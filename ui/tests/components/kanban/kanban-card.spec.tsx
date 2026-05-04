import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { KanbanCard } from "../../../src/components/kanban/kanban-card";
import type { NormalizedTask } from "../../../../src/features/tasks/task-model";

describe("KanbanCard", () => {
	it("renders basic task information", () => {
		const task: NormalizedTask = {
			id: "1",
			title: "Basic Task",
			status: "not-started",
			source: { system: "test", externalId: "1" },
			metadata: { priority: "high" },
			execution: {
				state: "queued",
				suggestedRole: "frontend",
				intent: "Do the thing",
			},
		};

		const { getByText } = render(<KanbanCard task={task} />);

		expect(getByText("Basic Task")).toBeInTheDocument();
		expect(getByText("high")).toBeInTheDocument();
		expect(getByText("Source: test")).toBeInTheDocument();
		expect(getByText("Agent: frontend")).toBeInTheDocument();
		expect(getByText("Activity: Do the thing")).toBeInTheDocument();
	});

	it("renders blocked and error states", () => {
		const task: NormalizedTask = {
			id: "1",
			title: "Failed Task",
			status: "failed",
			source: { system: "test", externalId: "1" },
			execution: {
				state: "failed",
				dependsOn: ["task-2"],
				errorMessage: "Something went wrong",
			},
		};

		const { getByText } = render(<KanbanCard task={task} />);

		expect(getByText("Blocked by: task-2")).toBeInTheDocument();
		expect(getByText("Error: Something went wrong")).toBeInTheDocument();
	});
});
