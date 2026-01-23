/**
 * PreviewFormField Components
 *
 * Reusable form field components for interactive forms embedded in document previews.
 * Connects to formStore for state management, validation, and persistence.
 *
 * Supports field types: checkbox, dropdown, text, textarea, multiselect
 *
 * Design Principles:
 * - Follow VS Code webview theming conventions
 * - Display validation errors inline
 * - Respect read-only mode from formStore
 * - Accessible with proper ARIA attributes
 * - Consistent with existing TextareaPanel and form patterns
 *
 * Related: T020 [US2], form-store.ts, data-model.md (FormField entity)
 */

import { cn } from "@/lib/utils";
import type { ChangeEvent } from "react";
import { useCallback, useSyncExternalStore } from "react";
import { formStore } from "@/features/preview/stores/form-store";

const normalizeMultiValue = (
	input: string | string[] | undefined
): string[] => {
	if (Array.isArray(input)) {
		return input;
	}
	if (typeof input === "string" && input.trim().length > 0) {
		return input.split(",").map((value) => value.trim());
	}
	return [];
};

interface BaseFormFieldProps {
	fieldId: string;
	label: string;
	required?: boolean;
	className?: string;
	containerClassName?: string;
}

interface TextFieldProps extends BaseFormFieldProps {
	type: "text";
	placeholder?: string;
}

interface TextareaFieldProps extends BaseFormFieldProps {
	type: "textarea";
	placeholder?: string;
	rows?: number;
}

interface CheckboxFieldProps extends BaseFormFieldProps {
	type: "checkbox";
}

interface DropdownFieldProps extends BaseFormFieldProps {
	type: "dropdown";
	options: string[];
	placeholder?: string;
}

interface MultiselectFieldProps extends BaseFormFieldProps {
	type: "multiselect";
	options: string[];
}

export type PreviewFormFieldProps =
	| TextFieldProps
	| TextareaFieldProps
	| CheckboxFieldProps
	| DropdownFieldProps
	| MultiselectFieldProps;

/**
 * Main PreviewFormField component
 * Renders the appropriate field type based on props
 */
export function PreviewFormField(props: PreviewFormFieldProps) {
	switch (props.type) {
		case "text":
			return <TextField {...props} />;
		case "textarea":
			return <TextareaField {...props} />;
		case "checkbox":
			return <CheckboxField {...props} />;
		case "dropdown":
			return <DropdownField {...props} />;
		case "multiselect":
			return <MultiselectField {...props} />;
		default:
			// @ts-expect-error - exhaustive check
			console.warn(`[PreviewFormField] Unsupported field type: ${props.type}`);
			return null;
	}
}

/**
 * Hook to sync field state from formStore
 */
function useFormField(fieldId: string) {
	const snapshot = useSyncExternalStore(
		formStore.subscribe,
		formStore.getSnapshot
	);

	const field = snapshot.fields.get(fieldId);
	const readOnly = snapshot.readOnlyMode || field?.readOnly;
	const disabled = snapshot.isSubmitting || readOnly;

	return {
		field,
		readOnly,
		disabled,
		value: field?.value ?? "",
		errors: field?.errors ?? [],
		hasError: (field?.errors.length ?? 0) > 0,
	};
}

/**
 * Text input field component
 */
