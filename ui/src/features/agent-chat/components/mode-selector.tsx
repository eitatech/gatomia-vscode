/**
 * ModeSelector (T061).
 *
 * Renders a compact `<select>` over the resolved modes. Hidden entirely when
 * no modes are available (capabilities `source === "none"` path).
 */

import type { ModeDescriptor } from "@/features/agent-chat/types";

interface ModeSelectorProps {
	readonly availableModes: readonly ModeDescriptor[];
	readonly selectedModeId: string | undefined;
	readonly onChange: (modeId: string) => void;
}

export function ModeSelector({
	availableModes,
	selectedModeId,
	onChange,
}: ModeSelectorProps): JSX.Element | null {
	if (availableModes.length === 0) {
		return null;
	}
	return (
		<label className="agent-chat-mode-selector">
			<span className="agent-chat-mode-selector__label">Mode</span>
			<select
				className="agent-chat-mode-selector__select"
				onChange={(event) => {
					onChange(event.target.value);
				}}
				value={selectedModeId ?? ""}
			>
				{availableModes.map((mode) => (
					<option key={mode.id} value={mode.id}>
						{mode.displayName}
					</option>
				))}
			</select>
		</label>
	);
}
