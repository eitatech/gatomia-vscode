import { useCallback } from "react";
import { useSyncExternalStore } from "react";
import { formStore } from "@/features/preview/stores/form-store";

export interface FormValidationState {
	validationErrors: Array<{ fieldId: string; message: string }>;
	hasErrors: boolean;
	hasDirtyFields: boolean;
	isSubmitting: boolean;
	readOnlyMode: boolean;
	readOnlyReason?: string;
	validateAll: () => boolean;
	lastSubmittedAt?: string;
}

/**
 * React hook that exposes form validation state derived from the shared formStore.
 * Centralizes error lookups so UI components can react consistently.
 */
export function useFormValidation(): FormValidationState {
	const snapshot = useSyncExternalStore(
		formStore.subscribe,
		formStore.getSnapshot
	);

	const validateAll = useCallback(() => formStore.validateAll(), []);

	return {
		validationErrors: snapshot.validationErrors,
		hasErrors: snapshot.validationErrors.length > 0,
		hasDirtyFields: formStore.hasDirtyFields(),
		isSubmitting: snapshot.isSubmitting,
		readOnlyMode: snapshot.readOnlyMode,
		readOnlyReason: snapshot.readOnlyReason,
		validateAll,
		lastSubmittedAt: snapshot.lastSubmittedAt,
	};
}
