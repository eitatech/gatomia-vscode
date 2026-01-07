import { useId } from "react";
import type { InputHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface VSCodeCheckboxProps
	extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
	/**
	 * Whether the checkbox is in an indeterminate state
	 * (partially selected, used for parent checkboxes)
	 */
	indeterminate?: boolean;
	/**
	 * Optional label to display next to the checkbox
	 */
	label?: ReactNode;
	/**
	 * Size variant for the checkbox
	 */
	size?: "sm" | "md" | "lg";
}

/**
 * VS Code styled checkbox component
 *
 * Matches the native VS Code checkbox styling from the Settings and Welcome pages.
 * Uses VS Code CSS variables for proper theming support.
 */
export function VSCodeCheckbox({
	className,
	indeterminate = false,
	label,
	size = "md",
	id: providedId,
	disabled,
	...props
}: VSCodeCheckboxProps): JSX.Element {
	const generatedId = useId();
	const id = providedId ?? generatedId;

	const sizeClasses = {
		sm: "size-3.5",
		md: "size-4",
		lg: "size-5",
	};

	const checkboxElement = (
		<span className="relative inline-flex items-center justify-center">
			<input
				className={cn(
					// Base styles
					"peer appearance-none border rounded",
					sizeClasses[size],
					// VS Code themed colors
					"bg-[var(--vscode-checkbox-background,transparent)]",
					"border-[var(--vscode-checkbox-border,#6b6b6b)]",
					// Checked state
					"checked:bg-[var(--vscode-checkbox-selectBackground,#0078d4)]",
					"checked:border-[var(--vscode-checkbox-selectBorder,#0078d4)]",
					// Focus state
					"focus:outline-none focus-visible:ring-1",
					"focus-visible:ring-[var(--vscode-focusBorder,#007fd4)]",
					// Cursor
					disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
					className
				)}
				disabled={disabled}
				id={id}
				ref={(input) => {
					if (input) {
						input.indeterminate = indeterminate;
					}
				}}
				type="checkbox"
				{...props}
			/>
			{/* Checkmark icon */}
			<span
				className={cn(
					"pointer-events-none absolute hidden peer-checked:block",
					sizeClasses[size]
				)}
			>
				<svg
					className="size-full"
					fill="none"
					stroke="var(--vscode-checkbox-foreground, #fff)"
					strokeLinecap="round"
					strokeLinejoin="round"
					strokeWidth="2.5"
					viewBox="0 0 16 16"
				>
					<path d="M4 8l3 3 5-6" />
				</svg>
			</span>
			{/* Indeterminate icon */}
			{indeterminate && (
				<span
					className={cn(
						"pointer-events-none absolute peer-checked:hidden",
						sizeClasses[size]
					)}
				>
					<svg
						className="size-full"
						fill="none"
						stroke="var(--vscode-checkbox-foreground, #fff)"
						strokeLinecap="round"
						strokeWidth="2.5"
						viewBox="0 0 16 16"
					>
						<path d="M4 8h8" />
					</svg>
				</span>
			)}
		</span>
	);

	if (!label) {
		return checkboxElement;
	}

	return (
		<label
			className={cn(
				"inline-flex items-center gap-2",
				disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
				"select-none text-sm",
				"text-[var(--vscode-foreground)]"
			)}
			htmlFor={id}
		>
			{checkboxElement}
			{label}
		</label>
	);
}
