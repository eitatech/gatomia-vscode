import { useMemo, useState } from "react";
import type { ActionType, Hook, HookExecutionStatusEntry } from "../types";
import { HookListItem } from "./hook-list-item";

interface HooksListProps {
	hooks: Hook[];
	isLoading: boolean;
	onToggle: (id: string, enabled: boolean) => void;
	onDelete: (id: string) => void;
	onEdit: (hook: Hook) => void;
	executionStatuses: Record<string, HookExecutionStatusEntry>;
}

export const HooksList = ({
	executionStatuses,
	hooks,
	isLoading,
	onToggle,
	onDelete,
	onEdit,
}: HooksListProps) => {
	const [expandedGroups, setExpandedGroups] = useState<Set<ActionType>>(
		() => new Set<ActionType>(ACTION_GROUPS.map((group) => group.type))
	);

	const grouped = useMemo(
		() =>
			ACTION_GROUPS.map((group) => ({
				...group,
				hooks: hooks.filter(
					(hook) => hook.action.type === group.type
				) as Hook[],
			})),
		[hooks]
	);

	const toggleGroup = (type: ActionType) => {
		setExpandedGroups((prev) => {
			const next = new Set(prev);
			if (next.has(type)) {
				next.delete(type);
			} else {
				next.add(type);
			}
			return next;
		});
	};

	if (isLoading) {
		return (
			<div className="flex items-center justify-center py-8 text-[color:var(--vscode-descriptionForeground)] text-sm">
				Loading hooks...
			</div>
		);
	}

	if (hooks.length === 0) {
		return (
			<div className="flex flex-col items-center justify-center gap-2 py-8">
				<p className="text-[color:var(--vscode-descriptionForeground)] text-sm">
					No hooks configured
				</p>
				<p className="text-[color:var(--vscode-descriptionForeground)] text-xs">
					Click "Add Hook" to create your first automation
				</p>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-3" role="tree">
			{grouped.map((group) => {
				const expanded = expandedGroups.has(group.type);
				return (
					<div
						aria-expanded={expanded}
						className="rounded border border-[color:color-mix(in_srgb,var(--vscode-foreground)_12%,transparent)] bg-[color:color-mix(in_srgb,var(--vscode-editor-background)_90%,#000000_10%)]"
						key={group.type}
						role="treeitem"
						tabIndex={0}
					>
						<button
							className="flex w-full items-center justify-between gap-3 border-[color:color-mix(in_srgb,var(--vscode-foreground)_10%,transparent)] border-b px-3 py-2 text-left"
							onClick={() => toggleGroup(group.type)}
							type="button"
						>
							<div className="flex items-center gap-2">
								<span
									aria-hidden="true"
									className={`codicon ${
										expanded ? "codicon-chevron-down" : "codicon-chevron-right"
									} text-[color:var(--vscode-foreground)]`}
								/>
								<div className="flex flex-col gap-0.5">
									<span className="font-semibold text-[color:var(--vscode-foreground)] text-sm">
										{group.title}
									</span>
									<span className="text-[color:var(--vscode-descriptionForeground)] text-xs">
										{group.description}
									</span>
								</div>
							</div>
							<span className="rounded-full bg-[color:var(--vscode-badge-background)] px-2 py-0.5 font-medium text-[color:var(--vscode-badge-foreground)] text-xs">
								{group.hooks.length}{" "}
								{group.hooks.length === 1 ? "hook" : "hooks"}
							</span>
						</button>

						{expanded && (
							<fieldset
								aria-label={group.title}
								className="border-0 border-[color:color-mix(in_srgb,var(--vscode-foreground)_15%,transparent)] border-l pl-3"
							>
								{group.hooks.length > 0 ? (
									group.hooks.map((hook) => (
										<div
											aria-level={2}
											className="mt-2 first:mt-3"
											key={hook.id}
											role="treeitem"
											tabIndex={0}
										>
											<HookListItem
												executionStatus={executionStatuses[hook.id]}
												hook={hook}
												onDelete={onDelete}
												onEdit={onEdit}
												onToggle={onToggle}
											/>
										</div>
									))
								) : (
									<p className="px-3 py-4 text-[color:var(--vscode-descriptionForeground)] text-xs">
										No hooks configured for this action type yet.
									</p>
								)}
							</fieldset>
						)}
					</div>
				);
			})}
		</div>
	);
};

const ACTION_GROUPS: Array<{
	type: ActionType;
	title: string;
	description: string;
}> = [
	{
		type: "agent",
		title: "Agent Commands",
		description:
			"Automatically trigger SpecKit or OpenSpec commands after workflows complete.",
	},
	{
		type: "git",
		title: "Git Operations",
		description:
			"Commit or push code using templated messages tied to repository context.",
	},
	{
		type: "github",
		title: "GitHub Tools",
		description:
			"Open issues, PRs, or comments via the GitHub Model Context Protocol integration.",
	},
	{
		type: "custom",
		title: "Custom Agents",
		description:
			"Chain workspace-specific automations or external agents using arguments and templates.",
	},
	{
		type: "mcp",
		title: "Custom Tools",
		description:
			"Execute custom MCP tools with natural language instructions using GitHub Copilot models.",
	},
];
