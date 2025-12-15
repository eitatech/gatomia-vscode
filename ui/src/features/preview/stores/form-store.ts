/**
 * Form State Manager for Document Preview
 *
 * Manages form field state, validation, and persistence for interactive forms
 * embedded within preview documents. Follows the custom store pattern established
 * by preview-store.ts for consistency.
 *
 * Design Principles:
 * - Keep form interactions entirely client-side for responsive UX
 * - Track dirty state per field to enable selective persistence
 * - Validate before submission to prevent invalid data writes
 * - Sync deltas to extension via message passing only on explicit save
 * - Support read-only mode for restricted users
 *
 * Related: T019 [US2], data-model.md (FormField entity), contracts/preview.yaml
 */

export type FormFieldType =
	| "checkbox"
	| "dropdown"
	| "text"
	| "textarea"
	| "multiselect";

export interface FormField {
	fieldId: string;
	label: string;
	type: FormFieldType;
	options?: string[];
	required?: boolean;
	value?: string | string[]; // string[] for multiselect
	validationRules?: Record<string, unknown>;
	readOnly?: boolean;
}

export interface FormFieldState extends FormField {
	dirty: boolean;
	errors: string[];
}

export interface ValidationError {
	fieldId: string;
	message: string;
}

export interface FormStoreSnapshot {
	documentId?: string;
	sessionId?: string;
	fields: Map<string, FormFieldState>;
	isSubmitting: boolean;
	lastSubmittedAt?: string;
	validationErrors: ValidationError[];
	readOnlyMode: boolean;
	readOnlyReason?: string;
}

interface InitializeFieldsOptions {
	documentId: string;
	sessionId: string;
	fields: FormField[];
	readOnlyMode?: boolean;
	readOnlyReason?: string;
}

type Listener = () => void;

/**
 * FormStore - Manages form state for the preview webview
 *
 * Responsibilities:
 * - Initialize form fields from document payload
 * - Track field-level changes and dirty state
 * - Run validation rules before submission
 * - Prepare submission payloads for extension bridge
 * - Handle read-only enforcement
 */
class FormStore {
	private snapshot: FormStoreSnapshot = {
		fields: new Map(),
		isSubmitting: false,
		validationErrors: [],
		readOnlyMode: false,
	};
	private readonly listeners = new Set<Listener>();

	subscribe = (listener: Listener) => {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	};

	getSnapshot = (): FormStoreSnapshot => this.snapshot;

	/**
	 * Initialize form fields from document payload
	 * Called when preview loads a new document
	 */
	initializeFields(options: InitializeFieldsOptions) {
		const fieldMap = new Map<string, FormFieldState>();
		const {
			documentId,
			sessionId,
			fields,
			readOnlyMode = false,
			readOnlyReason,
		} = options;

		for (const field of fields) {
			fieldMap.set(field.fieldId, {
				...field,
				dirty: false,
				errors: [],
			});
		}

		this.snapshot = {
			documentId,
			sessionId,
			fields: fieldMap,
			isSubmitting: false,
			validationErrors: [],
			readOnlyMode,
			readOnlyReason,
		};

		this.emit();
	}

	/**
	 * Update a single field's value
	 * Marks field as dirty and triggers validation
	 */
	updateField(fieldId: string, value: string | string[]) {
		if (this.snapshot.readOnlyMode) {
			console.warn(
				`[FormStore] Cannot update field in read-only mode: ${fieldId}`
			);
			return;
		}

		const field = this.snapshot.fields.get(fieldId);
		if (!field) {
			console.warn(`[FormStore] Field not found: ${fieldId}`);
			return;
		}

		if (field.readOnly) {
			console.warn(`[FormStore] Field is read-only: ${fieldId}`);
			return;
		}

		// Update field state
		const updatedField: FormFieldState = {
			...field,
			value,
			dirty: true,
			errors: this.validateField({ ...field, value }),
		};

		const updatedFields = new Map(this.snapshot.fields);
		updatedFields.set(fieldId, updatedField);

		this.snapshot = {
			...this.snapshot,
			fields: updatedFields,
			validationErrors: this.getAllValidationErrors(updatedFields),
		};
		this.emit();
	}

