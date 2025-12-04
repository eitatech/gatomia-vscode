import type { Hook, HookExecutionStatusEntry } from "../types";
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
		<div className="flex flex-col gap-2">
			{hooks.map((hook) => (
				<HookListItem
					executionStatus={executionStatuses[hook.id]}
					hook={hook}
					key={hook.id}
					onDelete={onDelete}
					onEdit={onEdit}
					onToggle={onToggle}
				/>
			))}
		</div>
	);
};
