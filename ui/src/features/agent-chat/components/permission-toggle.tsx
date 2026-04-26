/**
 * PermissionToggle — segmented control rendered above the textarea on the
 * empty-state composer. Lets the user pre-flight the
 * `gatomia.acp.permissionDefault` value before starting the session, so
 * subsequent tool-call permission requests do not interrupt the flow.
 *
 * Pure presentation: no internal state. The active value comes from the
 * bridge (`state.permissionDefault`); clicks dispatch `onChange(mode)`.
 *
 * The three options mirror the `PermissionMode` enum exposed by the
 * backend (`acp-client.ts`): `ask | allow | deny`. The labels are kept
 * short so the control fits the sidebar width without wrapping.
 */

import type { PermissionDefaultMode } from "@/features/agent-chat/types";

interface PermissionToggleProps {
	readonly value: PermissionDefaultMode | undefined;
	readonly onChange: (mode: PermissionDefaultMode) => void;
	readonly disabled?: boolean;
}

interface ToggleOption {
	readonly mode: PermissionDefaultMode;
	readonly label: string;
	readonly title: string;
	readonly icon: string;
}

const OPTIONS: readonly ToggleOption[] = [
	{
		mode: "ask",
		label: "Ask",
		title: "Ask before each tool call (default)",
		icon: "codicon-question",
	},
	{
		mode: "allow",
		label: "Auto-approve",
		title: "Auto-approve every tool call without prompting",
		icon: "codicon-check-all",
	},
	{
		mode: "deny",
		label: "Reject",
		title: "Reject every tool call automatically",
		icon: "codicon-circle-slash",
	},
];

const DEFAULT_VALUE: PermissionDefaultMode = "ask";

export function PermissionToggle({
	value,
	onChange,
	disabled,
}: PermissionToggleProps): JSX.Element {
	const active = value ?? DEFAULT_VALUE;
	return (
		<fieldset className="agent-chat-permission-toggle">
			<legend className="agent-chat-permission-toggle__legend">
				Permission default
			</legend>
			{OPTIONS.map((option) => {
				const isActive = option.mode === active;
				const className = isActive
					? "agent-chat-permission-toggle__option agent-chat-permission-toggle__option--active"
					: "agent-chat-permission-toggle__option";
				return (
					<button
						aria-pressed={isActive}
						className={className}
						disabled={disabled}
						key={option.mode}
						onClick={() => onChange(option.mode)}
						title={option.title}
						type="button"
					>
						<i aria-hidden="true" className={`codicon ${option.icon}`} />
						<span>{option.label}</span>
					</button>
				);
			})}
		</fieldset>
	);
}
