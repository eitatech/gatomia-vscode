import { Button } from "@/components/ui/button";
import {
	ActionToolbar,
	EmptyState,
	MetricRow,
	PanelSection,
	StatusBadge,
} from "@/components/workflow";
import { useEffect, useMemo, useState } from "react";
import { vscode } from "../../bridge/vscode";

type Bucket = "active" | "waiting" | "completed" | "failed";

interface OrchestrationSession {
	id: string;
	source: "agent-chat" | "cloud-agent";
	sourceSessionId: string;
	title: string;
	agentName: string;
	state: string;
	bucket: Bucket;
	createdAt: number;
	updatedAt: number;
	endedAt?: number;
	lastVisibleActivityAt: number;
	isBlocked: boolean;
	worktreeStatus?: string;
	executionTargetLabel?: string;
	externalUrl?: string;
	cloudProviderId?: string;
}

interface Snapshot {
	sessions: OrchestrationSession[];
	cloudProviderRegistryAvailable: boolean;
	cloudProviderCount: number;
	activeProvider?: {
		id: string;
		displayName: string;
	};
	generatedAt: number;
	degradedReasons: string[];
}

interface EmptyStateConfig {
	title: string;
	description: string;
	actionLabel?: string;
	action?: () => void;
}

const EMPTY_SNAPSHOT: Snapshot = {
	sessions: [],
	cloudProviderRegistryAvailable: false,
	cloudProviderCount: 0,
	generatedAt: 0,
	degradedReasons: [],
};

const BUCKETS: Array<{ key: Bucket; label: string; empty: string }> = [
	{
		key: "active",
		label: "Active",
		empty: "No sessions are actively running.",
	},
	{
		key: "waiting",
		label: "Waiting",
		empty: "Nothing is waiting on input or provider action.",
	},
	{
		key: "completed",
		label: "Completed",
		empty: "No recent completed sessions yet.",
	},
	{ key: "failed", label: "Failed", empty: "No failed or cancelled sessions." },
];

