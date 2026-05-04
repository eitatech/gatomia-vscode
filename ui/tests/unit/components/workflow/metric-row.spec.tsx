import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MetricRow } from "@/components/workflow/metric-row";

describe("Workflow Metric Row", () => {
	it("should render label and value", () => {
		render(<MetricRow label="Status" value="Active" />);
		expect(screen.getByText("Status")).toBeInTheDocument();
		expect(screen.getByText("Active")).toBeInTheDocument();
	});

	it("should render helper text if provided", () => {
		render(
			<MetricRow helper="Additional details" label="Status" value="Active" />
		);
		expect(screen.getByText("Additional details")).toBeInTheDocument();
	});

	it("should apply custom class names", () => {
		const { container } = render(
			<MetricRow className="my-custom-class" label="Status" value="Active" />
		);
		expect(container.firstChild).toHaveClass("my-custom-class");
	});
});
