/**
 * PreviewFormActions Component
 *
 * Action buttons and status display for preview form submissions.
 * Handles validation, dirty state tracking, and submission feedback.
 *
 * Related: T020 [US2], preview-form-field.tsx, form-store.ts
 */

import { Button } from "@/components/ui/button";
import { formStore } from "@/features/preview/stores/form-store";
import { useFormValidation } from "@/features/preview/hooks/use-form-validation";
import { useCallback } from "react";
import { cn } from "@/lib/utils";

interface PreviewFormActionsProps {
	onSubmit?: () => void | Promise<void>;
	onCancel?: () => void;
	submitLabel?: string;
	cancelLabel?: string;
	showStatus?: boolean;
	className?: string;
}

/**
 * Form action buttons with built-in state management
 * Displays save/cancel buttons and form status
 */
export function PreviewFormActions({
	onSubmit,
	onCancel,
	submitLabel = "Save Changes",
	cancelLabel = "Discard",
	showStatus = true,
	className,
}: PreviewFormActionsProps) {
	const {
		validationErrors,
		hasErrors,
		hasDirtyFields,
		isSubmitting,
		readOnlyMode,
		readOnlyReason,
		validateAll,
		lastSubmittedAt,
	} = useFormValidation();

	const handleSubmit = useCallback(async () => {
		if (!onSubmit || readOnlyMode || isSubmitting) {
			return;
		}

		// Validate before submission
		const isValid = validateAll();
		if (!isValid) {
			console.warn("[PreviewFormActions] Validation failed", validationErrors);
			return;
		}

		formStore.setSubmitting(true);

		try {
			await onSubmit();
		} catch (error) {
			console.error("[PreviewFormActions] Submission error", error);
			formStore.setSubmitting(false);
		}
	}, [onSubmit, readOnlyMode, isSubmitting, validationErrors, validateAll]);

	const handleCancel = useCallback(() => {
		if (readOnlyMode || isSubmitting) {
			return;
		}

		formStore.discardChanges();
		onCancel?.();
	}, [onCancel, readOnlyMode, isSubmitting]);

	if (readOnlyMode) {
		return (
			<div
				className={cn(
					"flex items-center justify-between gap-3 border-[color:color-mix(in_srgb,var(--vscode-foreground)_12%,transparent)] border-t pt-4",
					className
				)}
			>
				<span className="text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.6))] text-xs">
					{readOnlyReason ?? "Read-only mode"}
				</span>
			</div>
		);
	}

	return (
		<div
			className={cn(
				"flex flex-col gap-3 border-[color:color-mix(in_srgb,var(--vscode-foreground)_12%,transparent)] border-t pt-4",
				className
			)}
		>
			{showStatus && (
				<div className="flex flex-wrap items-center justify-between gap-3 text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.6))] text-xs">
					<FormStatus
						hasDirtyFields={hasDirtyFields}
						hasErrors={hasErrors}
						isSubmitting={isSubmitting}
						lastSubmittedAt={lastSubmittedAt}
					/>
				</div>
			)}

			{hasDirtyFields && (
				<div className="flex flex-wrap gap-2">
					<Button
						disabled={isSubmitting || hasErrors}
						onClick={handleSubmit}
						size="sm"
						variant="default"
					>
						{isSubmitting ? "Saving..." : submitLabel}
					</Button>
					<Button
						disabled={isSubmitting}
						onClick={handleCancel}
						size="sm"
						variant="outline"
					>
						{cancelLabel}
					</Button>
				</div>
			)}

			{hasErrors && <ValidationErrorSummary errors={validationErrors} />}
		</div>
	);
}

/**
 * Form status indicator
 */
function FormStatus({
	hasDirtyFields,
	hasErrors,
	isSubmitting,
	lastSubmittedAt,
}: {
	hasDirtyFields: boolean;
	hasErrors: boolean;
	isSubmitting: boolean;
	lastSubmittedAt?: string;
}) {
	if (isSubmitting) {
		return <span>Saving changes...</span>;
	}

	if (hasErrors) {
		return (
			<span className="text-[color:var(--vscode-errorForeground)]">
				Please fix validation errors
			</span>
		);
	}

	if (hasDirtyFields) {
		return <span>Unsaved changes</span>;
	}

	if (lastSubmittedAt) {
		const timestamp = new Date(lastSubmittedAt);
		const timeStr = timestamp.toLocaleTimeString(undefined, {
			hour: "2-digit",
			minute: "2-digit",
		});
		return <span>Last saved at {timeStr}</span>;
	}

	return <span>No changes</span>;
}

/**
 * Validation error summary
 */
function ValidationErrorSummary({
	errors,
}: {
	errors: Array<{ fieldId: string; message: string }>;
}) {
	if (errors.length === 0) {
		return null;
	}

	return (
		<div className="rounded border border-[color:var(--vscode-inputValidation-errorBorder,#be1100)] bg-[color:var(--vscode-inputValidation-errorBackground,#5a1d1d)] px-3 py-2">
			<div className="flex flex-col gap-1 text-[color:var(--vscode-errorForeground)] text-xs">
				<strong>Validation errors:</strong>
				<ul className="ml-4 list-disc">
					{errors.map((error, idx) => (
						<li key={`${error.fieldId}-${idx}`}>{error.message}</li>
					))}
				</ul>
			</div>
		</div>
	);
}
