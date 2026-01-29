import type React from "react";
import { useState, useRef, useEffect, useCallback } from "react";
import "./info-tooltip.css";

export interface InfoTooltipProps {
	/** Tooltip title */
	title: string;
	/** Detailed description */
	description: string;
	/** Optional warning message (displayed in yellow/orange) */
	warning?: string;
	/** Optional "Learn more" URL */
	learnMoreUrl?: string;
	/** Position of the tooltip relative to the icon */
	position?: "top" | "bottom" | "left" | "right";
	/** Additional CSS class */
	className?: string;
}

/**
 * InfoTooltip component that displays help text on hover.
 * Shows:
 * - CLI flag name (title)
 * - What it does (description)
 * - Warnings about dangerous combinations (optional)
 * - Learn more links (optional)
 */
export function InfoTooltip({
	title,
	description,
	warning,
	learnMoreUrl,
	position = "top",
	className = "",
}: InfoTooltipProps) {
	const [isVisible, setIsVisible] = useState(false);
	const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
	const iconRef = useRef<HTMLButtonElement>(null);
	const tooltipRef = useRef<HTMLDivElement>(null);

	const calculatePosition = useCallback(
		(iconRect: DOMRect, tooltipRect: DOMRect, pos: string) => {
			const viewportWidth = window.innerWidth;
			const viewportHeight = window.innerHeight;
			let top = 0;
			let left = 0;

			switch (pos) {
				case "top":
					top = iconRect.top - tooltipRect.height - 8;
					left = iconRect.left + iconRect.width / 2 - tooltipRect.width / 2;
					break;
				case "bottom":
					top = iconRect.bottom + 8;
					left = iconRect.left + iconRect.width / 2 - tooltipRect.width / 2;
					break;
				case "left":
					top = iconRect.top + iconRect.height / 2 - tooltipRect.height / 2;
					left = iconRect.left - tooltipRect.width - 8;
					break;
				case "right":
					top = iconRect.top + iconRect.height / 2 - tooltipRect.height / 2;
					left = iconRect.right + 8;
					break;
				default:
					// Default to top
					top = iconRect.top - tooltipRect.height - 8;
					left = iconRect.left + iconRect.width / 2 - tooltipRect.width / 2;
					break;
			}

			// Adjust if tooltip goes off screen
			if (left < 8) {
				left = 8;
			}
			if (left + tooltipRect.width > viewportWidth - 8) {
				left = viewportWidth - tooltipRect.width - 8;
			}
			if (top < 8) {
				top = 8;
			}
			if (top + tooltipRect.height > viewportHeight - 8) {
				top = viewportHeight - tooltipRect.height - 8;
			}

			return { top, left };
		},
		[]
	);

	useEffect(() => {
		if (isVisible && iconRef.current && tooltipRef.current) {
			const iconRect = iconRef.current.getBoundingClientRect();
			const tooltipRect = tooltipRef.current.getBoundingClientRect();
			const pos = calculatePosition(iconRect, tooltipRect, position);
			setTooltipPosition(pos);
		}
	}, [isVisible, position, calculatePosition]);

	const handleMouseEnter = () => {
		setIsVisible(true);
	};

	const handleMouseLeave = () => {
		setIsVisible(false);
	};

	const handleClick = (e: React.MouseEvent) => {
		e.stopPropagation();
		setIsVisible(!isVisible);
	};

	return (
		<span className={`info-tooltip-wrapper ${className}`}>
			<button
				aria-label={`Info: ${title}`}
				className="info-tooltip-icon"
				onClick={handleClick}
				onMouseEnter={handleMouseEnter}
				onMouseLeave={handleMouseLeave}
				ref={iconRef}
				type="button"
			>
				<svg
					aria-hidden="true"
					fill="currentColor"
					height="14"
					viewBox="0 0 16 16"
					width="14"
					xmlns="http://www.w3.org/2000/svg"
				>
					<path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm0 13A6 6 0 1 1 8 2a6 6 0 0 1 0 12z" />
					<path d="M7.5 4.5a.5.5 0 0 1 1 0v4a.5.5 0 0 1-1 0v-4zM8 11a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5z" />
				</svg>
			</button>
			{isVisible && (
				// biome-ignore lint/a11y/noNoninteractiveElementInteractions: Tooltip needs mouse handlers to stay visible on hover
				<div
					aria-live="polite"
					className={`info-tooltip-content info-tooltip-${position}`}
					onMouseEnter={handleMouseEnter}
					onMouseLeave={handleMouseLeave}
					ref={tooltipRef}
					role="tooltip"
					style={{
						top: `${tooltipPosition.top}px`,
						left: `${tooltipPosition.left}px`,
					}}
				>
					<div className="info-tooltip-title">{title}</div>
					<div className="info-tooltip-description">{description}</div>
					{warning && (
						<div className="info-tooltip-warning">
							<svg
								aria-hidden="true"
								fill="currentColor"
								height="14"
								viewBox="0 0 16 16"
								width="14"
								xmlns="http://www.w3.org/2000/svg"
							>
								<path d="M8.982 1.566a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767L8.982 1.566zM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 5.995A.905.905 0 0 1 8 5zm.002 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2z" />
							</svg>
							<span>{warning}</span>
						</div>
					)}
					{learnMoreUrl && (
						<a
							className="info-tooltip-link"
							href={learnMoreUrl}
							onClick={(e) => e.stopPropagation()}
							rel="noopener noreferrer"
							target="_blank"
						>
							Learn more →
						</a>
					)}
				</div>
			)}
		</span>
	);
}
