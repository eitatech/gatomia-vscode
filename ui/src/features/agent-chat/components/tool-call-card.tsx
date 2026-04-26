/**
 * ToolCallCard — Cursor-style compact card that summarises a tool
 * call's file impact (image 2 in the redesign brief).
 *
 * Single-file mode (the dominant case):
 *   ┌─────────────────────────────────────────────┐
 *   │ TS  acp-client.ts            +47  -1  >     │
 *   └─────────────────────────────────────────────┘
 *
 * Multi-file mode collapses behind a chevron that expands to a list of
 * individual `+N -M` rows. The component is purely presentational — it
 * does not own any state besides the expand toggle.
 *
 * Falls back to rendering nothing when `affectedFiles` is empty so the
 * caller (`ChatMessageItem`) can display a plain title row instead.
 */

import { useState } from "react";
import type {
	ToolCallAffectedFile,
	ToolCallStatus,
} from "@/features/agent-chat/types";

interface ToolCallCardProps {
	readonly toolCallId: string;
	readonly title?: string;
	readonly status: ToolCallStatus;
	readonly affectedFiles: readonly ToolCallAffectedFile[];
}

export function ToolCallCard({
	toolCallId,
	title,
	status,
	affectedFiles,
}: ToolCallCardProps): JSX.Element | null {
	const [expanded, setExpanded] = useState(false);
	if (affectedFiles.length === 0) {
		return null;
	}

	const totalAdded = affectedFiles.reduce((sum, f) => sum + f.linesAdded, 0);
	const totalRemoved = affectedFiles.reduce(
		(sum, f) => sum + f.linesRemoved,
		0
	);
	const single = affectedFiles.length === 1 ? affectedFiles[0] : null;
	const headerLabel =
		single != null ? basename(single.path) : `${affectedFiles.length} files`;
	const headerIcon =
		single != null ? languageBadge(single.languageId) : "FILES";

	const canExpand = affectedFiles.length > 1;

	return (
		<div
			className={`agent-chat-tool-card agent-chat-tool-card--${status}`}
			data-testid="tool-call-card"
			data-tool-call-id={toolCallId}
		>
			<button
				aria-expanded={canExpand ? expanded : undefined}
				className="agent-chat-tool-card__header"
				disabled={!canExpand}
				onClick={() => canExpand && setExpanded((v) => !v)}
				title={title ?? toolCallId}
				type="button"
			>
				<span
					aria-hidden="true"
					className="agent-chat-tool-card__lang"
					data-language={single?.languageId ?? "files"}
				>
					{headerIcon}
				</span>
				<span className="agent-chat-tool-card__name">{headerLabel}</span>
				<span className="agent-chat-tool-card__stats">
					<span className="agent-chat-tool-card__added">+{totalAdded}</span>{" "}
					<span className="agent-chat-tool-card__removed">-{totalRemoved}</span>
				</span>
				{canExpand ? (
					<span
						aria-hidden="true"
						className={`agent-chat-tool-card__chevron${expanded ? "agent-chat-tool-card__chevron--open" : ""}`}
					>
						›
					</span>
				) : null}
			</button>
			{canExpand && expanded ? (
				<ul className="agent-chat-tool-card__list">
					{affectedFiles.map((file) => (
						<li className="agent-chat-tool-card__row" key={file.path}>
							<span
								aria-hidden="true"
								className="agent-chat-tool-card__lang agent-chat-tool-card__lang--small"
							>
								{languageBadge(file.languageId)}
							</span>
							<span
								className="agent-chat-tool-card__row-name"
								title={file.path}
							>
								{basename(file.path)}
							</span>
							<span className="agent-chat-tool-card__stats">
								<span className="agent-chat-tool-card__added">
									+{file.linesAdded}
								</span>{" "}
								<span className="agent-chat-tool-card__removed">
									-{file.linesRemoved}
								</span>
							</span>
						</li>
					))}
				</ul>
			) : null}
		</div>
	);
}

function basename(path: string): string {
	const idx = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
	return idx < 0 ? path : path.slice(idx + 1);
}

/**
 * Two-letter language badge for the card header. We intentionally keep
 * this list short; codicons are not bundled into the webview, and a
 * tiny letter pill is more legible than a generic file icon at the
 * sizes the card renders at.
 */
function languageBadge(languageId: string | undefined): string {
	switch (languageId) {
		case "typescript":
			return "TS";
		case "typescriptreact":
			return "TSX";
		case "javascript":
			return "JS";
		case "javascriptreact":
			return "JSX";
		case "python":
			return "PY";
		case "rust":
			return "RS";
		case "go":
			return "GO";
		case "java":
			return "JAVA";
		case "kotlin":
			return "KT";
		case "ruby":
			return "RB";
		case "csharp":
			return "C#";
		case "cpp":
			return "C++";
		case "c":
			return "C";
		case "json":
			return "JSON";
		case "markdown":
			return "MD";
		case "yaml":
			return "YML";
		case "toml":
			return "TOML";
		case "shellscript":
			return "SH";
		case "css":
			return "CSS";
		case "scss":
			return "SCSS";
		case "html":
			return "HTML";
		case "sql":
			return "SQL";
		default:
			return "F";
	}
}