function TextField({
	fieldId,
	label,
	required,
	placeholder,
	className,
	containerClassName,
}: TextFieldProps) {
	const { field, disabled, value, errors, hasError, readOnly } =
		useFormField(fieldId);

	const handleChange = useCallback(
		(e: ChangeEvent<HTMLInputElement>) => {
			formStore.updateField(fieldId, e.target.value);
		},
		[fieldId]
	);

	if (!field) {
		return null;
	}

	const helperId = `${fieldId}-helper`;

	return (
		<div className={cn("flex flex-col gap-2", containerClassName)}>
			<label
				className="font-medium text-[color:var(--vscode-foreground)] text-sm"
				htmlFor={fieldId}
			>
				{label}
				{required && (
					<span className="text-[color:var(--vscode-errorForeground)]"> *</span>
				)}
				{readOnly && (
					<span className="ml-2 rounded border border-[color:var(--vscode-contrastActiveBorder,rgba(255,255,255,0.4))] px-1 py-0.5 text-[10px] text-[color:var(--vscode-descriptionForeground)] uppercase tracking-wide">
						Read-only
					</span>
				)}
			</label>
			<input
				aria-describedby={hasError ? helperId : undefined}
				aria-invalid={hasError || undefined}
				aria-readonly={readOnly || undefined}
				aria-required={required}
				className={cn(
					"rounded border bg-[color:var(--vscode-input-background)] px-3 py-2 text-[color:var(--vscode-input-foreground)] text-sm outline-none ring-0 transition-all",
					"border-[color:var(--vscode-input-border,#3c3c3c)]",
					"placeholder:text-[color:var(--vscode-input-placeholderForeground,#888)]",
					"focus:border-[color:var(--vscode-focusBorder,#007acc)] focus:ring-2 focus:ring-[color:var(--vscode-focusBorder,#007acc)]/20",
					hasError &&
						"border-[color:var(--vscode-inputValidation-errorBorder,#be1100)] ring-2 ring-[color:var(--vscode-inputValidation-errorBorder,#be1100)]/20",
					disabled && "cursor-not-allowed opacity-50",
					className
				)}
				disabled={disabled}
				id={fieldId}
				onChange={handleChange}
				placeholder={placeholder}
				required={required}
				type="text"
				value={value as string}
			/>
			{hasError && (
				<div
					className="text-[color:var(--vscode-errorForeground)] text-xs"
					id={helperId}
				>
					{errors.join(", ")}
				</div>
			)}
		</div>
	);
}

/**
 * Textarea field component
 */
function TextareaField({
	fieldId,
	label,
	required,
	placeholder,
	rows = 3,
	className,
	containerClassName,
}: TextareaFieldProps) {
	const { field, disabled, value, errors, hasError, readOnly } =
		useFormField(fieldId);

	const handleChange = useCallback(
		(e: ChangeEvent<HTMLTextAreaElement>) => {
			formStore.updateField(fieldId, e.target.value);
		},
		[fieldId]
	);

	if (!field) {
		return null;
	}

	const helperId = `${fieldId}-helper`;

	return (
		<div className={cn("flex flex-col gap-2", containerClassName)}>
			<label
				className="font-medium text-[color:var(--vscode-foreground)] text-sm"
				htmlFor={fieldId}
			>
				{label}
				{required && (
					<span className="text-[color:var(--vscode-errorForeground)]"> *</span>
				)}
				{readOnly && (
					<span className="ml-2 rounded border border-[color:var(--vscode-contrastActiveBorder,rgba(255,255,255,0.4))] px-1 py-0.5 text-[10px] text-[color:var(--vscode-descriptionForeground)] uppercase tracking-wide">
						Read-only
					</span>
				)}
			</label>
			<textarea
				aria-describedby={hasError ? helperId : undefined}
				aria-invalid={hasError || undefined}
				aria-readonly={readOnly || undefined}
				aria-required={required}
				className={cn(
					"resize-none rounded border bg-[color:var(--vscode-input-background)] px-3 py-2 text-[color:var(--vscode-input-foreground)] text-sm outline-none ring-0 transition-all",
					"border-[color:var(--vscode-input-border,#3c3c3c)]",
					"placeholder:text-[color:var(--vscode-input-placeholderForeground,#888)]",
					"focus:border-[color:var(--vscode-focusBorder,#007acc)] focus:ring-2 focus:ring-[color:var(--vscode-focusBorder,#007acc)]/20",
					hasError &&
						"border-[color:var(--vscode-inputValidation-errorBorder,#be1100)] ring-2 ring-[color:var(--vscode-inputValidation-errorBorder,#be1100)]/20",
					disabled && "cursor-not-allowed opacity-50",
					className
				)}
				disabled={disabled}
				id={fieldId}
				onChange={handleChange}
				placeholder={placeholder}
				required={required}
				rows={rows}
				value={value as string}
			/>
			{hasError && (
				<div
					className="text-[color:var(--vscode-errorForeground)] text-xs"
					id={helperId}
				>
					{errors.join(", ")}
				</div>
			)}
		</div>
	);
}

