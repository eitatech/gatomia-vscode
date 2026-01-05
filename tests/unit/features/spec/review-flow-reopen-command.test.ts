import { describe, it, expect, beforeEach, vi } from "vitest";
import { window } from "vscode";
import { handleReopenSpec } from "../../../../src/features/spec/review-flow/commands/reopen-spec-command";
import {
	getSpecState,
	updateSpecStatus,
} from "../../../../src/features/spec/review-flow/state";
import type { Specification } from "../../../../src/features/spec/review-flow/types";

vi.mock("../../../../src/features/spec/review-flow/state", () => ({
	getSpecState: vi.fn(),
	updateSpecStatus: vi.fn(),
}));

describe("Reopen Spec Command", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.spyOn(window, "showErrorMessage").mockResolvedValue(undefined);
		vi.spyOn(window, "showInformationMessage").mockResolvedValue(undefined);
	});

	it("shows not found error when spec does not exist", async () => {
		vi.mocked(getSpecState).mockReturnValue(null);

		await handleReopenSpec("missing-spec");

		expect(window.showErrorMessage).toHaveBeenCalledWith(
			"Spec not found. Please refresh and try again."
		);
	});

	it("blocks when spec is not in review", async () => {
		const spec: Specification = {
			id: "spec-1",
			title: "Spec",
			owner: "owner@example.com",
			status: "current",
			completedAt: null,
			reviewEnteredAt: null,
			archivedAt: null,
			updatedAt: new Date(),
			links: { specPath: "specs/spec-1/spec.md" },
			pendingTasks: 0,
			pendingChecklistItems: 0,
		};

		vi.mocked(getSpecState).mockReturnValue(spec);

		await handleReopenSpec(spec.id);

		expect(window.showErrorMessage).toHaveBeenCalledWith(
			"Cannot reopen: spec is not in review status."
		);
	});

	it("shows failure message when transition fails", async () => {
		const spec: Specification = {
			id: "spec-2",
			title: "Spec",
			owner: "owner@example.com",
			status: "review",
			completedAt: new Date(),
			reviewEnteredAt: new Date(),
			archivedAt: null,
			updatedAt: new Date(),
			links: { specPath: "specs/spec-2/spec.md" },
			pendingTasks: 0,
			pendingChecklistItems: 0,
		};

		vi.mocked(getSpecState).mockReturnValue(spec);
		vi.mocked(updateSpecStatus).mockReturnValue(null);

		await handleReopenSpec(spec.id);

		expect(window.showErrorMessage).toHaveBeenCalledWith(
			"Failed to reopen spec. Please try again."
		);
	});

	it("shows success message and refreshes", async () => {
		const spec: Specification = {
			id: "spec-3",
			title: "Reopen Me",
			owner: "owner@example.com",
			status: "review",
			completedAt: new Date(),
			reviewEnteredAt: new Date(),
			archivedAt: null,
			updatedAt: new Date(),
			links: { specPath: "specs/spec-3/spec.md" },
			pendingTasks: 0,
			pendingChecklistItems: 0,
		};

		vi.mocked(getSpecState).mockReturnValue(spec);
		vi.mocked(updateSpecStatus).mockReturnValue({
			...spec,
			status: "reopened",
		});

		const refresh = vi.fn();
		await handleReopenSpec(spec.id, refresh);

		expect(window.showInformationMessage).toHaveBeenCalledWith(
			'Spec "Reopen Me" reopened and moved to Current Specs.'
		);
		expect(refresh).toHaveBeenCalled();
	});

	it("accepts a Spec Explorer item argument", async () => {
		const spec: Specification = {
			id: "spec-4",
			title: "Reopen Me",
			owner: "owner@example.com",
			status: "review",
			completedAt: new Date(),
			reviewEnteredAt: new Date(),
			archivedAt: null,
			updatedAt: new Date(),
			links: { specPath: "specs/spec-4/spec.md" },
			pendingTasks: 0,
			pendingChecklistItems: 0,
		};

		vi.mocked(getSpecState).mockReturnValue(spec);
		vi.mocked(updateSpecStatus).mockReturnValue({
			...spec,
			status: "reopened",
		});

		const refresh = vi.fn();
		await handleReopenSpec({ specName: spec.id }, refresh);

		expect(updateSpecStatus).toHaveBeenCalledWith(spec.id, "reopened");
		expect(refresh).toHaveBeenCalled();
	});
});
