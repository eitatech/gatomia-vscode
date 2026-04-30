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
	activeProvider?: {
		id: string;
		displayName: string;
	};
	generatedAt: number;
	degradedReasons: string[];
}

const EMPTY_SNAPSHOT: Snapshot = {
	sessions: [],
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

	let content: JSX.Element;
	if (isLoading) {
		content = (
			<div className="rounded-xl border border-[var(--vscode-panel-border)] border-dashed px-4 py-8 text-center text-[var(--vscode-descriptionForeground)] text-sm">
				Loading orchestration state...
			</div>
		);
	} else if (snapshot.sessions.length === 0) {
		content = (
			<div className="rounded-xl border border-[var(--vscode-panel-border)] border-dashed px-4 py-8 text-center">
				<p className="font-medium text-base">No running or recent sessions</p>
				<p className="mt-2 text-[var(--vscode-descriptionForeground)] text-sm">
					Start an agent chat or dispatch a cloud session to see orchestration
					progress here.
				</p>
			</div>
		);
	} else {
		content = (
			<div className="grid gap-4 xl:grid-cols-4">
				{BUCKETS.map((bucket) => (
					<section
						className="rounded-xl border border-[var(--vscode-panel-border)] bg-[var(--vscode-sideBar-background)] p-3"
						data-testid={`orchestration-bucket-${bucket.key}`}
						key={bucket.key}
					>
						<div className="mb-3 flex items-center justify-between gap-2">
							<h2 className="font-semibold text-sm">{bucket.label}</h2>
							<span className="rounded-full bg-[var(--vscode-badge-background)] px-2 py-0.5 text-[var(--vscode-badge-foreground)] text-xs">
								{grouped[bucket.key].length}
							</span>
						</div>
						<div className="flex flex-col gap-3">
							{grouped[bucket.key].length === 0 ? (
								<div className="rounded-lg border border-[var(--vscode-panel-border)] border-dashed px-3 py-4 text-[var(--vscode-descriptionForeground)] text-sm">
									{bucket.empty}
								</div>
							) : (
								grouped[bucket.key].map((session) => (
									<SessionCard key={session.id} session={session} />
								))
							)}
						</div>
					</section>
				))}
			</div>
		);
	}

	return (
		<div className="min-h-full bg-[var(--vscode-editor-background)] text-[var(--vscode-foreground)]">
			<div className="mx-auto flex max-w-7xl flex-col gap-4 p-4">
				<header className="rounded-xl border border-[var(--vscode-panel-border)] bg-[var(--vscode-sideBar-background)] px-4 py-4 shadow-sm">
					<div className="flex flex-wrap items-center justify-between gap-3">
						<div>
							<p className="text-[var(--vscode-descriptionForeground)] text-xs uppercase tracking-[0.18em]">
								Running Agents Prototype
							</p>
							<h1 className="mt-1 font-semibold text-xl">
								Session orchestration
							</h1>
							<p className="mt-1 text-[var(--vscode-descriptionForeground)] text-sm">
								Active provider:{" "}
								{snapshot.activeProvider?.displayName ?? "none"}
							</p>
						</div>
						<div className="flex flex-wrap gap-2">
							<button
								className="rounded-md border border-[var(--vscode-button-border)] bg-[var(--vscode-button-background)] px-3 py-2 text-[var(--vscode-button-foreground)] text-sm"
								onClick={() =>
									vscode.postMessage({ type: "orchestration/refresh" })
								}
								type="button"
							>
								Refresh state
							</button>
							<button
								className="rounded-md border border-[var(--vscode-panel-border)] px-3 py-2 text-sm"
								onClick={() =>
									vscode.postMessage({
										type: "orchestration/open-existing-surface",
										payload: { source: "agent-chat" },
									})
								}
								type="button"
							>
								Open Agent Chat
							</button>
							<button
								className="rounded-md border border-[var(--vscode-panel-border)] px-3 py-2 text-sm"
								onClick={() =>
									vscode.postMessage({
										type: "orchestration/open-existing-surface",
										payload: { source: "cloud-agent" },
									})
								}
								type="button"
							>
								Open Cloud Agents
							</button>
						</div>
					</div>
					{snapshot.degradedReasons.length > 0 ? (
						<div className="mt-3 rounded-lg border border-[var(--vscode-inputValidation-warningBorder)] bg-[var(--vscode-inputValidation-warningBackground)]/30 px-3 py-2 text-sm">
							{snapshot.degradedReasons.join(" ")}
						</div>
					) : null}
					<p className="mt-3 text-[var(--vscode-descriptionForeground)] text-xs">
						Prototype view: active and recent sessions are grouped into lanes so
						you can inspect status quickly and jump back to the underlying chat
						or cloud surface.
					</p>
				</header>

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
		<article className="rounded-xl border border-[var(--vscode-panel-border)] bg-[var(--vscode-editor-background)] p-3 shadow-sm">
			<div className="flex items-start justify-between gap-3">
				<div>
					<p className="font-semibold text-sm">{session.title}</p>
					<p className="mt-1 text-[var(--vscode-descriptionForeground)] text-xs uppercase tracking-wide">
						{session.source === "agent-chat"
							? "Agent Chat"
							: (session.cloudProviderId ?? "Cloud Agent")}
					</p>
				</div>
				<StatePill state={session.state} />
			</div>

			<dl className="mt-3 grid grid-cols-2 gap-2 text-[var(--vscode-descriptionForeground)] text-xs">
				<div>
					<dt>Agent</dt>
					<dd className="mt-0.5 text-[var(--vscode-foreground)]">
						{session.agentName}
					</dd>
				</div>
				<div>
					<dt>Target</dt>
					<dd className="mt-0.5 text-[var(--vscode-foreground)]">
						{session.executionTargetLabel ?? "Unknown"}
					</dd>
				</div>
				<div>
					<dt>Updated</dt>
					<dd className="mt-0.5 text-[var(--vscode-foreground)]">
						{formatTimestamp(session.lastVisibleActivityAt)}
					</dd>
				</div>
				<div>
					<dt>Blocking</dt>
					<dd className="mt-0.5 text-[var(--vscode-foreground)]">
						{session.isBlocked ? "Blocked" : "Clear"}
					</dd>
				</div>
				{session.worktreeStatus ? (
					<div className="col-span-2">
						<dt>Worktree</dt>
						<dd className="mt-0.5 text-[var(--vscode-foreground)]">
							{session.worktreeStatus}
						</dd>
					</div>
				) : null}
			</dl>

			<div className="mt-4 flex flex-wrap gap-2">
				<button
					className="rounded-md border border-[var(--vscode-button-border)] bg-[var(--vscode-button-background)] px-2.5 py-1.5 text-[var(--vscode-button-foreground)] text-xs"
					onClick={() =>
						vscode.postMessage({
							type: "orchestration/open-session",
							payload: { sessionId: session.id },
						})
					}
					type="button"
				>
					Open session
				</button>
				<button
					className="rounded-md border border-[var(--vscode-panel-border)] px-2.5 py-1.5 text-xs"
					onClick={() =>
						vscode.postMessage({
							type: "orchestration/open-existing-surface",
							payload: { source: session.source },
						})
					}
					type="button"
				>
					Open original view
				</button>
				{session.externalUrl ? (
					<button
						className="rounded-md border border-[var(--vscode-panel-border)] px-2.5 py-1.5 text-xs"
						onClick={() =>
							vscode.postMessage({
								type: "orchestration/open-external",
								payload: { url: session.externalUrl },
							})
						}
						type="button"
					>
						Open external
					</button>
				) : null}
			</div>
		</article>
	);
}

function StatePill({ state }: { state: string }): JSX.Element {
	let tone = "bg-sky-500/20 text-sky-200";
	if (state === "completed") {
		tone = "bg-emerald-500/20 text-emerald-200";
	} else if (
		state === "failed" ||
		state === "cancelled" ||
		state === "ended-by-shutdown"
	) {
		tone = "bg-rose-500/20 text-rose-200";
	} else if (state === "waiting-for-input" || state === "blocked") {
		tone = "bg-amber-500/20 text-amber-200";
	}

	return (
		<span className={`rounded-full px-2 py-1 font-medium text-[11px] ${tone}`}>
			{state}
		</span>
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
