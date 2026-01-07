import { forwardRef, useId } from "react";
import type { ReactNode, SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface VSCodeSelectProps
	extends SelectHTMLAttributes<HTMLSelectElement> {
	/**
	 * Optional label to display above the select
	 */
	label?: ReactNode;
	/**
	 * Whether the label should include a required indicator
	 */
	required?: boolean;
	/**
	 * Optional description text below the select
	 */
	description?: ReactNode;
	/**
	 * Optional error message to display
	 */
	error?: string;
	/**
	 * Size variant for the select
	 */
	size?: "sm" | "md" | "lg";
}

/**
 * VS Code styled select component
 *
 * Matches the native VS Code dropdown styling from the Settings and panels.
 * Uses VS Code CSS variables for proper theming support.
 */
export const VSCodeSelect = forwardRef<HTMLSelectElement, VSCodeSelectProps>(
	(
		{
			className,
			label,
			required,
			description,
			error,
			size = "md",
			id: providedId,
			disabled,
			children,
			...props
		},
		ref
	) => {
		const generatedId = useId();
		const id = providedId ?? generatedId;

		const sizeClasses = {
			sm: "px-2 py-1 text-xs",
			md: "px-3 py-2 text-sm",
			lg: "px-4 py-2.5 text-base",
		};

		const selectElement = (
			<select
				className={cn(
					// Base styles
					"w-full rounded border appearance-none",
					sizeClasses[size],
					// VS Code themed colors
					"bg-[var(--vscode-dropdown-background,#3c3c3c)]",
					"text-[var(--vscode-dropdown-foreground,#cccccc)]",
					"border-[var(--vscode-dropdown-border,#3c3c3c)]",
					// Focus state
					"focus:outline-none focus:border-[var(--vscode-focusBorder,#007fd4)]",
					// Hover state
					"hover:border-[var(--vscode-dropdown-border,#3c3c3c)]",
					// Disabled state
					disabled && "cursor-not-allowed opacity-50",
					// Error state
					error && "border-[var(--vscode-inputValidation-errorBorder,#be1100)]",
					// Custom dropdown arrow using CSS
					"bg-no-repeat bg-[length:16px] bg-[right_8px_center]",
					"pr-8",
					className
				)}
				disabled={disabled}
				id={id}
				ref={ref}
				style={{
					backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16' fill='%23cccccc'%3E%3Cpath d='M4.5 5.5L8 9l3.5-3.5'/%3E%3C/svg%3E")`,
					...props.style,
				}}
				{...props}
			>
				{children}
			</select>
		);

		if (!label && !description && !error) {
			return selectElement;
		}

		return (
			<div className="flex flex-col gap-2">
				{label && (
					<label
						className={cn(
							"font-medium text-[var(--vscode-foreground)]",
							size === "sm" ? "text-xs" : "text-sm"
						)}
						htmlFor={id}
					>
						{label}
						{required && (
							<span
								aria-hidden="true"
								className="ml-1 text-[var(--vscode-errorForeground,#f14c4c)]"
							>
								*
							</span>
						)}
					</label>
				)}
				{selectElement}
				{description && !error && (
					<p className="text-[var(--vscode-descriptionForeground,rgba(255,255,255,0.6))] text-xs">
						{description}
					</p>
				)}
				{error && (
					<p className="text-[var(--vscode-errorForeground,#f14c4c)] text-xs">
						{error}
					</p>
				)}
			</div>
		);
	}
);

VSCodeSelect.displayName = "VSCodeSelect";
