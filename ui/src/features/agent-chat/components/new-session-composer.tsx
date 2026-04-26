/**
 * NewSessionComposer — empty-state composer used when no session is bound.
 *
 * Combines the {@link PickerBar} (provider · model · agent file) with a
 * textarea + submit button. On submit, dispatches `startNewSession` with
 * the selected catalogue triple.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { PermissionToggle } from "./permission-toggle";
import { PickerBar, type PickerBarSelection } from "./picker-bar";
import type {
	AgentChatAgentFileOption,
	AgentChatProviderOption,
	NewSessionRequest,
	PermissionDefaultMode,
} from "@/features/agent-chat/types";

interface NewSessionComposerProps {
	readonly providers: readonly AgentChatProviderOption[];
	readonly agentFiles: readonly AgentChatAgentFileOption[];
	readonly onStart: (request: NewSessionRequest) => void;
	/**
	 * Current `gatomia.acp.permissionDefault` value forwarded by the
	 * bridge. `undefined` until the host echoes the first
	 * `permission-default/changed` payload — the toggle treats that
	 * state as the implicit `"ask"` default.
	 */
	readonly permissionDefault: PermissionDefaultMode | undefined;
	/**
	 * Persists the segmented-control selection through the bridge so the
	 * setting survives a window reload and the host hot-reloads the
	 * cached `AcpClient` permission strategy.
	 */
	readonly onChangePermissionDefault: (mode: PermissionDefaultMode) => void;
}

export function NewSessionComposer({
	providers,
	agentFiles,
	onStart,
	permissionDefault,
	onChangePermissionDefault,
}: NewSessionComposerProps): JSX.Element {
	const defaultProviderId = useMemo(
		() => providers.find((p) => p.enabled)?.id,
		[providers]
	);
	const defaultProvider = useMemo(
		() => providers.find((p) => p.id === defaultProviderId),
		[providers, defaultProviderId]
	);

	const [selection, setSelection] = useState<PickerBarSelection>({
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

	const [prompt, setPrompt] = useState("");

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

	return (
		<div className="agent-chat-new-session">
			<div className="agent-chat-new-session__intro">
				<h2 className="agent-chat-new-session__title">Start a new chat</h2>
				<p className="agent-chat-new-session__hint">
					Pick an agent, model, and optional agent file, then describe what you
					want it to do.
				</p>
			</div>
			<PickerBar
				agentFiles={agentFiles}
				onChange={setSelection}
				providers={providers}
				selection={selection}
			/>
			<PermissionToggle
				onChange={onChangePermissionDefault}
				value={permissionDefault}
			/>
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
				rows={5}
				value={prompt}
			/>
			<div className="agent-chat-new-session__actions">
				<span className="agent-chat-new-session__hint-secondary">
					⌘/Ctrl + Enter to start
				</span>
				<button
					className="agent-chat-new-session__submit"
					disabled={!canSubmit}
					onClick={handleSubmit}
					type="button"
				>
					Start chat
				</button>
			</div>
		</div>
	);
}