	/**
	 * Validate a single field based on its rules
	 * Returns array of error messages
	 */
	private validateField(field: FormFieldState): string[] {
		const errors: string[] = [];

		if (field.required && this.isFieldValueEmpty(field)) {
			errors.push(`${field.label} is required`);
		}

		errors.push(...this.validateSelectionField(field));

		if (field.validationRules) {
			errors.push(...this.applyCustomValidations(field));
		}

		return errors;
	}

	private isFieldValueEmpty(field: FormFieldState): boolean {
		if (Array.isArray(field.value)) {
			return field.value.length === 0;
		}
		return field.value === undefined || field.value === "";
	}

	private validateSelectionField(field: FormFieldState): string[] {
		const errors: string[] = [];

		if (
			field.type === "dropdown" &&
			field.value &&
			field.options &&
			!field.options.includes(field.value as string)
		) {
			errors.push(`Invalid selection for ${field.label}`);
		}

		if (field.type === "multiselect" && field.value && field.options) {
			const values = Array.isArray(field.value) ? field.value : [field.value];
			const invalidValues = values.filter(
				(value) => !field.options!.includes(value)
			);
			if (invalidValues.length > 0) {
				errors.push(
					`Invalid selections for ${field.label}: ${invalidValues.join(", ")}`
				);
			}
		}

		return errors;
	}

	/**
	 * Apply custom validation rules defined in validationRules object
	 * This is extensible for future validation needs
	 */
	private applyCustomValidations(field: FormFieldState): string[] {
		const errors: string[] = [];
		const rules = field.validationRules || {};

		// Example: min/max length for text fields
		if (
			rules.minLength &&
			typeof field.value === "string" &&
			field.value.length < (rules.minLength as number)
		) {
			errors.push(
				`${field.label} must be at least ${rules.minLength} characters`
			);
		}

		if (
			rules.maxLength &&
			typeof field.value === "string" &&
			field.value.length > (rules.maxLength as number)
		) {
			errors.push(
				`${field.label} must not exceed ${rules.maxLength} characters`
			);
		}

		// Example: pattern matching (regex)
		if (rules.pattern && typeof field.value === "string") {
			const regex = new RegExp(rules.pattern as string);
			if (!regex.test(field.value)) {
				errors.push(
					rules.patternMessage
						? (rules.patternMessage as string)
						: `${field.label} format is invalid`
				);
			}
		}

		return errors;
	}

	/**
	 * Collect all validation errors across all fields
	 */
	private getAllValidationErrors(
		fields: Map<string, FormFieldState> = this.snapshot.fields
	): ValidationError[] {
		const errors: ValidationError[] = [];

		for (const [fieldId, field] of fields) {
			if (field.errors.length > 0) {
				errors.push(
					...field.errors.map((message) => ({
						fieldId,
						message,
					}))
				);
			}
		}

		return errors;
	}

	/**
	 * Validate all fields and return whether form is valid
	 */
	validateAll(): boolean {
		const updatedFields = new Map<string, FormFieldState>();

		for (const [fieldId, field] of this.snapshot.fields) {
			updatedFields.set(fieldId, {
				...field,
				errors: this.validateField(field),
			});
		}

		this.snapshot = {
			...this.snapshot,
			fields: updatedFields,
			validationErrors: this.getAllValidationErrors(updatedFields),
		};
		this.emit();

		return this.snapshot.validationErrors.length === 0;
	}

