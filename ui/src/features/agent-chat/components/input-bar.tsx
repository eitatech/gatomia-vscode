/**
 * InputBar — follow-up message composer for the agent chat panel.
 *
 * Disables itself (with a visible explanation) whenever the session cannot
 * accept new input: read-only cloud sessions, agents with
 * `acceptsFollowUp: false` after the first turn, or sessions in a terminal
 * state (FR-003, FR-004).
 *
 * Visual layout (image 1 / Phase 2 redesign):
 *   ┌────────────────────────────────────────────────┐
 *   │ Ask anything (⌘L)                              │  ← textarea (placeholder)
 *   │                                                │
 *   ├────────────────────────────────────────────────┤
 *   │ [+] [<>Code] modelLabel        [○] [🎤] [Send] │  ← toolbar
 *   └────────────────────────────────────────────────┘
 *
 * The `+`, `<>Code`, mic and pulse icons are placeholders that match the
 * mockup chrome but are not yet wired to runtime behaviour — they are
 * `disabled` so they don't trap focus or imply functionality. Replacing
 * them with real handlers is tracked separately (mode toggle, attachments
 * and dictation each need their own UX spec).
 */

import { useCallback, useState } from "react";

interface InputBarProps {
	readonly onSubmit: (content: string) => void;
	readonly acceptsFollowUp: boolean;
	readonly readOnly?: boolean;
	readonly readOnlyReason?: string;
	readonly terminal?: boolean;
	readonly busy?: boolean;
	readonly modelLabel?: string;
	readonly onCancel?: () => void;
}

export function InputBar({
	onSubmit,
	acceptsFollowUp,
	readOnly,
	readOnlyReason,
	terminal,
	busy,
	modelLabel,
	onCancel,
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

	const canSend = !disabled && value.trim().length > 0;
	const showStop = Boolean(busy) && Boolean(onCancel);

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
					disabled ? (disabledReason ?? "Input disabled") : "Ask anything (⌘L)"
				}
				rows={3}
				value={value}
			/>
			{disabled && disabledReason ? (
				<div className="agent-chat-input__disabled-reason">
					{disabledReason}
				</div>
			) : null}
			<div className="agent-chat-input__toolbar">
				<div className="agent-chat-input__toolbar-left">
					<button
						aria-label="Add attachment (coming soon)"
						className="agent-chat-input__icon-button"
						disabled
						title="Attachments coming soon"
						type="button"
					>
						+
					</button>
					<button
						aria-label="Code mode"
						className="agent-chat-input__chip"
						disabled
						title="Code mode (coming soon)"
						type="button"
					>
						<span className="agent-chat-input__chip-icon">{"<>"}</span>
						<span className="agent-chat-input__chip-label">Code</span>
					</button>
					{modelLabel ? (
						<span className="agent-chat-input__model-label" title={modelLabel}>
							{modelLabel}
						</span>
					) : null}
				</div>
				<div className="agent-chat-input__toolbar-right">
					{busy ? (
						<span
							aria-hidden="true"
							className="agent-chat-input__activity"
							data-testid="input-activity"
						/>
					) : null}
					<button
						aria-label="Dictation (coming soon)"
						className="agent-chat-input__icon-button"
						disabled
						title="Dictation coming soon"
						type="button"
					>
						🎤
					</button>
					{showStop ? (
						<button
							aria-label="Stop"
							className="agent-chat-input__stop"
							onClick={onCancel}
							title="Stop the agent"
							type="button"
						>
							■
						</button>
					) : (
						<button
							aria-label="Send"
							className="agent-chat-input__send"
							disabled={!canSend}
							onClick={handleSubmit}
							type="button"
						>
							Send
						</button>
					)}
				</div>
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
