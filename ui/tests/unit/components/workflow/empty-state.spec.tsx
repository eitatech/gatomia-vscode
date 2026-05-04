import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { EmptyState } from "@/components/workflow/empty-state";

describe("Workflow Empty State", () => {
	it("should render title and description", () => {
		render(
			<EmptyState
				description="There are no items to display."
				title="No Items"
			/>
		);
		expect(screen.getByText("No Items")).toBeInTheDocument();
		expect(
			screen.getByText("There are no items to display.")
		).toBeInTheDocument();
	});

	it("should render eyebrow", () => {
		render(<EmptyState eyebrow="Inventory" title="No Items" />);
		expect(screen.getByText("Inventory")).toBeInTheDocument();
	});

	it("should render children", () => {
		render(
			<EmptyState title="No Items">
				<div data-testid="custom-child">Child Content</div>
			</EmptyState>
		);
		expect(screen.getByTestId("custom-child")).toBeInTheDocument();
	});

	it("should render actions", () => {
		render(
			<EmptyState
				actions={<button type="button">Create One</button>}
				title="No Items"
			/>
		);
		expect(
			screen.getByRole("button", { name: "Create One" })
		).toBeInTheDocument();
	});

	it("should apply custom class names", () => {
		const { container } = render(
			<EmptyState className="my-custom-class" title="No Items" />
		);
		expect(container.firstChild).toHaveClass("my-custom-class");
	});
});
