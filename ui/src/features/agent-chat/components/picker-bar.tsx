/**
 * PickerBar — three-up selector row (provider · model · agent file).
 *
 * Used in two contexts:
 *   1. Empty/new-session state: picks dictate the spawn parameters, and
 *      the trio is shown above the composer textarea.
 *   2. Active session footer: read-only display of the bound session's
 *      provider/model + the user's optional agent-file preset for the next
 *      turn.
 */

import { useCallback, useMemo } from "react";
import type {
	AgentChatAgentFileOption,
	AgentChatProviderOption,
	ModelDescriptor,
} from "@/features/agent-chat/types";

export interface PickerBarSelection {
	readonly providerId: string | undefined;
	readonly modelId: string | undefined;
	readonly agentFileId: string | undefined;
}

interface PickerBarProps {
	readonly providers: readonly AgentChatProviderOption[];
	readonly agentFiles: readonly AgentChatAgentFileOption[];
	readonly selection: PickerBarSelection;
	readonly onChange: (next: PickerBarSelection) => void;
	readonly disabled?: boolean;
	/**
	 * Per-provider in-flight probe markers — when
	 * `modelsLoading[providerId]` is `true`, the model `<select>`
	 * renders a "Loading models…" placeholder and is disabled.
	 */
	readonly modelsLoading?: Readonly<Record<string, boolean>>;
}

export function PickerBar({
	providers,
	agentFiles,
	selection,
	onChange,
	disabled,
	modelsLoading,
}: PickerBarProps): JSX.Element {
	const selectedProvider = useMemo(
		() => providers.find((p) => p.id === selection.providerId),
		[providers, selection.providerId]
	);

	const models = selectedProvider?.models ?? [];
	const isLoadingModels = Boolean(
		selection.providerId && modelsLoading?.[selection.providerId]
	);

	const handleProvider = useCallback(
		(providerId: string) => {
			const next = providers.find((p) => p.id === providerId);
			const fallbackModel = next?.models[0]?.id;
			onChange({
				providerId,
				modelId: fallbackModel,
				agentFileId: selection.agentFileId,
			});
		},
		[providers, onChange, selection.agentFileId]
	);

	const handleModel = useCallback(
		(modelId: string) => {
			onChange({
				providerId: selection.providerId,
				modelId,
				agentFileId: selection.agentFileId,
			});
		},
		[onChange, selection.providerId, selection.agentFileId]
	);

	const handleAgentFile = useCallback(
		(agentFileId: string) => {
			onChange({
				providerId: selection.providerId,
				modelId: selection.modelId,
				agentFileId: agentFileId === "__none__" ? undefined : agentFileId,
			});
		},
		[onChange, selection.providerId, selection.modelId]
	);

	return (
		<div className="agent-chat-picker">
			<label className="agent-chat-picker__field">
				<span className="agent-chat-picker__label">Agent</span>
				<select
					className="agent-chat-picker__select"
					disabled={disabled || providers.length === 0}
					onChange={(e) => handleProvider(e.target.value)}
					value={selection.providerId ?? ""}
				>
					<option disabled value="">
						{providers.length === 0
							? "No providers available"
							: "Select a provider"}
					</option>
					{providers.map((provider) => (
						<option
							disabled={!provider.enabled}
							key={provider.id}
							value={provider.id}
						>
							{providerLabel(provider)}
						</option>
					))}
				</select>
			</label>

			{renderModelField({
				disabled,
				isLoadingModels,
				models,
				selection,
				onChange: handleModel,
			})}

			<label className="agent-chat-picker__field">
				<span className="agent-chat-picker__label">Agent file</span>
				<select
					className="agent-chat-picker__select"
					disabled={disabled}
					onChange={(e) => handleAgentFile(e.target.value)}
					value={selection.agentFileId ?? "__none__"}
				>
					<option value="__none__">None</option>
					{agentFiles.map((file) => (
						<option key={file.id} value={file.id}>
							{file.displayName}
						</option>
					))}
				</select>
			</label>
		</div>
	);
}

function providerLabel(provider: AgentChatProviderOption): string {
	switch (provider.availability) {
		case "installed":
			return provider.displayName;
		case "available-via-npx":
			return `${provider.displayName} (via npx)`;
		case "install-required":
			return `${provider.displayName} (install required)`;
		default:
			return provider.displayName;
	}
}

interface ModelFieldProps {
	readonly disabled: boolean | undefined;
	readonly isLoadingModels: boolean;
	readonly models: readonly ModelDescriptor[];
	readonly selection: PickerBarSelection;
	readonly onChange: (modelId: string) => void;
}

/**
 * Render the model `<select>`. When the active provider has no
 * surfaced models AND no probe is in flight, the field is hidden
 * entirely so the picker degrades gracefully (per the redesign:
 * "no models => no select"). The loading branch keeps the field
 * visible with a placeholder so the user has visual feedback.
 */
function renderModelField({
	disabled,
	isLoadingModels,
	models,
	selection,
	onChange,
}: ModelFieldProps): JSX.Element | null {
	if (!isLoadingModels && models.length === 0) {
		return null;
	}
	return (
		<label className="agent-chat-picker__field">
			<span className="agent-chat-picker__label">Model</span>
			<select
				className="agent-chat-picker__select"
				disabled={disabled || isLoadingModels || models.length === 0}
				onChange={(e) => onChange(e.target.value)}
				value={selection.modelId ?? ""}
			>
				<option disabled value="">
					{isLoadingModels ? "Loading models…" : "Select a model"}
				</option>
				{models.map((model) => (
					<option key={model.id} value={model.id}>
						{model.displayName}
					</option>
				))}
			</select>
		</label>
	);
}
