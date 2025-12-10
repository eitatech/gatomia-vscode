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
const ERROR_TITLE_REQUIRED = /Title is required/i;
const ERROR_DESCRIPTION_REQUIRED = /Description is required/i;
const ERROR_SEVERITY_REQUIRED = /Severity is required/i;

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
});
