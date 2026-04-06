import { VSCodeCheckbox } from "@/components/ui/vscode-checkbox";
import type { KnownAgentStatus } from "../types";

export interface AcpKnownAgentsPanelProps {
	agents: KnownAgentStatus[];
	disabled?: boolean;
	onToggle: (agentId: string, enabled: boolean) => void;
}

export const AcpKnownAgentsPanel = ({
	agents,
	disabled,
	onToggle,
}: AcpKnownAgentsPanelProps) => {
	if (agents.length === 0) {
		return null;
	}

	return (
		<ul className="m-0 flex list-none flex-col gap-2 p-0">
			{agents.map((agent) => (
				<li className="flex items-center gap-2" key={agent.id}>
					<VSCodeCheckbox
						checked={agent.enabled}
						disabled={disabled}
						id={`known-agent-${agent.id}`}
						label={agent.displayName}
						onChange={(e) => {
							onToggle(agent.id, e.target.checked);
						}}
					/>
					<span
						className={
							agent.isDetected
								? "text-[color:var(--vscode-testing-iconPassed)] text-xs"
								: "text-[color:var(--vscode-descriptionForeground)] text-xs"
						}
						data-testid={`detected-${agent.id}`}
					>
						{agent.isDetected ? "Detected" : "Not installed"}
					</span>
				</li>
			))}
		</ul>
	);
};
