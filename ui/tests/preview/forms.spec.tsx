import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PreviewFormContainer } from "@/components/forms/preview-form-container";
import { formStore } from "@/features/preview/stores/form-store";

const TITLE_LABEL_REGEX = /Title/i;
const SAVE_CHANGES_REGEX = /save changes/i;
const READ_ONLY_REGEX = /Read-only/i;
const READ_ONLY_REASON_REGEX = /Edits restricted by owner/i;

const sampleFields = [
	{
		fieldId: "title",
		label: "Title",
		type: "text" as const,
		required: true,
	},
];

describe("Preview form container", () => {
	beforeEach(() => {
		formStore.reset();
	});

	afterEach(() => {
		cleanup();
		formStore.reset();
	});

	it("submits dirty fields with validation", async () => {
		const onSubmit = vi.fn().mockResolvedValue(undefined);
		const user = userEvent.setup();

		render(
			<PreviewFormContainer
				documentId="doc-1"
				fields={sampleFields}
				onSubmit={onSubmit}
				sessionId="session-1"
			/>
		);

		const input = await screen.findByLabelText(TITLE_LABEL_REGEX);
		await user.type(input, "Updated title");

		await waitFor(() => {
			expect(formStore.hasDirtyFields()).toBe(true);
		});

		await waitFor(() => {
			expect(
				screen.getByRole("button", { name: SAVE_CHANGES_REGEX })
			).toBeInTheDocument();
		});
		const saveButton = screen.getByRole("button", { name: SAVE_CHANGES_REGEX });
		await user.click(saveButton);

		await waitFor(() => {
			expect(onSubmit).toHaveBeenCalledWith(
				expect.objectContaining({
					documentId: "doc-1",
					sessionId: "session-1",
					fields: [
						{
							fieldId: "title",
							value: "Updated title",
							dirty: true,
						},
					],
				})
			);
		});
	});

	it("renders fields as read-only when permissions restrict edits", async () => {
		render(
			<PreviewFormContainer
				documentId="doc-2"
				fields={sampleFields}
				readOnly
				readOnlyReason="Edits restricted by owner"
				sessionId="session-2"
			/>
		);

		const input = (await screen.findByLabelText(
			TITLE_LABEL_REGEX
		)) as HTMLInputElement;
		expect(input).toBeDisabled();
		expect(screen.getByText(READ_ONLY_REGEX)).toBeInTheDocument();
		const warnings = screen.getAllByText(READ_ONLY_REASON_REGEX);
		expect(warnings.length).toBeGreaterThan(0);
	});
});
