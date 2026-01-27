import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { vscode } from "@/bridge/vscode";

interface Agent {
	id: string;
	name: string;
	displayName: string;
	description: string;
}

interface GroupedAgents {
	local: Agent[];
	background: Agent[];
}

interface AgentDropdownProps {
	selectedAgentId?: string;
	onAgentSelect: (agentId: string) => void;
	className?: string;
}

/**
 * AgentDropdown - Dropdown component for selecting custom agents
 * Requests agent list from extension on mount and displays grouped agents
 */
export function AgentDropdown({
	selectedAgentId,
	onAgentSelect,
	className,
}: AgentDropdownProps): JSX.Element {
	const [agents, setAgents] = useState<GroupedAgents>({
		local: [],
		background: [],
	});
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		// Request agent list from extension
		vscode.postMessage({
			command: "hooks.agents-list",
			type: "hooks/agents-list",
			data: { forceRefresh: false },
		});

		// Listen for agent list response and real-time updates
		// The extension will send updates when:
		// - Initial agent list is loaded
		// - Agent files are added/modified/deleted (.agent.md files)
		// - Extensions are installed/uninstalled
		const handleMessage = (event: MessageEvent) => {
			const msg = event.data;

			if (
				msg.command === "hooks.agents-list" ||
				msg.type === "hooks/agents-list"
			) {
				setAgents(msg.data);
				setLoading(false);
			}

			if (
				msg.command === "hooks.agents-error" ||
				msg.type === "hooks/agents-error"
			) {
				setError(msg.data?.message || "Failed to load agents");
				setLoading(false);
			}
		};

		window.addEventListener("message", handleMessage);
		return () => window.removeEventListener("message", handleMessage);
	}, []);

	const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
		const value = event.target.value;
		if (value) {
			onAgentSelect(value);
		}
	};

	if (loading) {
		return (
			<select
				className={cn(
					"w-full rounded px-2 py-1.5 text-sm",
					"bg-[var(--vscode-dropdown-background)]",
					"text-[var(--vscode-dropdown-foreground)]",
					"border border-[var(--vscode-dropdown-border)]",
					"focus:outline-none focus:ring-1",
					"focus:ring-[var(--vscode-focusBorder)]",
					"cursor-wait",
					className
				)}
				disabled
			>
				<option>Loading agents...</option>
			</select>
		);
	}

	if (error) {
		return (
			<select
				className={cn(
					"w-full rounded px-2 py-1.5 text-sm",
					"bg-[var(--vscode-dropdown-background)]",
					"text-[var(--vscode-dropdown-foreground)]",
					"border border-[var(--vscode-dropdown-border)]",
					"focus:outline-none focus:ring-1",
					"focus:ring-[var(--vscode-focusBorder)]",
					className
				)}
				disabled
			>
				<option>{error}</option>
			</select>
		);
	}

	const hasAgents = agents.local.length > 0 || agents.background.length > 0;

	if (!hasAgents) {
		return (
			<select
				className={cn(
					"w-full rounded px-2 py-1.5 text-sm",
					"bg-[var(--vscode-dropdown-background)]",
					"text-[var(--vscode-dropdown-foreground)]",
					"border border-[var(--vscode-dropdown-border)]",
					"focus:outline-none focus:ring-1",
					"focus:ring-[var(--vscode-focusBorder)]",
					className
				)}
				disabled
			>
				<option>No agents found</option>
			</select>
		);
	}

	return (
		<select
			className={cn(
				"w-full rounded px-2 py-1.5 text-sm",
				"bg-[var(--vscode-dropdown-background)]",
				"text-[var(--vscode-dropdown-foreground)]",
				"border border-[var(--vscode-dropdown-border)]",
				"hover:bg-[var(--vscode-dropdown-listBackground)]",
				"focus:outline-none focus:ring-1",
				"focus:ring-[var(--vscode-focusBorder)]",
				"cursor-pointer",
				className
			)}
			onChange={handleChange}
			value={selectedAgentId || ""}
		>
			<option value="">Select an agent...</option>

			{/* Local Agents Group */}
			{agents.local.length > 0 && (
				<optgroup label="Local Agents">
					{agents.local.map((agent) => (
						<option key={agent.id} title={agent.description} value={agent.id}>
							{agent.displayName}
						</option>
					))}
				</optgroup>
			)}

			{/* Background Agents Group */}
			{agents.background.length > 0 && (
				<optgroup label="Background Agents">
					{agents.background.map((agent) => (
						<option key={agent.id} title={agent.description} value={agent.id}>
							{agent.displayName}
						</option>
					))}
				</optgroup>
			)}
		</select>
	);
}
