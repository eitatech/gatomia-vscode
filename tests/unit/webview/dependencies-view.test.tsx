import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DependenciesView } from "../../../ui/src/features/dependencies-view";

const mockVscode = vi.hoisted(() => ({
	postMessage: vi.fn(),
}));

vi.mock("@/bridge/vscode", () => ({
	vscode: {
		postMessage: mockVscode.postMessage,
	},
}));

const dispatchDependenciesStatus = (gatomiaInstalled: boolean) => {
	window.dispatchEvent(
		new MessageEvent("message", {
			data: {
				type: "dependencies/status",
				payload: {
					dependencies: [
						{
							name: "GatomIA CLI",
							installed: gatomiaInstalled,
							version: gatomiaInstalled ? "1.0.0" : undefined,
							command: "gatomia --version",
						},
					],
					steps: [],
				},
			},
		})
	);
};

describe("DependenciesView", () => {
	it("shows gatomia copilot configuration instructions after gatomia is installed", async () => {
		render(<DependenciesView />);
		dispatchDependenciesStatus(true);

		expect(
			await screen.findByText("Configure GatomIA CLI with GitHub Copilot")
		).toBeInTheDocument();
		expect(
			screen.getByText(
				"gatomia config set --llm-provider copilot --main-model gpt-4"
			)
		).toBeInTheDocument();
	});

	it("hides gatomia copilot configuration instructions when gatomia is missing", () => {
		render(<DependenciesView />);
		dispatchDependenciesStatus(false);

		expect(
			screen.queryByText("Configure GatomIA CLI with GitHub Copilot")
		).not.toBeInTheDocument();
	});
});
