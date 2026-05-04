import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PanelSection } from "@/components/workflow/panel-section";

describe("Workflow Panel Section", () => {
	it("should render children correctly", () => {
		render(<PanelSection>Panel Content</PanelSection>);
		expect(screen.getByText("Panel Content")).toBeInTheDocument();
	});

	it("should render title and description", () => {
		render(
			<PanelSection description="My Description" title="My Title">
				Content
			</PanelSection>
		);
		expect(screen.getByText("My Title")).toBeInTheDocument();
		expect(screen.getByText("My Description")).toBeInTheDocument();
	});

	it("should render actions", () => {
		render(
			<PanelSection actions={<button type="button">My Action</button>}>
				Content
			</PanelSection>
		);
		expect(
			screen.getByRole("button", { name: "My Action" })
		).toBeInTheDocument();
	});

	it("should apply custom class names", () => {
		const { container } = render(
			<PanelSection
				className="my-custom-class"
				contentClassName="my-content-class"
			>
				Content
			</PanelSection>
		);
		expect(container.firstChild).toHaveClass("my-custom-class");

		// The content wrapper is the element containing the text
		const contentWrapper = screen.getByText("Content");
		expect(contentWrapper).toHaveClass("my-content-class");
	});

	it("should use a custom element when 'as' prop is provided", () => {
		const { container } = render(
			<PanelSection as="article">Content</PanelSection>
		);
		expect(container.firstChild?.nodeName).toBe("ARTICLE");
	});
});
