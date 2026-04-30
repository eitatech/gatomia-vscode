import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
	formatWorkflowStatusLabel,
	getWorkflowStatusTone,
	StatusBadge,
} from "../../../../ui/src/components/workflow";

describe("StatusBadge", () => {
	it("maps representative orchestration and hook statuses to shared tones", () => {
		expect(getWorkflowStatusTone("running")).toBe("active");
		expect(getWorkflowStatusTone("waiting-for-input")).toBe("warning");
		expect(getWorkflowStatusTone("completed")).toBe("success");
		expect(getWorkflowStatusTone("failed")).toBe("danger");
		expect(getWorkflowStatusTone("paused")).toBe("warning");
		expect(getWorkflowStatusTone("unknown-state")).toBe("neutral");
	});

	it("formats machine status strings into badge labels", () => {
		expect(formatWorkflowStatusLabel("waiting_for_input")).toBe(
			"waiting for input"
		);
	});

	it("renders the formatted status label by default", () => {
		render(<StatusBadge status="ended-by-shutdown" />);

		expect(screen.getByText("ended by shutdown")).toBeInTheDocument();
	});
});
