import type React from "react";
import { useState } from "react";
import "./collapsible-section.css";

export interface CollapsibleSectionProps {
	/** Section title */
	title: string;
	/** Whether the section is open by default */
	defaultOpen?: boolean;
	/** Optional badge text (e.g., "Modified", "3 items") */
	badge?: string;
	/** Section content */
	children: React.ReactNode;
	/** Additional CSS class */
	className?: string;
	/** Callback when section is toggled */
	onToggle?: (isOpen: boolean) => void;
}

/**
 * CollapsibleSection component for organizing related options.
 * Features:
 * - Expandable/collapsible with smooth animation
 * - Optional badge (count, status, etc.)
 * - Arrow icon indicates open/closed state
 * - Keyboard accessible
 */
export function CollapsibleSection({
	title,
	defaultOpen = false,
	badge,
	children,
	className = "",
	onToggle,
}: CollapsibleSectionProps) {
	const [isOpen, setIsOpen] = useState(defaultOpen);

	const handleToggle = () => {
		const newState = !isOpen;
		setIsOpen(newState);
		onToggle?.(newState);
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter" || e.key === " ") {
			e.preventDefault();
			handleToggle();
		}
	};

	return (
		<div className={`collapsible-section ${className}`}>
			<button
				aria-expanded={isOpen}
				className="collapsible-section-header"
				onClick={handleToggle}
				onKeyDown={handleKeyDown}
				type="button"
			>
				<svg
					aria-hidden="true"
					className={`collapsible-section-arrow ${isOpen ? "open" : ""}`}
					fill="currentColor"
					height="16"
					viewBox="0 0 16 16"
					width="16"
					xmlns="http://www.w3.org/2000/svg"
				>
					<path d="M6 4l4 4-4 4V4z" />
				</svg>
				<span className="collapsible-section-title">{title}</span>
				{badge && <span className="collapsible-section-badge">{badge}</span>}
			</button>
			{isOpen && <div className="collapsible-section-content">{children}</div>}
		</div>
	);
}
