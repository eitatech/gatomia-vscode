import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "../../../../ui/src/components/ui/button";
import {
	ActionToolbar,
	EmptyState,
	MetricRow,
	PanelSection,
} from "../../../../ui/src/components/workflow";

describe("workflow foundation components", () => {
	it("renders panel sections with shared header content and actions", () => {
		render(
			<PanelSection
				actions={<Button size="sm">Refresh</Button>}
				description="Shared orchestration section shell"
				title="Overview"
			>
				<div>Section body</div>
			</PanelSection>
		);

		expect(screen.getByText("Overview")).toBeInTheDocument();
		expect(
			screen.getByText("Shared orchestration section shell")
		).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Refresh" })).toBeInTheDocument();
		expect(screen.getByText("Section body")).toBeInTheDocument();
	});

	it("renders metric rows with labels, values, and helper copy", () => {
		render(
			<MetricRow
				helper="Updated 2 minutes ago"
				label="Active provider"
				value="Devin"
			/>
		);

		expect(screen.getByText("Active provider")).toBeInTheDocument();
		expect(screen.getByText("Devin")).toBeInTheDocument();
		expect(screen.getByText("Updated 2 minutes ago")).toBeInTheDocument();
	});

	it("renders empty states with shared actions", () => {
		render(
			<EmptyState
				actions={<Button size="sm">Open Agent Chat</Button>}
				description="Start a local session or connect a provider."
				eyebrow="Running agents"
				title="No sessions yet"
			/>
		);

		expect(screen.getByText("Running agents")).toBeInTheDocument();
		expect(screen.getByText("No sessions yet")).toBeInTheDocument();
		expect(
			screen.getByText("Start a local session or connect a provider.")
		).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Open Agent Chat" })
		).toBeInTheDocument();
	});

	it("renders toolbars as compact action groups", () => {
		render(
			<ActionToolbar aria-label="orchestration actions" density="compact">
				<Button size="sm">Refresh</Button>
				<Button size="sm" variant="outline">
					Open Cloud Agents
				</Button>
			</ActionToolbar>
		);

		expect(screen.getByLabelText("orchestration actions")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Refresh" })).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Open Cloud Agents" })
		).toBeInTheDocument();
	});
});
