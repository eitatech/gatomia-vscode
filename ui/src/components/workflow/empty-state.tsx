import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface EmptyStateProps extends HTMLAttributes<HTMLDivElement> {
	title: ReactNode;
	description?: ReactNode;
	eyebrow?: ReactNode;
	actions?: ReactNode;
}

export function EmptyState({
	actions,
	children,
	className,
	description,
	eyebrow,
	title,
	...props
}: EmptyStateProps): JSX.Element {
	return (
		<div
			className={cn(
				"rounded-[var(--workflow-panel-radius)] border border-[color:var(--workflow-panel-border-color)] border-dashed bg-[color:var(--workflow-panel-subtle-background)] px-4 py-8 text-center",
				className
			)}
			{...props}
		>
			{eyebrow ? (
				<div className="text-[color:var(--vscode-descriptionForeground)] text-xs uppercase tracking-[0.16em]">
					{eyebrow}
				</div>
			) : null}
			<div className={cn(eyebrow ? "mt-2" : null, "font-medium text-base")}>
				{title}
			</div>
			{description ? (
				<p className="mt-2 text-[color:var(--vscode-descriptionForeground)] text-sm">
					{description}
				</p>
			) : null}
			{children ? <div className="mt-3">{children}</div> : null}
			{actions ? (
				<div className="mt-4 flex justify-center gap-2">{actions}</div>
			) : null}
		</div>
	);
}
