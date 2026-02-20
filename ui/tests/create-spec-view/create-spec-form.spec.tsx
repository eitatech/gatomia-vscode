// biome-ignore-all lint/suspicious/noExplicitAny: test helpers need any
import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { MutableRefObject } from "react";

// We import via alias set up in vitest.config.ts

const PRODUCT_CONTEXT_RE = /Product Context/i;
const KEY_SCENARIOS_RE = /Key Scenarios/i;
const DESCRIPTION_LABEL_RE = /description/i;
const DESCRIBE_RE = /describe/i;
const IMPORT_FROM_FILE_RE = /import from file/i;
const REPLACE_WARNING_RE =
	/this will replace the existing content\. continue\?/i;
const REPLACE_BTN_RE = /replace/i;

const makeRef = <T,>(current: T | null = null): MutableRefObject<T | null> => ({
	current,
});

afterEach(() => {
	cleanup();
});

describe("CreateSpecForm (US1) — single textarea layout", () => {
	it("renders a single description textarea (not five fields)", async () => {
		const { CreateSpecForm } = await import(
			"@/features/create-spec-view/components/create-spec-form"
		);

		render(
			<CreateSpecForm
				attachments={[]}
				autosaveStatus="All changes saved"
				description=""
				descriptionRef={makeRef<HTMLTextAreaElement>()}
				fieldError={undefined}
				formId="test-form"
				isImporting={false}
				isSubmitting={false}
				onAttach={vi.fn()}
				onCancelImport={vi.fn()}
				onConfirmImport={vi.fn()}
				onDescriptionChange={vi.fn()}
				onImport={vi.fn()}
				onRemoveAttachment={vi.fn()}
				onSubmit={vi.fn()}
				pendingImportConfirm={false}
			/>
		);

		// Should have exactly one textarea
		const textareas = screen.getAllByRole("textbox");
		expect(textareas).toHaveLength(1);

		// Old fields must NOT exist
		expect(screen.queryByLabelText(PRODUCT_CONTEXT_RE)).toBeNull();
		expect(screen.queryByLabelText(KEY_SCENARIOS_RE)).toBeNull();
	});

	it("labels the single textarea as Description", async () => {
		const { CreateSpecForm } = await import(
			"@/features/create-spec-view/components/create-spec-form"
		);

		render(
			<CreateSpecForm
				attachments={[]}
				autosaveStatus="All changes saved"
				description="hello"
				descriptionRef={makeRef<HTMLTextAreaElement>()}
				fieldError={undefined}
				formId="test-form"
				isImporting={false}
				isSubmitting={false}
				onAttach={vi.fn()}
				onCancelImport={vi.fn()}
				onConfirmImport={vi.fn()}
				onDescriptionChange={vi.fn()}
				onImport={vi.fn()}
				onRemoveAttachment={vi.fn()}
				onSubmit={vi.fn()}
				pendingImportConfirm={false}
			/>
		);

		expect(
			screen.getByLabelText(DESCRIPTION_LABEL_RE) ||
				screen.getByRole("textbox", { name: DESCRIBE_RE })
		).toBeTruthy();
	});
});

describe("CreateSpecForm (US1) — submit blocked when empty", () => {
	it("shows field error when description is empty and form is submitted", async () => {
		const { CreateSpecForm } = await import(
			"@/features/create-spec-view/components/create-spec-form"
		);

		render(
			<CreateSpecForm
				attachments={[]}
				autosaveStatus=""
				description=""
				descriptionRef={makeRef<HTMLTextAreaElement>()}
				fieldError="Description is required."
				formId="test-form"
				isImporting={false}
				isSubmitting={false}
				onAttach={vi.fn()}
				onCancelImport={vi.fn()}
				onConfirmImport={vi.fn()}
				onDescriptionChange={vi.fn()}
				onImport={vi.fn()}
				onRemoveAttachment={vi.fn()}
				onSubmit={vi.fn()}
				pendingImportConfirm={false}
			/>
		);

		expect(screen.getByText("Description is required.")).toBeInTheDocument();
	});
});

