/**
 * ChipDropdown — generic compact dropdown chip used across the agent
 * chat composer (Agent / Agent file / Model / Permission).
 *
 * Matches the visual contract of the original {@link PermissionChip}:
 *
 *   ┌─────────────────────────┐
 *   │ [icon] Label  ▾         │  ← chip toggle button
 *   └─────────────────────────┘
 *           │
 *           ▼ (when open)
 *   ┌─────────────────────────┐
 *   │ [icon] Option label     │
 *   │        Description      │
 *   │ ...                     │
 *   └─────────────────────────┘
 *
 * Behaviour:
 *
 *   - Click toggles the menu; clicking outside closes it.
 *   - `aria-expanded` mirrors the open state for assistive tech.
 *   - Picking an option fires `onChange`; picking the already-active
 *     value is a no-op (avoids redundant bridge round-trips).
 *   - When `disabled` (or `options` is empty AND `disabledMessage`
 *     is provided), the chip renders as a passive label and never
 *     opens the menu.
 *
 * The component is intentionally generic over the option `value` so the
 * NewSessionComposer can use the same widget for provider ids, agent
 * file ids, model ids, etc.
 */

import {
	type ReactNode,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";

export interface ChipDropdownOption<T extends string> {
	readonly value: T;
	readonly label: string;
	readonly description?: string;
	readonly icon?: string;
	readonly disabled?: boolean;
}

export interface ChipDropdownProps<T extends string> {
	/** Accessible label prefix — e.g. `"Agent"` becomes `"Agent: Claude"`. */
	readonly ariaPrefix: string;
	/** Optional codicon class rendered on the left of the toggle. */
	readonly icon?: string;
	/** Short label rendered inside the chip toggle (current selection). */
	readonly currentLabel: string;
	/** Currently selected option value (matched against `options[i].value`). */
	readonly value: T | undefined;
	/** Available options shown in the dropdown menu. */
	readonly options: readonly ChipDropdownOption<T>[];
	/** Picks the new value. Not called when the user re-selects the active value. */
	readonly onChange: (value: T) => void;
	/**
	 * Render the chip in passive (non-interactive) mode — useful when
	 * the only option is the current value, or when the underlying data
	 * is still loading.
	 */
	readonly disabled?: boolean;
	/** Tooltip text override; defaults to `${ariaPrefix}: ${currentLabel}`. */
	readonly title?: string;
	/** Optional content rendered ABOVE the options list (e.g. status note). */
	readonly menuHeader?: ReactNode;
}

export function ChipDropdown<T extends string>({
	ariaPrefix,
	icon,
	currentLabel,
	value,
	options,
	onChange,
	disabled,
	title,
	menuHeader,
}: ChipDropdownProps<T>): JSX.Element {
	const [open, setOpen] = useState(false);
	const containerRef = useRef<HTMLDivElement | null>(null);

	useEffect(() => {
		if (!open) {
			return;
		}
		const handler = (event: MouseEvent): void => {
			if (
				containerRef.current &&
				!containerRef.current.contains(event.target as Node)
			) {
				setOpen(false);
			}
		};
		window.addEventListener("mousedown", handler);
		return () => {
			window.removeEventListener("mousedown", handler);
		};
	}, [open]);

	const handlePick = useCallback(
		(next: T) => {
			setOpen(false);
			if (next !== value) {
				onChange(next);
			}
		},
		[value, onChange]
	);

	const accessibleName = `${ariaPrefix}: ${currentLabel}`;
	const tooltip = title ?? accessibleName;

	return (
		<div className="agent-chat-chip" ref={containerRef}>
			<button
				aria-expanded={open}
				aria-haspopup="menu"
				aria-label={accessibleName}
				className="agent-chat-chip__toggle"
				disabled={disabled}
				onClick={() => {
					if (!disabled) {
						setOpen((v) => !v);
					}
				}}
				title={tooltip}
				type="button"
			>
				{icon ? <i aria-hidden="true" className={`codicon ${icon}`} /> : null}
				<span className="agent-chat-chip__label">{currentLabel}</span>
				{disabled ? null : (
					<i aria-hidden="true" className="codicon codicon-chevron-down" />
				)}
			</button>
			{open && !disabled ? (
				<div className="agent-chat-chip__menu" role="menu">
					{menuHeader ? (
						<div className="agent-chat-chip__menu-header">{menuHeader}</div>
					) : null}
					{options.map((option) => (
						<button
							aria-label={option.label}
							className={
								option.value === value
									? "agent-chat-chip__item agent-chat-chip__item--active"
									: "agent-chat-chip__item"
							}
							disabled={option.disabled}
							key={option.value}
							onClick={() => handlePick(option.value)}
							role="menuitem"
							type="button"
						>
							{option.icon ? (
								<i aria-hidden="true" className={`codicon ${option.icon}`} />
							) : null}
							<span className="agent-chat-chip__item-text">
								<span className="agent-chat-chip__item-label">
									{option.label}
								</span>
								{option.description ? (
									<span className="agent-chat-chip__item-desc">
										{option.description}
									</span>
								) : null}
							</span>
						</button>
					))}
				</div>
			) : null}
		</div>
	);
}
