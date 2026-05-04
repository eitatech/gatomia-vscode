/**
 * ModelSelector (T062).
 *
 * Mirrors `ModeSelector`: a compact `<select>` over the resolved models.
 * Hidden when no models are available.
 */

import type { ModelDescriptor } from "@/features/agent-chat/types";

interface ModelSelectorProps {
	readonly availableModels: readonly ModelDescriptor[];
	readonly selectedModelId: string | undefined;
	readonly onChange: (modelId: string) => void;
}

export function ModelSelector({
	availableModels,
	selectedModelId,
	onChange,
}: ModelSelectorProps): JSX.Element | null {
	if (availableModels.length === 0) {
		return null;
	}
	return (
		<label className="agent-chat-model-selector">
			<span className="agent-chat-model-selector__label">Model</span>
			<select
				className="agent-chat-model-selector__select"
				onChange={(event) => {
					onChange(event.target.value);
				}}
				value={selectedModelId ?? ""}
			>
				{availableModels.map((model) => (
					<option key={model.id} value={model.id}>
						{model.displayName}
					</option>
				))}
			</select>
		</label>
	);
}
