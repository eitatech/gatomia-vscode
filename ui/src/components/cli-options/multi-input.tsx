import React, { useState, useRef, type KeyboardEvent } from "react";
import "./multi-input.css";

export interface MultiInputProps {
	/** Array of string values */
	value: string[];
	/** Called when values change */
	onChange: (values: string[]) => void;
	/** Placeholder text when empty */
	placeholder?: string;
	/** Whether the input is disabled */
	disabled?: boolean;
	/** Label for the input */
	label?: string;
	/** Additional CSS class */
	className?: string;
}

/**
 * MultiInput component for entering multiple string values.
 * Users can:
 * - Type values separated by commas or Enter key
 * - Remove values by clicking the X button on chips
 * - See all values as visual chips/pills
 */
export function MultiInput({
	value,
	onChange,
	placeholder = "Type and press Enter or comma",
	disabled = false,
	label,
	className = "",
}: MultiInputProps) {
	const [inputValue, setInputValue] = useState("");
	const inputRef = useRef<HTMLInputElement>(null);

	const addValue = (newValue: string) => {
		const trimmed = newValue.trim();
		if (trimmed && !value.includes(trimmed)) {
			onChange([...value, trimmed]);
		}
		setInputValue("");
	};

	const removeValue = (indexToRemove: number) => {
		onChange(value.filter((_, index) => index !== indexToRemove));
	};

	const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Enter" || e.key === ",") {
			e.preventDefault();
			addValue(inputValue);
		} else if (e.key === "Backspace" && inputValue === "" && value.length > 0) {
			// Remove last chip on backspace when input is empty
			removeValue(value.length - 1);
		}
	};

	const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const newValue = e.target.value;
		// Check if user typed a comma
		if (newValue.includes(",")) {
			const values = newValue.split(",");
			// Add all complete values
			for (const val of values.slice(0, -1)) {
				const trimmed = val.trim();
				if (trimmed && !value.includes(trimmed)) {
					onChange([...value, trimmed]);
				}
			}
			// Keep the last part (after the last comma) in the input
			setInputValue(values.at(-1) || "");
		} else {
			setInputValue(newValue);
		}
	};

	return (
		<div className={`multi-input-wrapper ${className}`}>
			{label && (
				<label className="multi-input-label" htmlFor="multi-input-field">
					{label}
				</label>
			)}
			<div className={`multi-input-container ${disabled ? "disabled" : ""}`}>
				{value.map((val) => (
					<span className="multi-input-chip" key={val}>
						<span className="multi-input-chip-text">{val}</span>
						<button
							aria-label={`Remove ${val}`}
							className="multi-input-chip-remove"
							disabled={disabled}
							onClick={(e) => {
								e.stopPropagation();
								const indexToRemove = value.indexOf(val);
								if (indexToRemove !== -1) {
									removeValue(indexToRemove);
								}
							}}
							type="button"
						>
							×
						</button>
					</span>
				))}
				<input
					className="multi-input-field"
					disabled={disabled}
					id="multi-input-field"
					onChange={handleInputChange}
					onKeyDown={handleKeyDown}
					placeholder={value.length === 0 ? placeholder : ""}
					ref={inputRef}
					type="text"
					value={inputValue}
				/>
			</div>
		</div>
	);
}