	/**
	 * Get dirty fields ready for submission
	 * Returns only fields that have been modified
	 */
	getDirtyFields(): Array<{
		fieldId: string;
		value: string | string[];
		dirty: boolean;
	}> {
		const dirtyFields: Array<{
			fieldId: string;
			value: string | string[];
			dirty: boolean;
		}> = [];

		for (const [fieldId, field] of this.snapshot.fields) {
			if (field.dirty && field.value !== undefined) {
				dirtyFields.push({
					fieldId,
					value: field.value,
					dirty: true,
				});
			}
		}

		return dirtyFields;
	}

	/**
	 * Prepare submission payload for extension bridge
	 * Validates all fields and returns payload if valid
	 */
	prepareSubmission(): {
		documentId: string;
		sessionId: string;
		fields: Array<{
			fieldId: string;
			value: string | string[];
			dirty: boolean;
		}>;
		submittedAt: string;
	} | null {
		if (!(this.snapshot.documentId && this.snapshot.sessionId)) {
			console.error(
				"[FormStore] Cannot submit: missing document or session ID"
			);
			return null;
		}

		if (this.snapshot.readOnlyMode) {
			console.error("[FormStore] Cannot submit in read-only mode");
			return null;
		}

		if (!this.validateAll()) {
			console.error(
				"[FormStore] Validation failed",
				this.snapshot.validationErrors
			);
			return null;
		}

		const dirtyFields = this.getDirtyFields();

		if (dirtyFields.length === 0) {
			console.warn("[FormStore] No dirty fields to submit");
			return null;
		}

		return {
			documentId: this.snapshot.documentId,
			sessionId: this.snapshot.sessionId,
			fields: dirtyFields,
			submittedAt: new Date().toISOString(),
		};
	}

	/**
	 * Mark submission as in progress
	 * Used to disable form during async submission
	 */
	setSubmitting(isSubmitting: boolean) {
		this.snapshot = {
			...this.snapshot,
			isSubmitting,
		};
		this.emit();
	}

	/**
	 * Mark submission as successful and clear dirty flags
	 */
	markSubmitted() {
		const updatedFields = new Map<string, FormFieldState>();

		for (const [fieldId, field] of this.snapshot.fields) {
			updatedFields.set(fieldId, {
				...field,
				dirty: false,
			});
		}

		this.snapshot = {
			...this.snapshot,
			fields: updatedFields,
			isSubmitting: false,
			lastSubmittedAt: new Date().toISOString(),
		};

		this.emit();
	}

	/**
	 * Discard all pending changes and revert to original values
	 * Called when user cancels edits or preview becomes stale
	 */
	discardChanges() {
		// Note: This requires storing original values, which we'll add if needed
		// For now, just clear dirty flags and errors
		const updatedFields = new Map<string, FormFieldState>();

		for (const [fieldId, field] of this.snapshot.fields) {
			updatedFields.set(fieldId, {
				...field,
				dirty: false,
				errors: [],
			});
		}

		this.snapshot = {
			...this.snapshot,
			fields: updatedFields,
			validationErrors: [],
			isSubmitting: false,
		};

		this.emit();
	}

	/**
	 * Check if form has any unsaved changes
	 */
	hasDirtyFields(): boolean {
		for (const field of this.snapshot.fields.values()) {
			if (field.dirty) {
				return true;
			}
		}
		return false;
	}

	/**
	 * Reset the entire form state
	 * Called when preview closes or loads a new document
	 */
	reset() {
		this.snapshot = {
			fields: new Map(),
			isSubmitting: false,
			validationErrors: [],
			readOnlyMode: false,
			readOnlyReason: undefined,
		};
		this.emit();
	}

	/**
	 * Enable or disable read-only mode
	 */
	setReadOnlyMode(readOnly: boolean, reason?: string) {
		this.snapshot = {
			...this.snapshot,
			readOnlyMode: readOnly,
			readOnlyReason: reason,
		};
		this.emit();
	}

	private emit() {
		for (const listener of this.listeners) {
			listener();
		}
	}
}

/**
 * Singleton instance exported for use throughout the preview webview
 */
export const formStore = new FormStore();