/**
 * Checkbox field component
 */
function CheckboxField({
	fieldId,
	label,
	required,
	className,
	containerClassName,
}: CheckboxFieldProps) {
	const { field, disabled, value, errors, hasError, readOnly } =
		useFormField(fieldId);

	const handleChange = useCallback(
		(e: ChangeEvent<HTMLInputElement>) => {
			formStore.updateField(fieldId, e.target.checked ? "true" : "false");
		},
		[fieldId]
	);

	if (!field) {
		return null;
	}

	const helperId = `${fieldId}-helper`;
	const isChecked = value === "true";

	return (
		<div className={cn("flex flex-col gap-2", containerClassName)}>
			<div className="flex items-center gap-2">
				<input
					aria-describedby={hasError ? helperId : undefined}
					aria-invalid={hasError || undefined}
					aria-readonly={readOnly || undefined}
					aria-required={required}
					checked={isChecked}
					className={cn(
						"size-4 cursor-pointer rounded border bg-[color:var(--vscode-checkbox-background)] accent-[color:var(--vscode-checkbox-foreground)] transition-all",
						"border-[color:var(--vscode-checkbox-border,#3c3c3c)]",
						"focus:ring-2 focus:ring-[color:var(--vscode-focusBorder,#007acc)]/20",
						hasError &&
							"border-[color:var(--vscode-inputValidation-errorBorder,#be1100)]",
						disabled && "cursor-not-allowed opacity-50",
						className
					)}
					disabled={disabled}
					id={fieldId}
					onChange={handleChange}
					required={required}
					type="checkbox"
				/>
				<label
					className="cursor-pointer font-medium text-[color:var(--vscode-foreground)] text-sm"
					htmlFor={fieldId}
				>
					{label}
					{required && (
						<span className="text-[color:var(--vscode-errorForeground)]">
							{" "}
							*
						</span>
					)}
					{readOnly && (
						<span className="ml-2 rounded border border-[color:var(--vscode-contrastActiveBorder,rgba(255,255,255,0.4))] px-1 py-0.5 text-[10px] text-[color:var(--vscode-descriptionForeground)] uppercase tracking-wide">
							Read-only
						</span>
					)}
				</label>
			</div>
			{hasError && (
				<div
					className="text-[color:var(--vscode-errorForeground)] text-xs"
					id={helperId}
				>
					{errors.join(", ")}
				</div>
			)}
		</div>
	);
}

/**
 * Dropdown (select) field component
 */
function DropdownField({
	fieldId,
	label,
	required,
	options,
	placeholder,
	className,
	containerClassName,
}: DropdownFieldProps) {
	const { field, disabled, value, errors, hasError, readOnly } =
		useFormField(fieldId);

	const handleChange = useCallback(
		(e: ChangeEvent<HTMLSelectElement>) => {
			formStore.updateField(fieldId, e.target.value);
		},
		[fieldId]
	);

	if (!field) {
		return null;
	}

	const helperId = `${fieldId}-helper`;

	return (
		<div className={cn("flex flex-col gap-2", containerClassName)}>
			<label
				className="font-medium text-[color:var(--vscode-foreground)] text-sm"
				htmlFor={fieldId}
			>
				{label}
				{required && (
					<span className="text-[color:var(--vscode-errorForeground)]"> *</span>
				)}
				{readOnly && (
					<span className="ml-2 rounded border border-[color:var(--vscode-contrastActiveBorder,rgba(255,255,255,0.4))] px-1 py-0.5 text-[10px] text-[color:var(--vscode-descriptionForeground)] uppercase tracking-wide">
						Read-only
					</span>
				)}
			</label>
			<select
				aria-describedby={hasError ? helperId : undefined}
				aria-invalid={hasError || undefined}
				aria-readonly={readOnly || undefined}
				aria-required={required}
				className={cn(
					"cursor-pointer rounded border bg-[color:var(--vscode-dropdown-background)] px-3 py-2 text-[color:var(--vscode-dropdown-foreground)] text-sm outline-none ring-0 transition-all",
					"border-[color:var(--vscode-dropdown-border,#3c3c3c)]",
					"focus:border-[color:var(--vscode-focusBorder,#007acc)] focus:ring-2 focus:ring-[color:var(--vscode-focusBorder,#007acc)]/20",
					hasError &&
						"border-[color:var(--vscode-inputValidation-errorBorder,#be1100)] ring-2 ring-[color:var(--vscode-inputValidation-errorBorder,#be1100)]/20",
					disabled && "cursor-not-allowed opacity-50",
					className
				)}
				disabled={disabled}
				id={fieldId}
				onChange={handleChange}
				required={required}
				value={value as string}
			>
				{placeholder && (
					<option disabled value="">
						{placeholder}
					</option>
				)}
				{options.map((option) => (
					<option key={option} value={option}>
						{option}
					</option>
				))}
			</select>
			{hasError && (
				<div
					className="text-[color:var(--vscode-errorForeground)] text-xs"
					id={helperId}
				>
					{errors.join(", ")}
				</div>
			)}
		</div>
	);
}

