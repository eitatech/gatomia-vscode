/**
 * ModeSelector tests (T053).
 * TDD: red before T061.
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ModeSelector } from "@/features/agent-chat/components/mode-selector";
import type { ModeDescriptor } from "@/features/agent-chat/types";

const MODE_LABEL_RE = /mode/i;

const MODES: ModeDescriptor[] = [
	{ id: "code", displayName: "Code" },
	{ id: "ask", displayName: "Ask" },
	{ id: "plan", displayName: "Plan" },
];

afterEach(() => {
	cleanup();
});

describe("ModeSelector", () => {
	it("renders one <option> per available mode", () => {
		render(
			<ModeSelector
				availableModes={MODES}
				onChange={vi.fn()}
				selectedModeId="code"
			/>
		);
		const select = screen.getByRole("combobox", { name: MODE_LABEL_RE });
		const options = select.querySelectorAll("option");
		expect(options).toHaveLength(MODES.length);
		expect(options[0].textContent).toBe("Code");
		expect(options[1].textContent).toBe("Ask");
		expect(options[2].textContent).toBe("Plan");
	});

	it("is hidden when there are zero modes (capabilities source = 'none')", () => {
		const { container } = render(
			<ModeSelector
				availableModes={[]}
				onChange={vi.fn()}
				selectedModeId={undefined}
			/>
		);
		expect(container.querySelector("select")).toBeNull();
	});

	it("marks the selected mode", () => {
		render(
			<ModeSelector
				availableModes={MODES}
				onChange={vi.fn()}
				selectedModeId="plan"
			/>
		);
		const select = screen.getByRole("combobox", { name: MODE_LABEL_RE });
		expect((select as HTMLSelectElement).value).toBe("plan");
	});

	it("invokes onChange with the new mode id when the user picks a different option", () => {
		const handleChange = vi.fn();
		render(
			<ModeSelector
				availableModes={MODES}
				onChange={handleChange}
				selectedModeId="code"
			/>
		);
		const select = screen.getByRole("combobox", { name: MODE_LABEL_RE });
		fireEvent.change(select, { target: { value: "ask" } });
		expect(handleChange).toHaveBeenCalledWith("ask");
	});
});
