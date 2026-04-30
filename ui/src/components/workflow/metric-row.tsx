import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface MetricRowProps extends HTMLAttributes<HTMLDivElement> {
	label: ReactNode;
	value: ReactNode;
	helper?: ReactNode;
}

export function MetricRow({
	className,
	helper,
	label,
	value,
	...props
}: MetricRowProps): JSX.Element {
	return (
		<div
			className={cn(
				"flex min-h-[var(--workflow-density-compact-min-height)] items-start justify-between gap-3 rounded-md border border-[color:var(--workflow-panel-border-color)] bg-[color:var(--workflow-panel-subtle-background)] px-3 py-2",
				className
			)}
			{...props}
		>
			<div className="min-w-0 flex-1">
				<div className="text-[color:var(--vscode-descriptionForeground)] text-xs uppercase tracking-wide">
					{label}
				</div>
				{helper ? (
					<div className="mt-1 text-[color:var(--vscode-descriptionForeground)] text-xs">
						{helper}
					</div>
				) : null}
			</div>
			<div className="text-right font-medium text-sm">{value}</div>
		</div>
	);
}
