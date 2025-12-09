/**
 * Webview UI tests for Change Request Form (User Story 2).
 * Validates required fields, submission payload, and disabled state.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ChangeRequestForm from "../../../../webview-ui/src/components/spec-explorer/change-request-form";

const LABEL_TITLE = /Title/i;
const LABEL_DESCRIPTION = /Description/i;
const LABEL_SEVERITY = /Severity/i;
const BUTTON_SUBMIT = /Submit change request/i;
const BUTTON_CANCEL = /Cancel/i;
const ERROR_TITLE_REQUIRED = /Title is required/i;
const ERROR_DESCRIPTION_REQUIRED = /Description is required/i;
const ERROR_SEVERITY_REQUIRED = /Severity is required/i;
const ERROR_DUPLICATE_TITLE = /Duplicate change request title/i;
const TEXT_ADD_MFA = /Add MFA support/i;
const TEXT_FIX_TOKEN = /Fix token expiry/i;
const WARNING_SIMILAR_REQUEST = /similar change request already exists/i;

describe("Change Request Form (Webview)", () => {
	it("renders required fields", () => {
		render(
			<ChangeRequestForm onSubmit={vi.fn()} specTitle="API Authentication" />
		);

		expect(screen.getByLabelText(LABEL_TITLE)).toBeTruthy();
		expect(screen.getByLabelText(LABEL_DESCRIPTION)).toBeTruthy();
		expect(screen.getByLabelText(LABEL_SEVERITY)).toBeTruthy();
	});

	it("submits valid change request payload", () => {
		const onSubmit = vi.fn();
		render(
			<ChangeRequestForm onSubmit={onSubmit} specTitle="API Authentication" />
		);

		fireEvent.change(screen.getByLabelText(LABEL_TITLE), {
			target: { value: "Tighten auth" },
		});
		fireEvent.change(screen.getByLabelText(LABEL_DESCRIPTION), {
			target: { value: "Add MFA validation" },
		});
		fireEvent.change(screen.getByLabelText(LABEL_SEVERITY), {
			target: { value: "high" },
		});

		fireEvent.click(screen.getByRole("button", { name: BUTTON_SUBMIT }));

		expect(onSubmit).toHaveBeenCalledWith({
			title: "Tighten auth",
			description: "Add MFA validation",
			severity: "high",
		});
	});

	it("blocks submission when required fields are empty", () => {
		const onSubmit = vi.fn();
		render(
			<ChangeRequestForm onSubmit={onSubmit} specTitle="API Authentication" />
		);

		fireEvent.click(screen.getByRole("button", { name: BUTTON_SUBMIT }));

		expect(onSubmit).not.toHaveBeenCalled();
		expect(screen.getByText(ERROR_TITLE_REQUIRED)).toBeTruthy();
		expect(screen.getByText(ERROR_DESCRIPTION_REQUIRED)).toBeTruthy();
		expect(screen.getByText(ERROR_SEVERITY_REQUIRED)).toBeTruthy();
	});

	it("disables inputs while submitting", () => {
		const onSubmit = vi.fn();
		render(
			<ChangeRequestForm
				isSubmitting
				onSubmit={onSubmit}
				specTitle="API Authentication"
			/>
		);

		expect(screen.getByRole("button", { name: BUTTON_SUBMIT })).toBeDisabled();
		expect(screen.getByLabelText(LABEL_TITLE)).toBeDisabled();
		expect(screen.getByLabelText(LABEL_DESCRIPTION)).toBeDisabled();
		expect(screen.getByLabelText(LABEL_SEVERITY)).toBeDisabled();
	});

	it("displays submit error message when provided", () => {
		const onSubmit = vi.fn();
		render(
			<ChangeRequestForm
				onSubmit={onSubmit}
				specTitle="API Authentication"
				submitError="Duplicate change request title"
			/>
		);

		expect(screen.getByText(ERROR_DUPLICATE_TITLE)).toBeTruthy();
	});

	it("shows existing change requests for context", () => {
		const onSubmit = vi.fn();
		const existingChangeRequests = [
			{
				id: "cr-1",
				title: "Add MFA support",
				severity: "high" as const,
				status: "open" as const,
			},
			{
				id: "cr-2",
				title: "Fix token expiry",
				severity: "medium" as const,
				status: "inProgress" as const,
			},
		];

		render(
			<ChangeRequestForm
				existingChangeRequests={existingChangeRequests}
				onSubmit={onSubmit}
				specTitle="API Authentication"
			/>
		);

		expect(screen.getByText(TEXT_ADD_MFA)).toBeTruthy();
		expect(screen.getByText(TEXT_FIX_TOKEN)).toBeTruthy();
	});

	it("warns about potential duplicate when title matches existing", () => {
		const onSubmit = vi.fn();
		const existingChangeRequests = [
			{
				id: "cr-1",
				title: "Add MFA support",
				severity: "high" as const,
				status: "open" as const,
			},
		];

		render(
			<ChangeRequestForm
				existingChangeRequests={existingChangeRequests}
				onSubmit={onSubmit}
				specTitle="API Authentication"
			/>
		);

		fireEvent.change(screen.getByLabelText(LABEL_TITLE), {
			target: { value: "add mfa support" },
		});

		expect(screen.getByText(WARNING_SIMILAR_REQUEST)).toBeTruthy();
	});

	it("clears duplicate warning when title becomes unique", () => {
		const onSubmit = vi.fn();
		const existingChangeRequests = [
			{
				id: "cr-1",
				title: "Add MFA support",
				severity: "high" as const,
				status: "open" as const,
			},
		];

		render(
			<ChangeRequestForm
				existingChangeRequests={existingChangeRequests}
				onSubmit={onSubmit}
				specTitle="API Authentication"
			/>
		);

		const titleInput = screen.getByLabelText(LABEL_TITLE);

		fireEvent.change(titleInput, {
			target: { value: "add mfa support" },
		});

		expect(screen.getByText(WARNING_SIMILAR_REQUEST)).toBeTruthy();

		fireEvent.change(titleInput, {
			target: { value: "different issue" },
		});

		expect(screen.queryByText(WARNING_SIMILAR_REQUEST)).toBeNull();
	});

	it("does not warn about duplicates for addressed change requests", () => {
		const onSubmit = vi.fn();
		const existingChangeRequests = [
			{
				id: "cr-1",
				title: "Add MFA support",
				severity: "high" as const,
				status: "addressed" as const,
			},
		];

		render(
			<ChangeRequestForm
				existingChangeRequests={existingChangeRequests}
				onSubmit={onSubmit}
				specTitle="API Authentication"
			/>
		);

		fireEvent.change(screen.getByLabelText(LABEL_TITLE), {
			target: { value: "add mfa support" },
		});

		expect(screen.queryByText(WARNING_SIMILAR_REQUEST)).toBeNull();
	});

	it("populates form with default values", () => {
		const onSubmit = vi.fn();
		const defaultValues = {
			title: "Existing title",
			description: "Existing description",
			severity: "high" as const,
		};

		render(
			<ChangeRequestForm
				defaultValues={defaultValues}
				onSubmit={onSubmit}
				specTitle="API Authentication"
			/>
		);

		expect(screen.getByLabelText(LABEL_TITLE)).toHaveValue("Existing title");
		expect(screen.getByLabelText(LABEL_DESCRIPTION)).toHaveValue(
			"Existing description"
		);
		expect(screen.getByLabelText(LABEL_SEVERITY)).toHaveValue("high");
	});

	it("renders cancel button when onCancel is provided", () => {
		const onSubmit = vi.fn();
		const onCancel = vi.fn();

		render(
			<ChangeRequestForm
				onCancel={onCancel}
				onSubmit={onSubmit}
				specTitle="API Authentication"
			/>
		);

		const cancelButton = screen.getByRole("button", { name: BUTTON_CANCEL });
		expect(cancelButton).toBeTruthy();

		fireEvent.click(cancelButton);
		expect(onCancel).toHaveBeenCalled();
	});

	it("does not render cancel button when onCancel is not provided", () => {
		const onSubmit = vi.fn();

		render(
			<ChangeRequestForm onSubmit={onSubmit} specTitle="API Authentication" />
		);

		expect(screen.queryByRole("button", { name: BUTTON_CANCEL })).toBeNull();
	});
});
