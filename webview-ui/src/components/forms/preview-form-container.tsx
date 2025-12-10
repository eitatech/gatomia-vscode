/**
 * PreviewFormContainer Example
 *
 * Example component demonstrating how to use PreviewFormField and PreviewFormActions
 * together in a document preview context.
 *
 * This serves as both documentation and a reference implementation for T020.
 */

import { PreviewFormField } from "./preview-form-field";
import { PreviewFormActions } from "./preview-form-actions";
import { formStore } from "@/features/preview/stores/form-store";
import type { FormField } from "@/features/preview/stores/form-store";
import { useCallback, useLayoutEffect } from "react";

interface PreviewFormContainerProps {
	documentId: string;
	sessionId: string;
	fields: FormField[];
	readOnly?: boolean;
	readOnlyReason?: string;
	onSubmit?: (payload: {
		documentId: string;
		sessionId: string;
		fields: Array<{
			fieldId: string;
			value: string | string[];
			dirty: boolean;
		}>;
		submittedAt: string;
	}) => void | Promise<void>;
	onCancel?: () => void;
}

/**
 * Example container showing complete form integration
 *
 * Usage in PreviewApp:
 * ```tsx
 * <PreviewFormContainer
 *   documentId={document.documentId}
 *   sessionId={sessionId}
 *   fields={document.forms}
 *   readOnly={!hasEditPermission}
 *   onSubmit={handleFormSubmit}
 * />
 * ```
 */
export function PreviewFormContainer({
	documentId,
	sessionId,
	fields,
	readOnly = false,
	readOnlyReason,
	onSubmit,
	onCancel,
}: PreviewFormContainerProps) {
	// Initialize form store when component mounts or data changes
	useLayoutEffect(() => {
		formStore.initializeFields({
			documentId,
			sessionId,
			fields,
			readOnlyMode: readOnly,
			readOnlyReason,
		});

		// Cleanup on unmount
		return () => {
			formStore.reset();
		};
	}, [documentId, sessionId, fields, readOnly, readOnlyReason]);

	const handleSubmit = useCallback(async () => {
		const payload = formStore.prepareSubmission();

		if (!payload) {
			console.warn("[PreviewFormContainer] No valid submission payload");
			return;
		}

		try {
			await onSubmit?.(payload);
			formStore.markSubmitted();
		} catch (error) {
			console.error("[PreviewFormContainer] Submission failed", error);
			throw error;
		}
	}, [onSubmit]);

	if (fields.length === 0) {
		return null;
	}

	return (
		<section className="flex flex-col gap-6 rounded border border-[color:var(--vscode-input-border,#3c3c3c)] bg-[color:var(--vscode-editor-background)] px-5 py-4">
			<h3 className="font-semibold text-[color:var(--vscode-foreground)] text-base">
				Interactive Fields
			</h3>

			<div className="flex flex-col gap-4">
				{readOnly && readOnlyReason && (
					<p
						className="rounded border border-[color:var(--vscode-inputValidation-warningBorder,#e5c07b)] bg-[color:var(--vscode-inputValidation-warningBackground,#3b3222)] px-3 py-2 text-[color:var(--vscode-descriptionForeground)] text-xs"
						role="alert"
					>
						{readOnlyReason}
					</p>
				)}

				{fields.map((field) => {
					// Type-safe field rendering based on field type
					switch (field.type) {
						case "text":
							return (
								<PreviewFormField
									fieldId={field.fieldId}
									key={field.fieldId}
									label={field.label}
									placeholder={`Enter ${field.label.toLowerCase()}...`}
									required={field.required}
									type="text"
								/>
							);
						case "textarea":
							return (
								<PreviewFormField
									fieldId={field.fieldId}
									key={field.fieldId}
									label={field.label}
									placeholder={`Enter ${field.label.toLowerCase()}...`}
									required={field.required}
									rows={4}
									type="textarea"
								/>
							);
						case "checkbox":
							return (
								<PreviewFormField
									fieldId={field.fieldId}
									key={field.fieldId}
									label={field.label}
									required={field.required}
									type="checkbox"
								/>
							);
						case "dropdown":
							return (
								<PreviewFormField
									fieldId={field.fieldId}
									key={field.fieldId}
									label={field.label}
									options={field.options || []}
									placeholder="Select an option..."
									required={field.required}
									type="dropdown"
								/>
							);
						case "multiselect":
							return (
								<PreviewFormField
									fieldId={field.fieldId}
									key={field.fieldId}
									label={field.label}
									options={field.options || []}
									required={field.required}
									type="multiselect"
								/>
							);
						default:
							return null;
					}
				})}
			</div>

			<PreviewFormActions
				cancelLabel="Discard Changes"
				onCancel={onCancel}
				onSubmit={handleSubmit}
				showStatus
				submitLabel="Save Changes"
			/>
		</section>
	);
}