export function OrchestrationFeature(): JSX.Element {
	const [snapshot, setSnapshot] = useState<Snapshot>(EMPTY_SNAPSHOT);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		const onMessage = (event: MessageEvent) => {
			const message = event.data as { type?: string; payload?: unknown };
			if (message.type !== "orchestration/snapshot") {
				return;
			}
			setSnapshot((message.payload as Snapshot | undefined) ?? EMPTY_SNAPSHOT);
			setIsLoading(false);
		};

		window.addEventListener("message", onMessage);
		vscode.postMessage({ type: "orchestration/ready" });

		return () => {
			window.removeEventListener("message", onMessage);
		};
	}, []);

	const grouped = useMemo(
		() =>
			Object.fromEntries(
				BUCKETS.map((bucket) => [
					bucket.key,
					snapshot.sessions.filter((session) => session.bucket === bucket.key),
				])
			) as Record<Bucket, OrchestrationSession[]>,
		[snapshot.sessions]
	);

	const emptyState = useMemo<EmptyStateConfig>(() => {
		if (
			snapshot.degradedReasons.some((reason) =>
				reason.includes("provider wiring is unavailable")
			)
		) {
			return {
				title: "Cloud orchestration is temporarily unavailable",
				description:
					"Start a local agent chat session now, or reopen Cloud Agents after the provider wiring is restored.",
				actionLabel: "Open Agent Chat",
				action: () =>
					vscode.postMessage({
						type: "orchestration/open-existing-surface",
						payload: { source: "agent-chat" },
					}),
			};
		}

		if (
			snapshot.degradedReasons.some((reason) =>
				reason.includes("No cloud agent providers are registered")
			)
		) {
			return {
				title: "Connect a cloud provider",
				description:
					"No cloud agent providers are registered yet. Open Cloud Agents to configure one, or start a local agent chat session instead.",
				actionLabel: "Open Cloud Agents",
				action: () =>
					vscode.postMessage({
						type: "orchestration/open-existing-surface",
						payload: { source: "cloud-agent" },
					}),
			};
		}

		if (
			snapshot.degradedReasons.some(
				(reason) =>
					reason.includes("could not be read") ||
					reason.includes("Failed to read orchestration status")
			)
		) {
			return {
				title: "Session status is temporarily unavailable",
				description:
					"Refresh state to retry the latest reads, or open Cloud Agents for provider-specific status while the orchestration snapshot recovers.",
				actionLabel: "Refresh state",
				action: () => vscode.postMessage({ type: "orchestration/refresh" }),
			};
		}

		if (
			snapshot.cloudProviderRegistryAvailable &&
			snapshot.cloudProviderCount > 0 &&
			!snapshot.activeProvider
		) {
			return {
				title: "No cloud provider is selected",
				description:
					"Agent Chat sessions will appear here automatically. Open Cloud Agents to choose a provider before dispatching remote work.",
				actionLabel: "Open Cloud Agents",
				action: () =>
					vscode.postMessage({
						type: "orchestration/open-existing-surface",
						payload: { source: "cloud-agent" },
					}),
			};
		}

		if (
			snapshot.cloudProviderRegistryAvailable &&
			snapshot.cloudProviderCount === 0
		) {
			return {
				title: "No sessions yet",
				description:
					"Start an Agent Chat session now, or configure a cloud provider to bring remote work into this orchestration view.",
				actionLabel: "Open Agent Chat",
				action: () =>
					vscode.postMessage({
						type: "orchestration/open-existing-surface",
						payload: { source: "agent-chat" },
					}),
			};
		}

		return {
			title: "No running or recent sessions",
			description: snapshot.activeProvider
				? `Start an Agent Chat session or dispatch work to ${snapshot.activeProvider.displayName} to see orchestration progress here.`
				: "Start an agent chat or dispatch a cloud session to see orchestration progress here.",
			actionLabel: "Open Agent Chat",
			action: () =>
				vscode.postMessage({
					type: "orchestration/open-existing-surface",
					payload: { source: "agent-chat" },
				}),
		};
	}, [
		snapshot.activeProvider,
		snapshot.cloudProviderCount,
		snapshot.cloudProviderRegistryAvailable,
		snapshot.degradedReasons,
	]);

	let content: JSX.Element;
	if (isLoading) {
		content = (
			<EmptyState
				description="Refreshing active and recent agent sessions across local and cloud surfaces."
				eyebrow="Running agents"
				title="Loading orchestration state..."
			/>
		);
	} else if (snapshot.sessions.length === 0) {
		content = (
			<EmptyState
				actions={
					emptyState.action && emptyState.actionLabel ? (
						<Button onClick={emptyState.action} size="sm" type="button">
							{emptyState.actionLabel}
						</Button>
					) : null
				}
				description={emptyState.description}
				eyebrow="Running agents"
				title={emptyState.title}
			/>
		);
	} else {
		content = (
			<div className="grid gap-4 xl:grid-cols-4">
				{BUCKETS.map((bucket) => (
					<PanelSection
						actions={
							<StatusBadge
								aria-label={`${bucket.label} session count`}
								tone="neutral"
							>
								{grouped[bucket.key].length}
							</StatusBadge>
						}
						as="section"
						className="h-full"
						contentClassName="flex flex-col gap-3"
						data-testid={`orchestration-bucket-${bucket.key}`}
						key={bucket.key}
						padding="compact"
						title={bucket.label}
						variant="muted"
					>
						{grouped[bucket.key].length === 0 ? (
							<div className="rounded-[var(--workflow-panel-radius)] border border-[color:var(--workflow-panel-border-color)] border-dashed bg-[color:var(--workflow-panel-background)] px-3 py-4 text-[color:var(--vscode-descriptionForeground)] text-sm">
								{bucket.empty}
							</div>
						) : (
							grouped[bucket.key].map((session) => (
								<SessionCard key={session.id} session={session} />
							))
						)}
					</PanelSection>
				))}
			</div>
		);
	}

	return (
		<div className="min-h-full bg-[var(--vscode-editor-background)] text-[var(--vscode-foreground)]">
			<div className="mx-auto flex max-w-7xl flex-col gap-4 p-4">
				<PanelSection as="header" padding="relaxed" variant="elevated">
					<div className="flex flex-wrap items-start justify-between gap-4">
						<div>
							<p className="text-[color:var(--vscode-descriptionForeground)] text-xs uppercase tracking-[0.18em]">
								Running Agents Prototype
							</p>
							<h1 className="mt-1 font-semibold text-xl">
								Session orchestration
							</h1>
							<p className="mt-2 max-w-3xl text-[color:var(--vscode-descriptionForeground)] text-sm">
								Prototype view: active and recent sessions are grouped into
								lanes so you can inspect status quickly and jump back to the
								underlying chat or cloud surface.
							</p>
						</div>
						<ActionToolbar align="end">
							<Button
								onClick={() =>
									vscode.postMessage({ type: "orchestration/refresh" })
								}
								size="sm"
								type="button"
							>
								Refresh state
							</Button>
							<Button
								onClick={() =>
									vscode.postMessage({
										type: "orchestration/open-existing-surface",
										payload: { source: "agent-chat" },
									})
								}
								size="sm"
								type="button"
								variant="outline"
							>
								Open Agent Chat
							</Button>
							<Button
								onClick={() =>
									vscode.postMessage({
										type: "orchestration/open-existing-surface",
										payload: { source: "cloud-agent" },
									})
								}
								size="sm"
								type="button"
								variant="outline"
							>
								Open Cloud Agents
							</Button>
						</ActionToolbar>
					</div>

					<div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
						<MetricRow
							helper="Current cloud execution target"
							label="Active provider"
							value={snapshot.activeProvider?.displayName ?? "none"}
						/>
						<MetricRow
							helper="Visible local and cloud work"
							label="Tracked sessions"
							value={snapshot.sessions.length}
						/>
						<MetricRow
							helper="Registered providers detected"
							label="Providers"
							value={snapshot.cloudProviderCount}
						/>
						<MetricRow
							helper="Latest orchestration snapshot"
							label="Last updated"
							value={formatTimestamp(snapshot.generatedAt)}
						/>
					</div>

					{snapshot.degradedReasons.length > 0 ? (
						<div className="mt-4 rounded-[var(--workflow-panel-radius)] border border-[color:var(--workflow-status-warning-border)] bg-[color:var(--workflow-status-warning-background)] px-3 py-3 text-sm">
							<div className="flex flex-wrap items-start gap-2">
								<StatusBadge tone="warning">Status degraded</StatusBadge>
								<p className="min-w-0 flex-1 text-[color:var(--vscode-descriptionForeground)]">
									{snapshot.degradedReasons.join(" ")}
								</p>
							</div>
						</div>
					) : null}
				</PanelSection>

				{content}
			</div>
		</div>
	);
}

