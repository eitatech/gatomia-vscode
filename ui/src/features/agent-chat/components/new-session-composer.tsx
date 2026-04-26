/**
 * NewSessionComposer — empty-state composer used when no session is bound.
 *
 * Visual layout (Copilot Chat-inspired — chips on the bottom toolbar):
 *
 *   ┌────────────────────────────────────────────────────┐
 *   │ Describe the task you want the agent to start…     │  ← textarea
 *   │                                                    │
 *   ├────────────────────────────────────────────────────┤
 *   │ [Robot Agent▾][File AgentFile▾][Cpu Model▾]        │
 *   │ [Shield Auto▾]              [▶ Start chat]         │  ← bottom toolbar
 *   └────────────────────────────────────────────────────┘
 *
 * Every selector (Agent, Agent file, Model, Permission) renders as a
 * {@link ChipDropdown} so the composer mirrors the on-session
 * {@link InputBar} chrome and matches the user's request that all four
 * controls share the exact same visual treatment.
 *
 * On submit, dispatches `startNewSession` with the selected catalogue
 * triple. The {@link PermissionChip} persists the user's auto-approve
 * pick before the spawn so the very first turn already honours it.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChipDropdown, type ChipDropdownOption } from "./chip-dropdown";
import { ChipOverflowBar, type ChipOverflowItem } from "./chip-overflow-bar";
import { PermissionChip } from "./permission-chip";
import type {
	AgentChatAgentFileOption,
	AgentChatProviderOption,
	NewSessionRequest,
	PermissionDefaultMode,
} from "@/features/agent-chat/types";

const NO_AGENT_FILE_VALUE = "__none__";

interface NewSessionComposerProps {
	readonly providers: readonly AgentChatProviderOption[];
	readonly agentFiles: readonly AgentChatAgentFileOption[];
	readonly onStart: (request: NewSessionRequest) => void;
	/**
	 * Current `gatomia.acp.permissionDefault` value forwarded by the
	 * bridge. `undefined` until the host echoes the first
	 * `permission-default/changed` payload — the chip treats that
	 * state as the implicit `"ask"` default.
	 */
	readonly permissionDefault: PermissionDefaultMode | undefined;
	/**
	 * Persists the chip selection through the bridge so the setting
	 * survives a window reload and the host hot-reloads the cached
	 * `AcpClient` permission strategy.
	 */
	readonly onChangePermissionDefault: (mode: PermissionDefaultMode) => void;
	/**
	 * Per-provider in-flight probe markers fed back from the host. When
	 * `modelsLoading[providerId]` is `true`, the model chip shows a
	 * "Loading…" label and is non-interactive.
	 */
	readonly modelsLoading?: Readonly<Record<string, boolean>>;
	/**
	 * Trigger a model-catalogue probe for `providerId`. The composer
	 * fires this whenever the user picks a new provider (or when the
	 * default provider hydrates) so the model dropdown surfaces the
	 * agent-reported list as soon as it lands.
	 */
	readonly onProbeProviderModels?: (providerId: string) => void;
}

interface ComposerSelection {
	readonly providerId: string | undefined;
	readonly modelId: string | undefined;
	readonly agentFileId: string | undefined;
}

