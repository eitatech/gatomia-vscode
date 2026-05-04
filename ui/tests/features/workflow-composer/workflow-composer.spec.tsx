import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { WorkflowComposerFeature } from "../../../src/features/workflow-composer";
import { vscode } from "../../../src/bridge/vscode";
import type { Hook } from "../../../src/features/hooks-view/types";
import { act } from "react";

// Mock vscode API
vi.mock("../../../src/bridge/vscode", () => ({
	vscode: {
		postMessage: vi.fn(),
	},
}));

// Mock React Flow since it requires a real DOM context typically
vi.mock("@xyflow/react", () => ({
	ReactFlow: ({ children, nodes }: any) => (
		<div data-testid="mock-react-flow">
			{nodes.map((node: any) => (
				<div
					data-hook-id={node.data.hookId}
					data-testid={`mock-node-${node.type}`}
					key={node.id}
				>
					{node.data.label}
				</div>
			))}
			{children}
		</div>
	),
	Background: () => <div data-testid="mock-background" />,
	Controls: () => <div data-testid="mock-controls" />,
	applyNodeChanges: vi.fn((changes, nodes) => nodes),
	applyEdgeChanges: vi.fn((changes, edges) => edges),
}));

describe("WorkflowComposerFeature", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("sends ready and list messages on mount", () => {
		render(<WorkflowComposerFeature />);
		expect(vscode.postMessage).toHaveBeenCalledWith(
			expect.objectContaining({ type: "hooks/ready" })
		);
		expect(vscode.postMessage).toHaveBeenCalledWith(
			expect.objectContaining({ type: "hooks/list" })
		);
	});

	it("renders hooks when receiving sync message", async () => {
		render(<WorkflowComposerFeature />);

		const hook: Hook = {
			id: "hook-123",
			name: "Test Hook",
			enabled: true,
			events: [{ type: "repository", pattern: "main" }],
			action: { type: "agent", parameters: { command: "test" } },
			createdAt: 0,
			modifiedAt: 0,
			executionCount: 0,
		};

		// Simulate message from extension
		act(() => {
			window.dispatchEvent(
				new MessageEvent("message", {
					data: {
						type: "hooks/sync",
						payload: { hooks: [hook] },
					},
				})
			);
		});

		// Wait for render
		await waitFor(() => {
			expect(screen.getAllByTestId("mock-node-source")).toHaveLength(1);
			expect(screen.getAllByTestId("mock-node-action")).toHaveLength(1);
		});
	});

	it("shows the hook form when 'New Hook' is clicked", () => {
		render(<WorkflowComposerFeature />);

		fireEvent.click(screen.getByText("New Hook"));

		// The hook form should appear
		expect(screen.getByText("Hook Details")).toBeInTheDocument();
	});
});
