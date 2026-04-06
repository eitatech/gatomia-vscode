import { VSCodeSelect } from "@/components/ui/vscode-select";

interface AgentTypeSelectorProps {
	value?: "local" | "background";
	onChange: (type: "local" | "background" | undefined) => void;
	disabled?: boolean;
}

/**
 * AgentTypeSelector - Dropdown for selecting agent execution type
 *
 * Allows manual override of automatic agent type detection:
 * - "local" - In-process execution via GitHub Copilot Chat
 * - "background" - External CLI/process execution
 * - undefined - Use automatic detection from agent registry
 */
export function AgentTypeSelector({
	value,
	onChange,
	disabled = false,
}: AgentTypeSelectorProps) {
	return (
		<div className="flex flex-col gap-2">
			<label
				className="font-medium text-[color:var(--vscode-foreground)] text-sm"
				htmlFor="agent-type-selector"
			>
				Agent Type
			</label>
			<VSCodeSelect
				disabled={disabled}
				id="agent-type-selector"
				onChange={(e) => {
					const target = e.target as HTMLSelectElement;
					const newValue = target.value;
					if (newValue === "") {
						onChange(undefined);
					} else {
						onChange(newValue as "local" | "background");
					}
				}}
				value={value || ""}
			>
				<option value="">Auto-detect (recommended)</option>
				<option value="local">Local Agent (in-process)</option>
				<option value="background">Background Agent (CLI)</option>
			</VSCodeSelect>
			<p className="text-[color:var(--vscode-descriptionForeground)] text-xs">
				{value
					? "Manual override: Agent will execute as selected type"
					: "Automatic: Type determined from agent source"}
			</p>
		</div>
	);
}