function SessionCard({
	session,
}: {
	session: OrchestrationSession;
}): JSX.Element {
	return (
		<PanelSection as="article" padding="compact" variant="elevated">
			<div className="flex items-start justify-between gap-3">
				<div>
					<p className="font-semibold text-sm">{session.title}</p>
					<p className="mt-1 text-[var(--vscode-descriptionForeground)] text-xs uppercase tracking-wide">
						{session.source === "agent-chat"
							? "Agent Chat"
							: (session.cloudProviderId ?? "Cloud Agent")}
					</p>
				</div>
				<StatusBadge status={session.state} />
			</div>

			<div className="mt-3 grid gap-2">
				<MetricRow label="Agent" value={session.agentName} />
				<MetricRow
					label="Target"
					value={session.executionTargetLabel ?? "Unknown"}
				/>
				<MetricRow
					label="Updated"
					value={formatTimestamp(session.lastVisibleActivityAt)}
				/>
				<MetricRow
					label="Blocking"
					value={session.isBlocked ? "Blocked" : "Clear"}
				/>
				{session.worktreeStatus ? (
					<MetricRow label="Worktree" value={session.worktreeStatus} />
				) : null}
			</div>

			<ActionToolbar className="mt-4" density="compact">
				<Button
					onClick={() =>
						vscode.postMessage({
							type: "orchestration/open-session",
							payload: { sessionId: session.id },
						})
					}
					size="sm"
					type="button"
				>
					Open session
				</Button>
				<Button
					onClick={() =>
						vscode.postMessage({
							type: "orchestration/open-existing-surface",
							payload: { source: session.source },
						})
					}
					size="sm"
					type="button"
					variant="outline"
				>
					Open original view
				</Button>
				{session.externalUrl ? (
					<Button
						onClick={() =>
							vscode.postMessage({
								type: "orchestration/open-external",
								payload: { url: session.externalUrl },
							})
						}
						size="sm"
						type="button"
						variant="outline"
					>
						Open external
					</Button>
				) : null}
			</ActionToolbar>
		</PanelSection>
	);
}

function formatTimestamp(timestamp: number): string {
	if (!timestamp) {
		return "Unknown";
	}
	return new Date(timestamp).toLocaleTimeString([], {
		hour: "2-digit",
		minute: "2-digit",
	});
}
