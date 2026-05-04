/**
 * TargetSelector (T063).
 *
 * Renders a compact `<select>` over available execution targets. When the
 * Cloud option is disabled (no provider configured), the option itself is
 * disabled AND a hint with the `disabledReason` is shown below the select so
 * the user understands why and how to fix it (FR-017).
 */

import type {
	ExecutionTarget,
	ExecutionTargetOption,
} from "@/features/agent-chat/types";

interface TargetSelectorProps {
	readonly availableTargets: readonly ExecutionTargetOption[];
	readonly selectedTargetKind: ExecutionTarget["kind"];
	readonly onChange: (kind: ExecutionTarget["kind"]) => void;
}

export function TargetSelector({
	availableTargets,
	selectedTargetKind,
	onChange,
}: TargetSelectorProps): JSX.Element | null {
	if (availableTargets.length === 0) {
		return null;
	}
	const disabledHints = availableTargets
		.filter((option) => !option.enabled && option.disabledReason)
		.map((option) => option.disabledReason);
	return (
		<label className="agent-chat-target-selector">
			<span className="agent-chat-target-selector__label">
				Execution target
			</span>
			<select
				className="agent-chat-target-selector__select"
				onChange={(event) => {
					onChange(event.target.value as ExecutionTarget["kind"]);
				}}
				value={selectedTargetKind}
			>
				{availableTargets.map((option) => (
					<option
						disabled={!option.enabled}
						key={option.kind}
						value={option.kind}
					>
						{option.label}
					</option>
				))}
			</select>
			{disabledHints.map((hint) => (
				<span className="agent-chat-target-selector__disabled-hint" key={hint}>
					{hint}
				</span>
			))}
		</label>
	);
}
