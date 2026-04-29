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
import { ChipDropdown, type ChipDropdownOption } from "./chip-dropdown";
import { PermissionChip } from "./permission-chip";
import { providerIconClass } from "./provider-icon";
import type {
	AgentRoleDescriptor,
	ModelDescriptor,
	PermissionDefaultMode,
	ThinkingLevelDescriptor,
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
	/**
	 * Provider id of the active session. Drives the leftmost icon-only
	 * chip (the agent identifier in the toolbar). When omitted the chip
	 * falls back to the generic robot codicon.
	 */
	readonly providerId?: string;
	/** Display name shown as the provider chip's tooltip + a11y label. */
	readonly providerDisplayName?: string;
	/**
	 * Thinking levels reported by the agent for this session. Empty /
	 * undefined hides the chip.
	 */
	readonly availableThinkingLevels?: readonly ThinkingLevelDescriptor[];
	readonly selectedThinkingLevelId?: string;
	readonly onChangeThinkingLevel?: (id: string) => void;
	/** Agent roles reported by the agent for this session. */
	readonly availableAgentRoles?: readonly AgentRoleDescriptor[];
	readonly selectedAgentRoleId?: string;
	readonly onChangeAgentRole?: (id: string) => void;
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
	providerId,
	providerDisplayName,
	availableThinkingLevels,
	selectedThinkingLevelId,
	onChangeThinkingLevel,
	availableAgentRoles,
	selectedAgentRoleId,
	onChangeAgentRole,
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
						{providerId ? (
							<ProviderIconChip
								displayName={providerDisplayName ?? providerId}
								providerId={providerId}
							/>
						) : null}
						<ModelChip
							availableModels={availableModels}
							currentModelId={currentModelId}
							loading={Boolean(modelsLoading)}
							modelLabel={modelLabel}
							onChange={onChangeModel}
							onRefresh={onRefreshModels}
						/>
						<ThinkingChip
							onChange={onChangeThinkingLevel}
							options={availableThinkingLevels}
							value={selectedThinkingLevelId}
						/>
						<AgentRoleChip
							onChange={onChangeAgentRole}
							options={availableAgentRoles}
							value={selectedAgentRoleId}
						/>
						<PermissionChip
							onChange={onChangePermissionDefault}
							value={permissionDefault}
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
								<i aria-hidden="true" className="codicon codicon-arrow-up" />
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

interface ProviderIconChipProps {
	readonly providerId: string;
	readonly displayName: string;
}

/**
 * Icon-only chip identifying the active provider on the InputBar
 * toolbar. Mirrors the leftmost element of the second reference image
 * (`@ Gemini 3 Flash`) — we only render the agent's logo glyph because
 * the model chip immediately to its right already carries the textual
 * label the user cares about.
 *
 * Today the chip is non-interactive (an active session is locked to
 * its spawned provider). It still uses the same chrome as the rest of
 * the chips so the row reads as a single coherent toolbar.
 */
function ProviderIconChip({
	providerId,
	displayName,
}: ProviderIconChipProps): JSX.Element {
	return (
		<span className="agent-chat-chip" title={displayName}>
			<button
				aria-label={`Provider: ${displayName}`}
				className="agent-chat-chip__toggle"
				disabled
				type="button"
			>
				<i
					aria-hidden="true"
					className={`codicon ${providerIconClass(providerId)}`}
				/>
			</button>
		</span>
	);
}

interface ThinkingChipProps {
	readonly options: readonly ThinkingLevelDescriptor[] | undefined;
	readonly value: string | undefined;
	readonly onChange: ((id: string) => void) | undefined;
}

/**
 * Wraps {@link ChipDropdown} with the on-session thinking-level
 * contract: hide entirely when the agent did not surface any tier and
 * defer to the bridge handler when the user picks a new value.
 */
function ThinkingChip({
	options,
	value,
	onChange,
}: ThinkingChipProps): JSX.Element | null {
	const dropdownOptions = useMemo<readonly ChipDropdownOption<string>[]>(() => {
		if (!options) {
			return [];
		}
		return options.map((level) => ({
			value: level.id,
			label: level.displayName,
			description: level.description,
			icon: "codicon-pulse",
		}));
	}, [options]);
	if (!options || options.length === 0) {
		return null;
	}
	const active = options.find((o) => o.id === value);
	return (
		<ChipDropdown
			ariaPrefix="Thinking"
			currentLabel={active?.displayName ?? options[0].displayName}
			disabled={!onChange}
			icon="codicon-pulse"
			onChange={(next) => onChange?.(next)}
			options={dropdownOptions}
			value={value}
		/>
	);
}

interface AgentRoleChipProps {
	readonly options: readonly AgentRoleDescriptor[] | undefined;
	readonly value: string | undefined;
	readonly onChange: ((id: string) => void) | undefined;
}

function AgentRoleChip({
	options,
	value,
	onChange,
}: AgentRoleChipProps): JSX.Element | null {
	const dropdownOptions = useMemo<readonly ChipDropdownOption<string>[]>(() => {
		if (!options) {
			return [];
		}
		return options.map((role) => ({
			value: role.id,
			label: role.displayName,
			description: role.description,
			icon: "codicon-shield",
		}));
	}, [options]);
	if (!options || options.length === 0) {
		return null;
	}
	const active = options.find((o) => o.id === value);
	return (
		<ChipDropdown
			ariaPrefix="Agent role"
			currentLabel={active?.displayName ?? options[0].displayName}
			disabled={!onChange}
			icon="codicon-shield"
			onChange={(next) => onChange?.(next)}
			options={dropdownOptions}
			value={value}
		/>
	);
}
