/**
 * Change Request Form for Ready to Review specs.
 * Collects reviewer input (title, description, severity) and validates before submission.
 */

import type React from "react";
import { useState } from "react";
import type { ChangeRequestSeverity } from "../../../../src/features/spec/review-flow/types";

export interface ChangeRequestFormValues {
	title: string;
	description: string;
	severity: ChangeRequestSeverity;
	submitter?: string;
}

interface ChangeRequestFormProps {
	specTitle: string;
	onSubmit: (values: ChangeRequestFormValues) => void;
	onCancel?: () => void;
	isSubmitting?: boolean;
	submitError?: string;
	defaultValues?: Partial<ChangeRequestFormValues>;
}

const severityOptions: ChangeRequestSeverity[] = [
	"low",
	"medium",
	"high",
	"critical",
];

const ChangeRequestForm: React.FC<ChangeRequestFormProps> = ({
	specTitle,
	onSubmit,
	onCancel,
	isSubmitting = false,
	submitError,
	defaultValues,
}) => {
	const [title, setTitle] = useState(defaultValues?.title ?? "");
	const [description, setDescription] = useState(
		defaultValues?.description ?? ""
	);
	const [severity, setSeverity] = useState<ChangeRequestSeverity | "">(
		defaultValues?.severity ?? ""
	);

	const [errors, setErrors] = useState<{
		title?: string;
		description?: string;
		severity?: string;
	}>({});

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();

		const nextErrors: typeof errors = {};
		const trimmedTitle = title.trim();
		const trimmedDescription = description.trim();

		if (!trimmedTitle) {
			nextErrors.title = "Title is required";
		}
		if (!trimmedDescription) {
			nextErrors.description = "Description is required";
		}
		if (!severity) {
			nextErrors.severity = "Severity is required";
		}

		setErrors(nextErrors);

		if (Object.keys(nextErrors).length > 0) {
			return;
		}

		const confirmedSeverity = severity as ChangeRequestSeverity;

		onSubmit({
			title: trimmedTitle,
			description: trimmedDescription,
			severity: confirmedSeverity,
		});
	};

	return (
		<form className="change-request-form" onSubmit={handleSubmit}>
			<h3 className="form-title">File change request for {specTitle}</h3>

			<label className="form-field">
				<span>Title</span>
				<input
					aria-invalid={Boolean(errors.title)}
					disabled={isSubmitting}
					onChange={(e) => setTitle(e.target.value)}
					type="text"
					value={title}
				/>
				{errors.title && (
					<p className="form-error" role="alert">
						{errors.title}
					</p>
				)}
			</label>

			<label className="form-field">
				<span>Description</span>
				<textarea
					aria-invalid={Boolean(errors.description)}
					disabled={isSubmitting}
					onChange={(e) => setDescription(e.target.value)}
					value={description}
				/>
				{errors.description && (
					<p className="form-error" role="alert">
						{errors.description}
					</p>
				)}
			</label>

			<label className="form-field">
				<span>Severity</span>
				<select
					aria-invalid={Boolean(errors.severity)}
					disabled={isSubmitting}
					onChange={(e) =>
						setSeverity((e.target.value || "") as ChangeRequestSeverity | "")
					}
					value={severity}
				>
					<option value="">Select severity</option>
					{severityOptions.map((option) => (
						<option key={option} value={option}>
							{option}
						</option>
					))}
				</select>
				{errors.severity && (
					<p className="form-error" role="alert">
						{errors.severity}
					</p>
				)}
			</label>

			{submitError && (
				<p className="form-error" role="alert">
					{submitError}
				</p>
			)}

			<div className="form-actions">
				<button
					className="btn btn-primary"
					disabled={isSubmitting}
					type="submit"
				>
					Submit change request
				</button>
				{onCancel && (
					<button
						className="btn btn-secondary"
						disabled={isSubmitting}
						onClick={onCancel}
						type="button"
					>
						Cancel
					</button>
				)}
			</div>
		</form>
	);
};

export default ChangeRequestForm;