export function NewSessionComposer({
	providers,
	agentFiles,
	onStart,
	permissionDefault,
	onChangePermissionDefault,
	modelsLoading,
	onProbeProviderModels,
}: NewSessionComposerProps): JSX.Element {
	const defaultProviderId = useMemo(
		() => providers.find((p) => p.enabled)?.id,
		[providers]
	);
	const defaultProvider = useMemo(
		() => providers.find((p) => p.id === defaultProviderId),
		[providers, defaultProviderId]
	);

	const [selection, setSelection] = useState<ComposerSelection>({
		providerId: defaultProviderId,
		modelId: defaultProvider?.models[0]?.id,
		agentFileId: undefined,
	});

	// Keep the default in sync as the catalog hydrates after mount.
	useEffect(() => {
		if (selection.providerId) {
			return;
		}
		if (!defaultProviderId) {
			return;
		}
		setSelection({
			providerId: defaultProviderId,
			modelId: defaultProvider?.models[0]?.id,
			agentFileId: undefined,
		});
	}, [defaultProviderId, defaultProvider, selection.providerId]);

	// Whenever the selected provider changes, ask the host to (re-)probe
	// the agent for its model catalogue. The host invalidates its cache
	// and re-broadcasts `agent-chat/catalog/loaded` once the probe lands.
	useEffect(() => {
		const providerId = selection.providerId;
		if (!providerId) {
			return;
		}
		if (!onProbeProviderModels) {
			return;
		}
		onProbeProviderModels(providerId);
	}, [selection.providerId, onProbeProviderModels]);

	const [prompt, setPrompt] = useState("");

	const selectedProvider = useMemo(
		() => providers.find((p) => p.id === selection.providerId),
		[providers, selection.providerId]
	);
	const models = selectedProvider?.models ?? [];
	const selectedModel = models.find((m) => m.id === selection.modelId);
	const selectedAgentFile = agentFiles.find(
		(f) => f.id === selection.agentFileId
	);
	const isLoadingModels = Boolean(
		selection.providerId && modelsLoading?.[selection.providerId]
	);

	const providerOptions = useMemo<readonly ChipDropdownOption<string>[]>(
		() =>
			providers.map((provider) => ({
				value: provider.id,
				label: providerLabel(provider),
				description: providerDescription(provider),
				disabled: !provider.enabled,
				icon: "codicon-robot",
			})),
		[providers]
	);

	const agentFileOptions = useMemo<readonly ChipDropdownOption<string>[]>(
		() => [
			{
				value: NO_AGENT_FILE_VALUE,
				label: "None",
				description: "Spawn the agent without a custom AGENT.md preset.",
				icon: "codicon-circle-slash",
			},
			...agentFiles.map((file) => ({
				value: file.id,
				label: file.displayName,
				description: file.description,
				icon: "codicon-file-code",
			})),
		],
		[agentFiles]
	);

	const modelOptions = useMemo<readonly ChipDropdownOption<string>[]>(
		() =>
			models.map((model) => ({
				value: model.id,
				label: model.displayName,
				icon: "codicon-symbol-color",
			})),
		[models]
	);

	const handleProviderChange = useCallback(
		(providerId: string) => {
			const next = providers.find((p) => p.id === providerId);
			setSelection({
				providerId,
				modelId: next?.models[0]?.id,
				agentFileId: selection.agentFileId,
			});
		},
		[providers, selection.agentFileId]
	);

	const handleAgentFileChange = useCallback((agentFileId: string) => {
		setSelection((prev) => ({
			providerId: prev.providerId,
			modelId: prev.modelId,
			agentFileId:
				agentFileId === NO_AGENT_FILE_VALUE ? undefined : agentFileId,
		}));
	}, []);

	const handleModelChange = useCallback((modelId: string) => {
		setSelection((prev) => ({
			providerId: prev.providerId,
			modelId,
			agentFileId: prev.agentFileId,
		}));
	}, []);

	const canSubmit = Boolean(selection.providerId) && prompt.trim().length > 0;

	const handleSubmit = useCallback(() => {
		const providerId = selection.providerId;
		if (!providerId) {
			return;
		}
		const trimmed = prompt.trim();
		if (trimmed.length === 0) {
			return;
		}
		onStart({
			providerId,
			modelId: selection.modelId,
			agentFileId: selection.agentFileId,
			taskInstruction: trimmed,
		});
		setPrompt("");
	}, [selection, prompt, onStart]);

	const showModelChip = isLoadingModels || models.length > 0;
	const modelLabel = isLoadingModels
		? "Loading…"
		: (selectedModel?.displayName ?? "Default");

	const chipItems = useMemo<readonly ChipOverflowItem[]>(() => {
		const list: ChipOverflowItem[] = [
			{
				key: "agent",
				node: (
					<ChipDropdown
						ariaPrefix="Agent"
						currentLabel={
							selectedProvider ? selectedProvider.displayName : "Select agent"
						}
						icon="codicon-robot"
						onChange={handleProviderChange}
						options={providerOptions}
						value={selection.providerId}
					/>
				),
			},
			{
				key: "agent-file",
				node: (
					<ChipDropdown
						ariaPrefix="Agent file"
						currentLabel={selectedAgentFile?.displayName ?? "None"}
						icon="codicon-file-code"
						onChange={handleAgentFileChange}
						options={agentFileOptions}
						value={selection.agentFileId ?? NO_AGENT_FILE_VALUE}
					/>
				),
			},
		];
		if (showModelChip) {
			list.push({
				key: "model",
				node: (
					<ChipDropdown
						ariaPrefix="Model"
						currentLabel={modelLabel}
						disabled={isLoadingModels}
						icon="codicon-symbol-color"
						onChange={handleModelChange}
						options={modelOptions}
						value={selection.modelId}
					/>
				),
			});
		}
		list.push({
			key: "permission",
			node: (
				<PermissionChip
					onChange={onChangePermissionDefault}
					value={permissionDefault}
				/>
			),
		});
		return list;
	}, [
		selectedProvider,
		providerOptions,
		selection.providerId,
		selection.agentFileId,
		selection.modelId,
		selectedAgentFile,
		agentFileOptions,
		showModelChip,
		modelLabel,
		isLoadingModels,
		modelOptions,
		permissionDefault,
		handleProviderChange,
		handleAgentFileChange,
		handleModelChange,
		onChangePermissionDefault,
	]);

	return (
		<div className="agent-chat-new-session">
			<div className="agent-chat-new-session__box">
				<textarea
					className="agent-chat-new-session__textarea"
					onChange={(e) => setPrompt(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
							e.preventDefault();
							handleSubmit();
						}
					}}
					placeholder="Describe the task you want the agent to start with…"
					rows={4}
					value={prompt}
				/>
				<div className="agent-chat-new-session__toolbar">
					<div className="agent-chat-new-session__toolbar-left">
						<ChipOverflowBar items={chipItems} />
					</div>
					<div className="agent-chat-new-session__toolbar-right">
						<button
							aria-label="Start chat"
							className="agent-chat-new-session__submit"
							disabled={!canSubmit}
							onClick={handleSubmit}
							title="⌘/Ctrl + Enter to start"
							type="button"
						>
							<i aria-hidden="true" className="codicon codicon-arrow-up" />
						</button>
					</div>
				</div>
			</div>
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

function providerDescription(
	provider: AgentChatProviderOption
): string | undefined {
	if (provider.description) {
		return provider.description;
	}
	switch (provider.availability) {
		case "available-via-npx":
			return "Will be downloaded on demand via npx.";
		case "install-required":
			return "Install the CLI before using this agent.";
		default:
			return;
	}
}
