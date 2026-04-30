import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type ToolbarAlign = "start" | "between" | "end";
type ToolbarDensity = "compact" | "default";

const ALIGNMENT_CLASSES: Record<ToolbarAlign, string> = {
	start: "justify-start",
	between: "justify-between",
	end: "justify-end",
};

const DENSITY_CLASSES: Record<ToolbarDensity, string> = {
	compact: "gap-1.5",
	default: "gap-2",
};

export interface ActionToolbarProps extends HTMLAttributes<HTMLDivElement> {
	align?: ToolbarAlign;
	density?: ToolbarDensity;
}

export function ActionToolbar({
	align = "start",
	className,
	density = "default",
	...props
}: ActionToolbarProps): JSX.Element {
	return (
		<div
			className={cn(
				"flex min-h-[var(--workflow-density-compact-min-height)] flex-wrap items-center",
				ALIGNMENT_CLASSES[align],
				DENSITY_CLASSES[density],
				className
			)}
			{...props}
		/>
	);
}
