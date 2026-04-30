import type { ElementType, HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type PanelSectionVariant = "default" | "muted" | "elevated";
type PanelSectionPadding = "compact" | "default" | "relaxed";

const VARIANT_CLASSES: Record<PanelSectionVariant, string> = {
	default: "bg-[color:var(--workflow-panel-background)]",
	muted: "bg-[color:var(--workflow-panel-muted-background)]",
	elevated:
		"bg-[color:var(--workflow-panel-background)] [box-shadow:var(--workflow-elevation-1)]",
};

const PADDING_CLASSES: Record<PanelSectionPadding, string> = {
	compact: "p-3",
	default: "p-4",
	relaxed: "px-5 py-4",
};

export interface PanelSectionProps
	extends Omit<HTMLAttributes<HTMLElement>, "title"> {
	as?: ElementType;
	title?: ReactNode;
	description?: ReactNode;
	actions?: ReactNode;
	contentClassName?: string;
	variant?: PanelSectionVariant;
	padding?: PanelSectionPadding;
}

export function PanelSection({
	actions,
	as,
	children,
	className,
	contentClassName,
	description,
	padding = "default",
	title,
	variant = "default",
	...props
}: PanelSectionProps): JSX.Element {
	const Component = (as ?? "section") as ElementType;
	const hasHeader = title || description || actions;

	return (
		<Component
			className={cn(
				"rounded-[var(--workflow-panel-radius)] border border-[color:var(--workflow-panel-border-color)] text-[color:var(--vscode-foreground)]",
				VARIANT_CLASSES[variant],
				PADDING_CLASSES[padding],
				className
			)}
			{...props}
		>
			{hasHeader ? (
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div className="min-w-0 flex-1">
						{title ? (
							<div className="font-semibold text-sm">{title}</div>
						) : null}
						{description ? (
							<p className="mt-1 text-[color:var(--vscode-descriptionForeground)] text-sm">
								{description}
							</p>
						) : null}
					</div>
					{actions ? (
						<div className="flex shrink-0 items-center gap-2">{actions}</div>
					) : null}
				</div>
			) : null}
			<div className={cn(hasHeader ? "mt-3" : null, contentClassName)}>
				{children}
			</div>
		</Component>
	);
}
