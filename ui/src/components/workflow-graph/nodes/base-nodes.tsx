import { Handle, Position } from "@xyflow/react";
import type React from "react";
import { StatusBadge } from "../../workflow";

interface BaseNodeProps {
	data: {
		label: string;
		status?: "draft" | "active" | "error" | "success";
		description?: string;
	};
	selected?: boolean;
}

function BaseNode({
	title,
	data,
	selected,
	children,
	isSource,
	isTarget,
}: BaseNodeProps & {
	title: string;
	children?: React.ReactNode;
	isSource?: boolean;
	isTarget?: boolean;
}) {
	return (
		<div
			className={`min-w-[200px] rounded-[var(--workflow-panel-radius)] border bg-[var(--workflow-panel-background)] px-4 py-3 shadow-sm transition-colors${selected ? "border-[color:var(--vscode-focusBorder)] ring-1 ring-[color:var(--vscode-focusBorder)]" : "border-[color:var(--workflow-panel-border-color)]"}
			`}
		>
			{isTarget && (
				<Handle
					className="!bg-[color:var(--vscode-focusBorder)]"
					position={Position.Top}
					type="target"
				/>
			)}

			<div className="flex items-start justify-between gap-3">
				<div>
					<p className="font-semibold text-[color:var(--vscode-descriptionForeground)] text-xs uppercase tracking-wider">
						{title}
					</p>
					<p className="mt-1 font-medium text-[color:var(--vscode-foreground)] text-sm">
						{data.label}
					</p>
					{data.description && (
						<p className="mt-1 max-w-[200px] truncate text-[color:var(--vscode-descriptionForeground)] text-xs">
							{data.description}
						</p>
					)}
				</div>
				{data.status && <StatusBadge status={data.status} />}
			</div>

			{children && <div className="mt-3">{children}</div>}

			{isSource && (
				<Handle
					className="!bg-[color:var(--vscode-focusBorder)]"
					position={Position.Bottom}
					type="source"
				/>
			)}
		</div>
	);
}

export function ActionNode(props: BaseNodeProps) {
	return <BaseNode title="Action" {...props} isSource isTarget />;
}

export function SourceNode(props: BaseNodeProps) {
	return <BaseNode title="Source" {...props} isSource />;
}

export function ConditionNode(props: BaseNodeProps) {
	return <BaseNode title="Condition" {...props} isSource isTarget />;
}

export function ScheduleNode(props: BaseNodeProps) {
	return <BaseNode title="Schedule" {...props} isSource />;
}
