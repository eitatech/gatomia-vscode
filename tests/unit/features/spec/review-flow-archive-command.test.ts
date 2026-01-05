import { describe, it, expect, beforeEach, vi } from "vitest";
import { window } from "vscode";
import {
	handleSendToArchived,
	handleUnarchive,
} from "../../../../src/features/spec/review-flow/commands/send-to-archived-command";
import {
	archiveSpec,
	canArchive,
	getSpecState,
	unarchiveSpec,
} from "../../../../src/features/spec/review-flow/state";
import type { Specification } from "../../../../src/features/spec/review-flow/types";

vi.mock("../../../../src/features/spec/review-flow/state", () => ({
	archiveSpec: vi.fn(),
	unarchiveSpec: vi.fn(),
	canArchive: vi.fn(),
	getSpecState: vi.fn(),
}));

describe("Archive/Unarchive Commands", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.spyOn(window, "showErrorMessage").mockResolvedValue(undefined);
		vi.spyOn(window, "showInformationMessage").mockResolvedValue(undefined);
	});

	it("archives when invoked with a Spec Explorer item argument", async () => {
		const spec: Specification = {
			id: "spec-arch-1",
			title: "Archive Me",
			owner: "owner@example.com",
			status: "review",
			completedAt: new Date(),
			reviewEnteredAt: new Date(),
			archivedAt: null,
			updatedAt: new Date(),
			links: { specPath: "specs/spec-arch-1/spec.md" },
			pendingTasks: 0,
			pendingChecklistItems: 0,
			changeRequests: [],
		};

		vi.mocked(getSpecState).mockReturnValue(spec);
		vi.mocked(canArchive).mockReturnValue(true);
		vi.mocked(archiveSpec).mockReturnValue({
			...spec,
			status: "archived",
			archivedAt: new Date(),
		});

		const refresh = vi.fn();
		await handleSendToArchived({ specName: spec.id }, refresh);

		expect(canArchive).toHaveBeenCalledWith(spec.id);
		expect(archiveSpec).toHaveBeenCalledWith(spec.id);
		expect(refresh).toHaveBeenCalled();
	});

	it("unarchives when invoked with a Spec Explorer item argument", async () => {
		const spec: Specification = {
			id: "spec-unarch-1",
			title: "Unarchive Me",
			owner: "owner@example.com",
			status: "archived",
			completedAt: new Date(),
			reviewEnteredAt: new Date(),
			archivedAt: new Date(),
			updatedAt: new Date(),
			links: { specPath: "specs/spec-unarch-1/spec.md" },
			pendingTasks: 0,
			pendingChecklistItems: 0,
			changeRequests: [],
		};

		vi.mocked(getSpecState).mockReturnValue(spec);
		vi.mocked(unarchiveSpec).mockReturnValue({
			...spec,
			status: "reopened",
			archivedAt: null,
		});

		const refresh = vi.fn();
		await handleUnarchive({ specName: spec.id }, refresh);

		expect(unarchiveSpec).toHaveBeenCalledWith(spec.id, undefined);
		expect(refresh).toHaveBeenCalled();
	});

	it("shows not found when spec id cannot be resolved", async () => {
		await handleSendToArchived({});
		expect(window.showErrorMessage).toHaveBeenCalledWith(
			"Cannot archive spec: Spec not found"
		);
	});
});
