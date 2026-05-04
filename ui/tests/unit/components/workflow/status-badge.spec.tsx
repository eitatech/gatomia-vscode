import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import {
	StatusBadge,
	formatWorkflowStatusLabel,
	getWorkflowStatusTone,
} from "@/components/workflow/status-badge";

describe("Workflow Status Badge", () => {
	describe("getWorkflowStatusTone", () => {
		it("should identify success statuses", () => {
			expect(getWorkflowStatusTone("completed")).toBe("success");
			expect(getWorkflowStatusTone("success")).toBe("success");
			expect(getWorkflowStatusTone("passed")).toBe("success");
		});

		it("should identify danger statuses", () => {
			expect(getWorkflowStatusTone("failed")).toBe("danger");
			expect(getWorkflowStatusTone("error")).toBe("danger");
			expect(getWorkflowStatusTone("cancelled")).toBe("danger");
		});

		it("should identify warning statuses", () => {
			expect(getWorkflowStatusTone("pending")).toBe("warning");
			expect(getWorkflowStatusTone("blocked")).toBe("warning");
			expect(getWorkflowStatusTone("paused")).toBe("warning");
		});

		it("should identify active statuses", () => {
			expect(getWorkflowStatusTone("running")).toBe("active");
			expect(getWorkflowStatusTone("executing")).toBe("active");
			expect(getWorkflowStatusTone("active")).toBe("active");
		});

		it("should default to neutral for unknown statuses", () => {
			expect(getWorkflowStatusTone("unknown")).toBe("neutral");
			expect(getWorkflowStatusTone("")).toBe("neutral");
			expect(getWorkflowStatusTone(undefined)).toBe("neutral");
		});

		it("should normalize status inputs", () => {
			expect(getWorkflowStatusTone("  RUNNING  ")).toBe("active");
			expect(getWorkflowStatusTone("ended_by_shutdown")).toBe("danger");
		});
	});

	describe("formatWorkflowStatusLabel", () => {
		it("should format statuses to be readable", () => {
			expect(formatWorkflowStatusLabel("waiting_for_input")).toBe(
				"waiting for input"
			);
			expect(formatWorkflowStatusLabel("  PENDING  ")).toBe("pending");
		});
	});

	describe("StatusBadge Component", () => {
		it("should render children", () => {
			render(<StatusBadge>Custom Content</StatusBadge>);
			expect(screen.getByText("Custom Content")).toBeInTheDocument();
		});

		it("should render label over status", () => {
			render(<StatusBadge label="Custom Label" status="running" />);
			expect(screen.getByText("Custom Label")).toBeInTheDocument();
		});

		it("should render formatted status if no label or children", () => {
			render(<StatusBadge status="in_progress" />);
			expect(screen.getByText("in progress")).toBeInTheDocument();
		});

		it("should apply custom class names", () => {
			const { container } = render(
				<StatusBadge className="my-custom-class">Content</StatusBadge>
			);
			expect(container.firstChild).toHaveClass("my-custom-class");
		});
	});
});
