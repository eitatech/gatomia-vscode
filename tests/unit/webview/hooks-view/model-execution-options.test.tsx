import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ModelExecutionOptions } from "../../../../ui/src/features/hooks-view/components/cli-options/model-execution-options";
import type { CopilotCliOptions } from "../../../../ui/src/features/hooks-view/types";

const AI_MODEL_LABEL = /ai model/i;

// Helper to dispatch a message event simulating a response from the extension
function dispatchModelsAvailable(
	models: {
		id: string;
		name: string;
		family: string;
		maxInputTokens: number;
	}[],
	isStale = false
) {
	window.dispatchEvent(
		new MessageEvent("message", {
			data: { type: "hooks/models-available", models, isStale },
		})
	);
}

function dispatchModelsError(message: string) {
	window.dispatchEvent(
		new MessageEvent("message", {
			data: { type: "hooks/models-error", message },
		})
	);
}

const FAKE_MODELS = [
	{
		id: "claude-sonnet-4.5",
		name: "Claude Sonnet 4.5",
		family: "claude",
		maxInputTokens: 200_000,
	},
	{ id: "gpt-4o", name: "GPT-4o", family: "gpt-4", maxInputTokens: 128_000 },
];

describe("ModelExecutionOptions (dynamic models)", () => {
	let postMessageMock: ReturnType<typeof vi.fn>;
	const noop = vi.fn();

	const defaultOptions: CopilotCliOptions = {};

	beforeEach(() => {
		postMessageMock = vi.fn();
		(window as { acquireVsCodeApi?: unknown }).acquireVsCodeApi = () => ({
			postMessage: postMessageMock,
			getState: vi.fn(),
			setState: vi.fn(),
		});
	});

	afterEach(() => {
		vi.clearAllMocks();
		(window as { acquireVsCodeApi?: unknown }).acquireVsCodeApi = undefined;
	});

	it("renders a select element with options from the dynamic model list", async () => {
		render(<ModelExecutionOptions onChange={noop} value={defaultOptions} />);

		await act(() => {
			dispatchModelsAvailable(FAKE_MODELS);
		});

		const select = screen.getByRole("combobox", { name: AI_MODEL_LABEL });
		expect(select).toBeInTheDocument();

		// Should contain options from the dynamic list
		const options = screen.getAllByRole("option");
		const optionValues = options.map((o) => o.getAttribute("value"));
		expect(optionValues).toContain("claude-sonnet-4.5");
		expect(optionValues).toContain("gpt-4o");

		// Should NOT contain hardcoded legacy values
		expect(optionValues).not.toContain("claude-sonnet-4");
	});

	it("shows stale warning badge when isStale is true", async () => {
		render(<ModelExecutionOptions onChange={noop} value={defaultOptions} />);

		await act(() => {
			dispatchModelsAvailable(FAKE_MODELS, true);
		});

		expect(screen.getByTestId("models-stale-warning")).toBeInTheDocument();
	});

	it("does not show stale warning when isStale is false", async () => {
		render(<ModelExecutionOptions onChange={noop} value={defaultOptions} />);

		await act(() => {
			dispatchModelsAvailable(FAKE_MODELS, false);
		});

		expect(
			screen.queryByTestId("models-stale-warning")
		).not.toBeInTheDocument();
	});

	it("shows error notice and disables selector when error is set", async () => {
		render(<ModelExecutionOptions onChange={noop} value={defaultOptions} />);

		await act(() => {
			dispatchModelsError("Failed to fetch models: API unavailable");
		});

		const select = screen.getByRole("combobox", { name: AI_MODEL_LABEL });
		expect(select).toBeDisabled();
		expect(screen.getByTestId("models-error-notice")).toBeInTheDocument();
	});

	it("disables selector when models list is empty (no error)", async () => {
		render(<ModelExecutionOptions onChange={noop} value={defaultOptions} />);

		await act(() => {
			dispatchModelsAvailable([]);
		});

		const select = screen.getByRole("combobox", { name: AI_MODEL_LABEL });
		expect(select).toBeDisabled();
	});

	it("passes through the disabled prop to disable the entire section", async () => {
		render(
			<ModelExecutionOptions disabled onChange={noop} value={defaultOptions} />
		);

		await act(() => {
			dispatchModelsAvailable(FAKE_MODELS);
		});

		const select = screen.getByRole("combobox", { name: AI_MODEL_LABEL });
		expect(select).toBeDisabled();
	});
});
