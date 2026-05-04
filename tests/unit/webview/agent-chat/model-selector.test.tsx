/**
 * ModelSelector tests (T053).
 * TDD: red before T062.
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ModelSelector } from "@/features/agent-chat/components/model-selector";
import type { ModelDescriptor } from "@/features/agent-chat/types";

const MODEL_LABEL_RE = /model/i;

const MODELS: ModelDescriptor[] = [
	{ id: "sonnet", displayName: "Claude Sonnet", invocation: "cli-flag" },
	{ id: "opus", displayName: "Claude Opus", invocation: "cli-flag" },
];

afterEach(() => {
	cleanup();
});

describe("ModelSelector", () => {
	it("renders one <option> per available model", () => {
		render(
			<ModelSelector
				availableModels={MODELS}
				onChange={vi.fn()}
				selectedModelId="sonnet"
			/>
		);
		const select = screen.getByRole("combobox", { name: MODEL_LABEL_RE });
		expect(select.querySelectorAll("option")).toHaveLength(MODELS.length);
	});

	it("is hidden when there are zero models", () => {
		const { container } = render(
			<ModelSelector
				availableModels={[]}
				onChange={vi.fn()}
				selectedModelId={undefined}
			/>
		);
		expect(container.querySelector("select")).toBeNull();
	});

	it("invokes onChange with the new model id", () => {
		const handleChange = vi.fn();
		render(
			<ModelSelector
				availableModels={MODELS}
				onChange={handleChange}
				selectedModelId="sonnet"
			/>
		);
		const select = screen.getByRole("combobox", { name: MODEL_LABEL_RE });
		fireEvent.change(select, { target: { value: "opus" } });
		expect(handleChange).toHaveBeenCalledWith("opus");
	});
});
