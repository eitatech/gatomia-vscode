import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WorkflowGraph } from "../../../src/components/workflow-graph";

describe("WorkflowGraph", () => {
	it("renders without crashing", () => {
		const { container } = render(<WorkflowGraph edges={[]} nodes={[]} />);
		expect(container).toBeDefined();
	});

	it("renders nodes correctly", () => {
		const nodes = [
			{
				id: "1",
				type: "action",
				position: { x: 0, y: 0 },
				data: { label: "Test Action Node", status: "active" as const },
			},
		];
		const { getByText } = render(<WorkflowGraph edges={[]} nodes={nodes} />);
		// Check that the node renders its label
		expect(getByText("Test Action Node")).toBeInTheDocument();
	});
});