describe("CreateSpecForm (US2) — import toolbar", () => {
	it('renders an "Import from file" button in the toolbar', async () => {
		const { CreateSpecForm } = await import(
			"@/features/create-spec-view/components/create-spec-form"
		);

		render(
			<CreateSpecForm
				attachments={[]}
				autosaveStatus=""
				description=""
				descriptionRef={makeRef<HTMLTextAreaElement>()}
				fieldError={undefined}
				formId="test-form"
				isImporting={false}
				isSubmitting={false}
				onAttach={vi.fn()}
				onCancelImport={vi.fn()}
				onConfirmImport={vi.fn()}
				onDescriptionChange={vi.fn()}
				onImport={vi.fn()}
				onRemoveAttachment={vi.fn()}
				onSubmit={vi.fn()}
				pendingImportConfirm={false}
			/>
		);

		const importBtn = screen.getByRole("button", { name: IMPORT_FROM_FILE_RE });
		expect(importBtn).toBeInTheDocument();
	});

	it("calls onImport when import button is clicked", async () => {
		const { CreateSpecForm } = await import(
			"@/features/create-spec-view/components/create-spec-form"
		);

		const onImport = vi.fn();
		const user = userEvent.setup();

		render(
			<CreateSpecForm
				attachments={[]}
				autosaveStatus=""
				description=""
				descriptionRef={makeRef<HTMLTextAreaElement>()}
				fieldError={undefined}
				formId="test-form"
				isImporting={false}
				isSubmitting={false}
				onAttach={vi.fn()}
				onCancelImport={vi.fn()}
				onConfirmImport={vi.fn()}
				onDescriptionChange={vi.fn()}
				onImport={onImport}
				onRemoveAttachment={vi.fn()}
				onSubmit={vi.fn()}
				pendingImportConfirm={false}
			/>
		);

		await user.click(screen.getByRole("button", { name: IMPORT_FROM_FILE_RE }));
		expect(onImport).toHaveBeenCalledTimes(1);
	});

	it("shows import confirmation banner when pendingImportConfirm is true", async () => {
		const { CreateSpecForm } = await import(
			"@/features/create-spec-view/components/create-spec-form"
		);

		render(
			<CreateSpecForm
				attachments={[]}
				autosaveStatus=""
				description="existing content"
				descriptionRef={makeRef<HTMLTextAreaElement>()}
				fieldError={undefined}
				formId="test-form"
				isImporting={false}
				isSubmitting={false}
				onAttach={vi.fn()}
				onCancelImport={vi.fn()}
				onConfirmImport={vi.fn()}
				onDescriptionChange={vi.fn()}
				onImport={vi.fn()}
				onRemoveAttachment={vi.fn()}
				onSubmit={vi.fn()}
				pendingImportConfirm={true}
			/>
		);

		expect(screen.getByText(REPLACE_WARNING_RE)).toBeInTheDocument();
	});

	it("calls onConfirmImport when Replace is clicked", async () => {
		const { CreateSpecForm } = await import(
			"@/features/create-spec-view/components/create-spec-form"
		);

		const onConfirmImport = vi.fn();
		const user = userEvent.setup();

		render(
			<CreateSpecForm
				attachments={[]}
				autosaveStatus=""
				description="existing content"
				descriptionRef={makeRef<HTMLTextAreaElement>()}
				fieldError={undefined}
				formId="test-form"
				isImporting={false}
				isSubmitting={false}
				onAttach={vi.fn()}
				onCancelImport={vi.fn()}
				onConfirmImport={onConfirmImport}
				onDescriptionChange={vi.fn()}
				onImport={vi.fn()}
				onRemoveAttachment={vi.fn()}
				onSubmit={vi.fn()}
				pendingImportConfirm={true}
			/>
		);

		await user.click(screen.getByRole("button", { name: REPLACE_BTN_RE }));
		expect(onConfirmImport).toHaveBeenCalledTimes(1);
	});
});
