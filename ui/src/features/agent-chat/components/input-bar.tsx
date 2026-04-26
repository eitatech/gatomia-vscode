/**
 * InputBar — follow-up message composer for the agent chat panel.
 *
 * Disables itself (with a visible explanation) whenever the session cannot
 * accept new input: read-only cloud sessions, agents with
 * `acceptsFollowUp: false` after the first turn, or sessions in a terminal
 * state (FR-003, FR-004).
 *
 * Visual layout (Windsurf-inspired redesign — codicons, no emojis):
 *   ┌────────────────────────────────────────────────────┐
 *   │ Ask anything (⌘L)                                  │  ← textarea
 *   │                                                    │
 *   ├────────────────────────────────────────────────────┤
 *   │ [+] [</>Code] [Shield Auto▾] modelLabel  [Mic][▶]  │  ← toolbar
 *   └────────────────────────────────────────────────────┘
 *
 * Toolbar icons are codicons from `@vscode/codicons` (already loaded by the
 * webview). The `+`, `<>` and mic buttons remain placeholders (`disabled`)
 * until their respective specs ship — they preserve the chrome layout
 * without implying functionality.
 *
 * The {@link PermissionChip} surfaces the current
 * `gatomia.acp.permissionDefault` so the user can flip auto-approve mid
 * conversation without re-opening the empty composer.
 */

import { type ChangeEvent, useCallback, useMemo, useState } from "react";
import { PermissionChip } from "./permission-chip";
import type {
	ModelDescriptor,
	PermissionDefaultMode,
} from "@/features/agent-chat/types";

interface InputBarProps {
	readonly onSubmit: (content: string) => void;
	readonly acceptsFollowUp: boolean;
	readonly readOnly?: boolean;
	readonly readOnlyReason?: string;
	readonly terminal?: boolean;
	readonly busy?: boolean;
	readonly modelLabel?: string;
	readonly onCancel?: () => void;
	readonly permissionDefault: PermissionDefaultMode | undefined;
	readonly onChangePermissionDefault: (mode: PermissionDefaultMode) => void;
	/**
	 * Models the agent surfaced for this session via ACP. When non-empty
	 * the chip becomes a `<select>`; otherwise it falls back to the
	 * static `modelLabel`. Empty array hides the chip entirely.
	 */
	readonly availableModels?: readonly ModelDescriptor[];
	/**
	 * Currently selected model id (from the session payload). Drives
	 * the chip's `<select value>` when `availableModels` is non-empty.
	 */
	readonly currentModelId?: string;
	/**
	 * Persists a new model selection through the bridge so the host
	 * calls `session/set_model` and the chip reflects the agent's echo.
	 */
	readonly onChangeModel?: (modelId: string) => void;
	/**
	 * Optional refresh handler for the model dropdown — when present, a
	 * small refresh button is rendered next to the chip and triggers a
	 * re-probe of the active provider.
	 */
	readonly onRefreshModels?: () => void;
	/** True while a model probe for the active provider is in flight. */
	readonly modelsLoading?: boolean;
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
	permissionDefault,
	onChangePermissionDefault,
	availableModels,
	currentModelId,
	onChangeModel,
	onRefreshModels,
	modelsLoading,
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
			{disabled && disabledReason ? (
				<div className="agent-chat-input__disabled-reason">
					{disabledReason}
				</div>
			) : null}
			<div className="agent-chat-input__box">
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
						disabled
							? (disabledReason ?? "Input disabled")
							: "Ask anything (⌘L)"
					}
					rows={3}
					value={value}
				/>
				<div className="agent-chat-input__toolbar">
					<div className="agent-chat-input__toolbar-left">
						<button
							aria-label="Add attachment (coming soon)"
							className="agent-chat-input__icon-button"
							disabled
							title="Attachments coming soon"
							type="button"
						>
							<i aria-hidden="true" className="codicon codicon-add" />
						</button>
						<button
							aria-label="Code mode (coming soon)"
							className="agent-chat-input__chip"
							disabled
							title="Code mode (coming soon)"
							type="button"
						>
							<i aria-hidden="true" className="codicon codicon-code" />
							<span className="agent-chat-input__chip-label">Code</span>
						</button>
						<PermissionChip
							onChange={onChangePermissionDefault}
							value={permissionDefault}
						/>
						<ModelChip
							availableModels={availableModels}
							currentModelId={currentModelId}
							loading={Boolean(modelsLoading)}
							modelLabel={modelLabel}
							onChange={onChangeModel}
							onRefresh={onRefreshModels}
						/>
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
							<i aria-hidden="true" className="codicon codicon-mic" />
						</button>
						{showStop ? (
							<button
								aria-label="Stop"
								className="agent-chat-input__stop"
								onClick={onCancel}
								title="Stop the agent"
								type="button"
							>
								<i aria-hidden="true" className="codicon codicon-debug-stop" />
							</button>
						) : (
							<button
								aria-label="Send"
								className="agent-chat-input__send"
								disabled={!canSend}
								onClick={handleSubmit}
								type="button"
							>
								<i aria-hidden="true" className="codicon codicon-send" />
							</button>
						)}
					</div>
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

