/**
 * InputBar — follow-up message composer for the agent chat panel.
 *
 * Disables itself (with a visible explanation) whenever the session cannot
 * accept new input: read-only cloud sessions, agents with
 * `acceptsFollowUp: false` after the first turn, or sessions in a terminal
 * state (FR-003, FR-004).
 */

import { useCallback, useState } from "react";

interface InputBarProps {
	readonly onSubmit: (content: string) => void;
	readonly acceptsFollowUp: boolean;
	readonly readOnly?: boolean;
	readonly readOnlyReason?: string;
	readonly terminal?: boolean;
}

export function InputBar({
	onSubmit,
	acceptsFollowUp,
	readOnly,
	readOnlyReason,
	terminal,
}: InputBarProps): JSX.Element {
	const [value, setValue] = useState("");

	const disabled = Boolean(readOnly) || !acceptsFollowUp || Boolean(terminal);
	const disabledReason = resolveDisabledReason({
		readOnly: Boolean(readOnly),
		readOnlyReason,
		acceptsFollowUp,
		terminal: Boolean(terminal),
	});

	const handleSubmit = useCallback(() => {
		const trimmed = value.trim();
		if (trimmed.length === 0 || disabled) {
			return;
		}
		onSubmit(trimmed);
		setValue("");
	}, [value, disabled, onSubmit]);

	return (
		<div className="agent-chat-input">
			<textarea
				className="agent-chat-input__textarea"
				disabled={disabled}
				onChange={(e) => setValue(e.target.value)}
				onKeyDown={(e) => {
					if (e.key === "Enter" && !e.shiftKey) {
						e.preventDefault();
						handleSubmit();
					}
				}}
				placeholder={
					disabled ? (disabledReason ?? "Input disabled") : "Type a message…"
				}
				rows={3}
				value={value}
			/>
			{disabled && disabledReason ? (
				<div className="agent-chat-input__disabled-reason">
					{disabledReason}
				</div>
			) : null}
			<div className="agent-chat-input__actions">
				<button
					aria-label="Send"
					disabled={disabled || value.trim().length === 0}
					onClick={handleSubmit}
					type="button"
				>
					Send
				</button>
			</div>
		</div>
	);
}

interface DisabledReasonInput {
	readonly readOnly: boolean;
	readonly readOnlyReason?: string;
	readonly acceptsFollowUp: boolean;
	readonly terminal: boolean;
}

function resolveDisabledReason(input: DisabledReasonInput): string | undefined {
	if (input.readOnly) {
		return input.readOnlyReason ?? "This session is read-only.";
	}
	if (!input.acceptsFollowUp) {
		return "This agent does not accept follow-up messages in the same session.";
	}
	if (input.terminal) {
		return "This session has ended. Start a new one to continue.";
	}
	return;
}