/**
 * Multiselect field component
 * Renders checkboxes for each option
 */
function MultiselectField({
	fieldId,
	label,
	required,
	options,
	className,
	containerClassName,
}: MultiselectFieldProps) {
	const { field, disabled, value, errors, hasError, readOnly } =
		useFormField(fieldId);

	const selectedValues = normalizeMultiValue(value);

	const handleChange = useCallback(
		(option: string, checked: boolean) => {
			const currentValues = normalizeMultiValue(value);
			const newValues = checked
				? [...currentValues, option]
				: currentValues.filter((candidate) => candidate !== option);

			formStore.updateField(fieldId, newValues);
		},
		[fieldId, value]
	);

	if (!field) {
		return null;
	}

	const helperId = `${fieldId}-helper`;

	return (
		<div className={cn("flex flex-col gap-2", containerClassName)}>
			<fieldset>
				<legend className="font-medium text-[color:var(--vscode-foreground)] text-sm">
					{label}
					{required && (
						<span className="text-[color:var(--vscode-errorForeground)]">
							{" "}
							*
						</span>
					)}
					{readOnly && (
						<span className="ml-2 rounded border border-[color:var(--vscode-contrastActiveBorder,rgba(255,255,255,0.4))] px-1 py-0.5 text-[10px] text-[color:var(--vscode-descriptionForeground)] uppercase tracking-wide">
							Read-only
						</span>
					)}
				</legend>
				<div
					aria-describedby={hasError ? helperId : undefined}
					aria-invalid={hasError || undefined}
					className={cn(
						"mt-2 flex flex-col gap-2 rounded border bg-[color:var(--vscode-input-background)] px-3 py-2",
						"border-[color:var(--vscode-input-border,#3c3c3c)]",
						hasError &&
							"border-[color:var(--vscode-inputValidation-errorBorder,#be1100)] ring-2 ring-[color:var(--vscode-inputValidation-errorBorder,#be1100)]/20",
						className
					)}
				>
					{options.map((option) => {
						const optionId = `${fieldId}-${option.replace(/\s+/g, "-").toLowerCase()}`;
						const isChecked = selectedValues.includes(option);

						return (
							<div className="flex items-center gap-2" key={option}>
								<input
									checked={isChecked}
									className={cn(
										"size-4 cursor-pointer rounded border bg-[color:var(--vscode-checkbox-background)] accent-[color:var(--vscode-checkbox-foreground)] transition-all",
										"border-[color:var(--vscode-checkbox-border,#3c3c3c)]",
										"focus:ring-2 focus:ring-[color:var(--vscode-focusBorder,#007acc)]/20",
										disabled && "cursor-not-allowed opacity-50"
									)}
									disabled={disabled}
									id={optionId}
									onChange={(e) => handleChange(option, e.target.checked)}
									type="checkbox"
								/>
								<label
									className="cursor-pointer text-[color:var(--vscode-foreground)] text-sm"
									htmlFor={optionId}
								>
									{option}
								</label>
							</div>
						);
					})}
				</div>
			</fieldset>
			{hasError && (
				<div
					className="text-[color:var(--vscode-errorForeground)] text-xs"
					id={helperId}
				>
					{errors.join(", ")}
				</div>
			)}
		</div>
	);
}