interface ModelChipProps {
	readonly availableModels: readonly ModelDescriptor[] | undefined;
	readonly currentModelId: string | undefined;
	readonly loading: boolean;
	readonly modelLabel: string | undefined;
	readonly onChange: ((modelId: string) => void) | undefined;
	readonly onRefresh: (() => void) | undefined;
}

/**
 * Compact model chip rendered next to the {@link PermissionChip}.
 *
 * Render contract (matches the redesign):
 *
 *   - When `availableModels` is non-empty: the chip is an interactive
 *     `<select>` whose `change` events flow through `onChange` (the
 *     bridge calls `session/set_model` and persists the choice).
 *   - When `availableModels` is empty/undefined but the host probe is
 *     in flight: the chip becomes a passive "Loading models…" label.
 *   - When `availableModels` is empty AND no probe is running: the
 *     chip falls back to the static `modelLabel` (provider display
 *     name) so the chrome is never empty.
 *   - When `modelLabel` is also empty: the chip is hidden entirely.
 *
 * The optional refresh button only renders when `onRefresh` is wired
 * AND the dropdown variant is showing — refreshing the static label
 * has no effect.
 */
function ModelChip({
	availableModels,
	currentModelId,
	loading,
	modelLabel,
	onChange,
	onRefresh,
}: ModelChipProps): JSX.Element | null {
	const models = availableModels ?? [];
	const hasDynamicModels = models.length > 0;
	const handleChange = useMemo(
		() =>
			(event: ChangeEvent<HTMLSelectElement>): void => {
				if (!onChange) {
					return;
				}
				const next = event.target.value;
				if (next && next !== currentModelId) {
					onChange(next);
				}
			},
		[onChange, currentModelId]
	);

	if (hasDynamicModels) {
		return (
			<span className="agent-chat-input__model-chip">
				<select
					aria-label="Select agent model"
					className="agent-chat-input__model-select"
					disabled={!onChange}
					onChange={handleChange}
					value={currentModelId ?? ""}
				>
					{currentModelId ? null : (
						<option disabled value="">
							Select a model
						</option>
					)}
					{models.map((model) => (
						<option key={model.id} value={model.id}>
							{model.displayName}
						</option>
					))}
				</select>
				{onRefresh ? (
					<button
						aria-label="Refresh model list"
						className="agent-chat-input__icon-button agent-chat-input__icon-button--inline"
						onClick={onRefresh}
						title={loading ? "Refreshing models…" : "Refresh model list"}
						type="button"
					>
						<i
							aria-hidden="true"
							className={
								loading
									? "codicon codicon-sync codicon-modifier-spin"
									: "codicon codicon-sync"
							}
						/>
					</button>
				) : null}
			</span>
		);
	}

	if (loading) {
		return (
			<span
				className="agent-chat-input__model-label"
				title="Loading model list…"
			>
				Loading models…
			</span>
		);
	}

	if (modelLabel) {
		return (
			<span className="agent-chat-input__model-label" title={modelLabel}>
				{modelLabel}
			</span>
		);
	}

	return null;
}
