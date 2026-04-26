/**
 * PermissionChip — compact toggle for the InputBar toolbar that surfaces
 * the current `gatomia.acp.permissionDefault` value (Ask / Auto / Reject)
 * during an active session. Click opens a dropdown menu so the user can
 * change the policy mid-conversation without leaving the chat surface.
 *
 * Pure presentation: state lives in the bridge; this component only owns
 * the local `open` boolean for the dropdown. All visuals come from
 * `app.css` and use VS Code theme tokens — no hard-coded colours.
 *
 * The chip mirrors the segmented control on the empty-state composer
 * ({@link PermissionToggle}) but is denser so it fits next to the model
 * label and the send/stop buttons.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { PermissionDefaultMode } from "@/features/agent-chat/types";

interface PermissionChipProps {
	readonly value: PermissionDefaultMode | undefined;
	readonly onChange: (mode: PermissionDefaultMode) => void;
}

interface ChipOption {
	readonly mode: PermissionDefaultMode;
	readonly label: string;
	readonly description: string;
	readonly icon: string;
}

const OPTIONS: readonly ChipOption[] = [
	{
		mode: "ask",
		label: "Ask",
		description: "Prompt before each tool call.",
		icon: "codicon-question",
	},
	{
		mode: "allow",
		label: "Auto-approve",
		description: "Approve every tool call automatically.",
		icon: "codicon-check-all",
	},
	{
		mode: "deny",
		label: "Reject",
		description: "Reject every tool call automatically.",
		icon: "codicon-circle-slash",
	},
];

const DEFAULT_VALUE: PermissionDefaultMode = "ask";

const SHORT_LABEL: Record<PermissionDefaultMode, string> = {
	ask: "Ask",
	allow: "Auto",
	deny: "Reject",
};

export function PermissionChip({
	value,
	onChange,
}: PermissionChipProps): JSX.Element {
	const [open, setOpen] = useState(false);
	const containerRef = useRef<HTMLDivElement | null>(null);
	const active = value ?? DEFAULT_VALUE;

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
		(mode: PermissionDefaultMode) => {
			setOpen(false);
			if (mode !== active) {
				onChange(mode);
			}
		},
		[active, onChange]
	);

	return (
		<div className="agent-chat-permission-chip" ref={containerRef}>
			<button
				aria-expanded={open}
				aria-haspopup="menu"
				aria-label={`Permission: ${SHORT_LABEL[active]}`}
				className="agent-chat-permission-chip__toggle"
				onClick={() => setOpen((v) => !v)}
				title={`Permission: ${SHORT_LABEL[active]}`}
				type="button"
			>
				<i aria-hidden="true" className="codicon codicon-shield" />
				<span>{SHORT_LABEL[active]}</span>
				<i aria-hidden="true" className="codicon codicon-chevron-down" />
			</button>
			{open ? (
				<div className="agent-chat-permission-chip__menu" role="menu">
					{OPTIONS.map((option) => (
						<button
							aria-label={option.label}
							className={
								option.mode === active
									? "agent-chat-permission-chip__item agent-chat-permission-chip__item--active"
									: "agent-chat-permission-chip__item"
							}
							key={option.mode}
							onClick={() => handlePick(option.mode)}
							role="menuitem"
							type="button"
						>
							<i aria-hidden="true" className={`codicon ${option.icon}`} />
							<span className="agent-chat-permission-chip__item-text">
								<span className="agent-chat-permission-chip__item-label">
									{option.label}
								</span>
								<span className="agent-chat-permission-chip__item-desc">
									{option.description}
								</span>
							</span>
						</button>
					))}
				</div>
			) : null}
		</div>
	);
}
