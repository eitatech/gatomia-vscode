/**
 * Change Request Form for Ready to Review specs.
 * Collects reviewer input (title, description, severity) and validates before submission.
 */

import type React from "react";
import { useState, useEffect } from "react";
import type {
	ChangeRequestSeverity,
	ChangeRequestStatus,
} from "../../../../src/features/spec/review-flow/types";

export interface ChangeRequestFormValues {
	title: string;
	description: string;
	severity: ChangeRequestSeverity;
	submitter?: string;
}

export interface ExistingChangeRequest {
	id: string;
	title: string;
	severity: ChangeRequestSeverity;
	status: ChangeRequestStatus;
}

interface ChangeRequestFormProps {
	specTitle: string;
	onSubmit: (values: ChangeRequestFormValues) => void;
	onCancel?: () => void;
	isSubmitting?: boolean;
	submitError?: string;
	defaultValues?: Partial<ChangeRequestFormValues>;
	existingChangeRequests?: ExistingChangeRequest[];
}

const severityOptions: ChangeRequestSeverity[] = [
	"low",
	"medium",
	"high",
	"critical",
];

const normalizeTitle = (title: string): string =>
	title.toLowerCase().trim().replace(/\s+/g, " ");

const ChangeRequestForm: React.FC<ChangeRequestFormProps> = ({
	specTitle,
	onSubmit,
	onCancel,
	isSubmitting = false,
	submitError,
	defaultValues,
	existingChangeRequests = [],
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

	const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);

	const activeChangeRequests = existingChangeRequests.filter(
		(cr) => cr.status !== "addressed"
	);

	useEffect(() => {
		const trimmedTitle = title.trim();
		if (!trimmedTitle) {
			setDuplicateWarning(null);
			return;
		}

		const normalizedTitle = normalizeTitle(trimmedTitle);
		const duplicate = activeChangeRequests.find(
			(cr) => normalizeTitle(cr.title) === normalizedTitle
		);

		if (duplicate) {
			setDuplicateWarning(
				`A similar change request already exists: "${duplicate.title}"`
			);
		} else {
			setDuplicateWarning(null);
		}
	}, [title, activeChangeRequests]);

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

			{activeChangeRequests.length > 0 && (
				<div className="existing-change-requests">
					<h4>Existing Change Requests:</h4>
					<ul>
						{activeChangeRequests.map((cr) => (
							<li key={cr.id}>
								<strong>{cr.title}</strong> - {cr.severity} ({cr.status})
							</li>
						))}
					</ul>
				</div>
			)}

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
				{duplicateWarning && (
					<p className="form-warning" role="alert">
						{duplicateWarning}
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
