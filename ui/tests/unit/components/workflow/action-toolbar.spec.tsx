import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { ActionToolbar } from "@/components/workflow/action-toolbar";

describe("Workflow Action Toolbar", () => {
	it("should render children", () => {
		const { getByText } = render(
			<ActionToolbar>
				<button type="button">Action 1</button>
				<button type="button">Action 2</button>
			</ActionToolbar>
		);
		expect(getByText("Action 1")).toBeInTheDocument();
		expect(getByText("Action 2")).toBeInTheDocument();
	});

	it("should apply alignment classes", () => {
		const { container: startContainer } = render(
			<ActionToolbar align="start" />
		);
		expect(startContainer.firstChild).toHaveClass("justify-start");

		const { container: betweenContainer } = render(
			<ActionToolbar align="between" />
		);
		expect(betweenContainer.firstChild).toHaveClass("justify-between");

		const { container: endContainer } = render(<ActionToolbar align="end" />);
		expect(endContainer.firstChild).toHaveClass("justify-end");
	});

	it("should apply density classes", () => {
		const { container: compactContainer } = render(
			<ActionToolbar density="compact" />
		);
		expect(compactContainer.firstChild).toHaveClass("gap-1.5");

		const { container: defaultContainer } = render(
			<ActionToolbar density="default" />
		);
		expect(defaultContainer.firstChild).toHaveClass("gap-2");
	});

	it("should apply custom class names", () => {
		const { container } = render(<ActionToolbar className="my-custom-class" />);
		expect(container.firstChild).toHaveClass("my-custom-class");
	});
});
