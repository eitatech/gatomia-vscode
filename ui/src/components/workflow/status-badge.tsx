import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export type WorkflowStatusTone =
	| "active"
	| "warning"
	| "success"
	| "danger"
	| "neutral";

const STATUS_TONE_CLASSES: Record<WorkflowStatusTone, string> = {
	active:
		"border-[color:var(--workflow-status-active-border)] bg-[color:var(--workflow-status-active-background)] text-[color:var(--workflow-status-active-color)]",
	warning:
		"border-[color:var(--workflow-status-warning-border)] bg-[color:var(--workflow-status-warning-background)] text-[color:var(--workflow-status-warning-color)]",
	success:
		"border-[color:var(--workflow-status-success-border)] bg-[color:var(--workflow-status-success-background)] text-[color:var(--workflow-status-success-color)]",
	danger:
		"border-[color:var(--workflow-status-danger-border)] bg-[color:var(--workflow-status-danger-background)] text-[color:var(--workflow-status-danger-color)]",
	neutral:
		"border-[color:var(--workflow-status-neutral-border)] bg-[color:var(--workflow-status-neutral-background)] text-[color:var(--workflow-status-neutral-color)]",
};

const ACTIVE_STATUSES = new Set([
	"active",
	"delivered",
	"executing",
	"initializing",
	"queued",
	"running",
]);

const WARNING_STATUSES = new Set([
	"blocked",
	"paused",
	"pending",
	"waiting",
	"waiting-for-input",
]);

const SUCCESS_STATUSES = new Set([
	"completed",
	"delivered",
	"passed",
	"success",
]);

const DANGER_STATUSES = new Set([
	"cancelled",
	"ended-by-shutdown",
	"error",
	"failed",
	"rejected",
]);

export interface StatusBadgeProps extends HTMLAttributes<HTMLSpanElement> {
	status?: string;
	tone?: WorkflowStatusTone;
	label?: ReactNode;
	children?: ReactNode;
}

export function getWorkflowStatusTone(status?: string): WorkflowStatusTone {
	if (!status) {
		return "neutral";
	}

	const normalizedStatus = normalizeStatus(status);
	if (SUCCESS_STATUSES.has(normalizedStatus)) {
		return "success";
	}
	if (DANGER_STATUSES.has(normalizedStatus)) {
		return "danger";
	}
	if (WARNING_STATUSES.has(normalizedStatus)) {
		return "warning";
	}
	if (ACTIVE_STATUSES.has(normalizedStatus)) {
		return "active";
	}
	return "neutral";
}

export function formatWorkflowStatusLabel(status: string): string {
	return normalizeStatus(status).replace(/-/g, " ");
}

export function StatusBadge({
	children,
	className,
	label,
	status,
	tone,
	...props
}: StatusBadgeProps): JSX.Element {
	const resolvedTone = tone ?? getWorkflowStatusTone(status);
	const content =
		children ?? label ?? (status ? formatWorkflowStatusLabel(status) : null);

	return (
		<span
			className={cn(
				"inline-flex min-h-[1.5rem] items-center rounded-full border px-2.5 py-0.5 font-medium text-[11px] leading-none",
				STATUS_TONE_CLASSES[resolvedTone],
				className
			)}
			{...props}
		>
			{content}
		</span>
	);
}

function normalizeStatus(status: string): string {
	return status
		.trim()
		.toLowerCase()
		.replace(/[\s_]+/g, "-");
}
