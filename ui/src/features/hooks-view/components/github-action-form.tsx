import { TextareaPanel } from "@/components/textarea-panel";
import { VSCodeCheckbox } from "@/components/ui/vscode-checkbox";
import { VSCodeSelect } from "@/components/ui/vscode-select";
import type { ChangeEvent } from "react";
import type { ActionConfig, GitHubActionParams } from "../types";

export interface GitHubActionFormProps {
	action: ActionConfig;
	disabled?: boolean;
	actionError?: string;
	onActionChange: (action: ActionConfig) => void;
	onClearActionError?: () => void;
}

const INPUT_CLASS =
	"rounded border border-[color:var(--vscode-input-border)] bg-[color:var(--vscode-input-background)] px-3 py-2 text-[color:var(--vscode-input-foreground)] text-sm focus:border-[color:var(--vscode-focusBorder)] focus:outline-none w-full";

const REQUIRED_STAR = (
	<span
		aria-hidden="true"
		className="text-[color:var(--vscode-errorForeground)]"
	>
		*
	</span>
);

type ParamChangeHandler = (
	event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
) => void;

type CommaSeparatedChangeHandler = (
	event: ChangeEvent<HTMLInputElement>
) => void;

interface OperationFieldsProps {
	disabled?: boolean;
	params: GitHubActionParams;
	onParamChange: (field: string) => ParamChangeHandler;
	onCommaSeparatedChange: (field: string) => CommaSeparatedChangeHandler;
}

function TitleBodyFields({
	disabled,
	params,
	onParamChange,
}: Pick<OperationFieldsProps, "disabled" | "params" | "onParamChange">) {
	return (
		<>
			<div className="flex flex-col gap-2">
				<div className="flex items-center gap-1">
					<label
						className="font-medium text-[color:var(--vscode-foreground)] text-sm"
						htmlFor="github-title-template"
					>
						Title
					</label>
					{REQUIRED_STAR}
				</div>
				<input
					className={INPUT_CLASS}
					disabled={disabled}
					id="github-title-template"
					onChange={onParamChange("titleTemplate")}
					placeholder="Spec created for $feature"
					type="text"
					value={params.titleTemplate || ""}
				/>
			</div>
			<div className="flex flex-col gap-2">
				<label
					className="font-medium text-[color:var(--vscode-foreground)] text-sm"
					htmlFor="github-body-template"
				>
					Body
				</label>
				<TextareaPanel
					disabled={disabled}
					onChange={onParamChange("bodyTemplate")}
					placeholder="Specification created at $timestamp by $user"
					rows={3}
					textareaClassName="min-h-[6rem] text-sm"
					textareaProps={{ id: "github-body-template" }}
					value={params.bodyTemplate || ""}
				/>
				<p className="text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.6))] text-xs">
					Available variables: $feature, $branch, $timestamp, $user
				</p>
			</div>
		</>
	);
}

function ReleaseFields({
	disabled,
	params,
	onParamChange,
}: Pick<OperationFieldsProps, "disabled" | "params" | "onParamChange">) {
	return (
		<>
			<div className="flex flex-col gap-2">
				<div className="flex items-center gap-1">
					<label
						className="font-medium text-[color:var(--vscode-foreground)] text-sm"
						htmlFor="github-tag-name"
					>
						Tag Name
					</label>
					{REQUIRED_STAR}
				</div>
				<input
					className={INPUT_CLASS}
					disabled={disabled}
					id="github-tag-name"
					onChange={onParamChange("tagName")}
					placeholder="v1.0.0"
					type="text"
					value={params.tagName || ""}
				/>
			</div>
			<div className="flex flex-col gap-2">
				<label
					className="font-medium text-[color:var(--vscode-foreground)] text-sm"
					htmlFor="github-release-name"
				>
					Release Name
				</label>
				<input
					className={INPUT_CLASS}
					disabled={disabled}
					id="github-release-name"
					onChange={onParamChange("releaseName")}
					placeholder="Release v1.0.0"
					type="text"
					value={params.releaseName || ""}
				/>
			</div>
			<div className="flex flex-col gap-2">
				<label
					className="font-medium text-[color:var(--vscode-foreground)] text-sm"
					htmlFor="github-release-body"
				>
					Release Body
				</label>
				<TextareaPanel
					disabled={disabled}
					onChange={onParamChange("releaseBody")}
					placeholder="Release notes for $feature"
					rows={3}
					textareaClassName="min-h-[6rem] text-sm"
					textareaProps={{ id: "github-release-body" }}
					value={params.releaseBody || ""}
				/>
			</div>
			<VSCodeCheckbox
				checked={params.draft ?? false}
				disabled={disabled}
				id="github-draft"
				label="Draft"
				onChange={onParamChange("draft")}
			/>
			<VSCodeCheckbox
				checked={params.prerelease ?? false}
				disabled={disabled}
				id="github-prerelease"
				label="Pre-release"
				onChange={onParamChange("prerelease")}
			/>
		</>
	);
}

function IssueOperationFields({
	disabled,
	params,
	onParamChange,
	onCommaSeparatedChange,
}: OperationFieldsProps) {
	const op = params.operation;
	return (
		<>
			{(op === "open-issue" || op === "create-pr") && (
				<TitleBodyFields
					disabled={disabled}
					onParamChange={onParamChange}
					params={params}
				/>
			)}
			{(op === "close-issue" ||
				op === "add-comment" ||
				op === "add-label" ||
				op === "remove-label" ||
				op === "assign-issue") && (
				<div className="flex flex-col gap-2">
					<div className="flex items-center gap-1">
						<label
							className="font-medium text-[color:var(--vscode-foreground)] text-sm"
							htmlFor="github-issue-number"
						>
							Issue Number
						</label>
						{REQUIRED_STAR}
					</div>
					<input
						className={INPUT_CLASS}
						disabled={disabled}
						id="github-issue-number"
						onChange={onParamChange("issueNumber")}
						placeholder="123"
						type="number"
						value={params.issueNumber ?? ""}
					/>
				</div>
			)}
			{op === "add-label" && (
				<div className="flex flex-col gap-2">
					<label
						className="font-medium text-[color:var(--vscode-foreground)] text-sm"
						htmlFor="github-labels"
					>
						Labels
					</label>
					<input
						className={INPUT_CLASS}
						disabled={disabled}
						id="github-labels"
						onChange={onCommaSeparatedChange("labels")}
						placeholder="bug, enhancement, help wanted"
						type="text"
						value={(params.labels ?? []).join(", ")}
					/>
					<p className="text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.6))] text-xs">
						Comma-separated list of label names.
					</p>
				</div>
			)}
			{op === "remove-label" && (
				<div className="flex flex-col gap-2">
					<label
						className="font-medium text-[color:var(--vscode-foreground)] text-sm"
						htmlFor="github-label-name"
					>
						Label Name
					</label>
					<input
						className={INPUT_CLASS}
						disabled={disabled}
						id="github-label-name"
						onChange={onParamChange("labelName")}
						placeholder="bug"
						type="text"
						value={params.labelName || ""}
					/>
				</div>
			)}
			{op === "assign-issue" && (
				<div className="flex flex-col gap-2">
					<label
						className="font-medium text-[color:var(--vscode-foreground)] text-sm"
						htmlFor="github-assignees"
					>
						Assignees
					</label>
					<input
						className={INPUT_CLASS}
						disabled={disabled}
						id="github-assignees"
						onChange={onCommaSeparatedChange("assignees")}
						placeholder="username1, username2"
						type="text"
						value={(params.assignees ?? []).join(", ")}
					/>
					<p className="text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.6))] text-xs">
						Comma-separated list of GitHub usernames.
					</p>
				</div>
			)}
		</>
	);
}

function PrOperationFields({
	disabled,
	params,
	onParamChange,
	onCommaSeparatedChange,
}: OperationFieldsProps) {
	const op = params.operation;
	return (
		<>
			{(op === "merge-pr" || op === "close-pr" || op === "request-review") && (
				<div className="flex flex-col gap-2">
					<div className="flex items-center gap-1">
						<label
							className="font-medium text-[color:var(--vscode-foreground)] text-sm"
							htmlFor="github-pr-number"
						>
							PR Number
						</label>
						{REQUIRED_STAR}
					</div>
					<input
						className={INPUT_CLASS}
						disabled={disabled}
						id="github-pr-number"
						onChange={onParamChange("prNumber")}
						placeholder="42"
						type="number"
						value={params.prNumber ?? ""}
					/>
				</div>
			)}
			{op === "merge-pr" && (
				<VSCodeSelect
					disabled={disabled}
					id="github-merge-method"
					label="Merge Method"
					onChange={onParamChange("mergeMethod")}
					value={params.mergeMethod || "merge"}
				>
					<option value="merge">Merge Commit</option>
					<option value="squash">Squash and Merge</option>
					<option value="rebase">Rebase and Merge</option>
				</VSCodeSelect>
			)}
			{op === "request-review" && (
				<div className="flex flex-col gap-2">
					<label
						className="font-medium text-[color:var(--vscode-foreground)] text-sm"
						htmlFor="github-reviewers"
					>
						Reviewers
					</label>
					<input
						className={INPUT_CLASS}
						disabled={disabled}
						id="github-reviewers"
						onChange={onCommaSeparatedChange("reviewers")}
						placeholder="username1, username2"
						type="text"
						value={(params.reviewers ?? []).join(", ")}
					/>
					<p className="text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.6))] text-xs">
						Comma-separated list of GitHub usernames.
					</p>
				</div>
			)}
			{op === "create-release" && (
				<ReleaseFields
					disabled={disabled}
					onParamChange={onParamChange}
					params={params}
				/>
			)}
		</>
	);
}

function GitHubOperationFields(props: OperationFieldsProps) {
	return (
		<>
			<IssueOperationFields {...props} />
			<PrOperationFields {...props} />
		</>
	);
}

function buildParamValue(
	event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
): string | boolean | number | undefined {
	if (event.target.type === "checkbox") {
		return (event.target as HTMLInputElement).checked;
	}
	if (event.target.type === "number") {
		const parsed = Number.parseInt(event.target.value, 10);
		return Number.isNaN(parsed) ? undefined : parsed;
	}
	return event.target.value;
}

export function GitHubActionForm({
	action,
	disabled,
	actionError,
	onActionChange,
	onClearActionError,
}: GitHubActionFormProps) {
	const params = action.parameters as GitHubActionParams;

	const handleParamChange =
		(field: string): ParamChangeHandler =>
		(event) => {
			const value = buildParamValue(event);
			onActionChange({
				...action,
				parameters: { ...params, [field]: value },
			});
			onClearActionError?.();
		};

	const handleCommaSeparatedChange =
		(field: string): CommaSeparatedChangeHandler =>
		(event) => {
			const items = event.target.value
				.split(",")
				.map((s) => s.trim())
				.filter((s) => s.length > 0);
			onActionChange({
				...action,
				parameters: { ...params, [field]: items },
			});
			onClearActionError?.();
		};

	return (
		<>
			<VSCodeSelect
				disabled={disabled}
				id="github-operation"
				label="Operation"
				onChange={handleParamChange("operation")}
				value={params.operation}
			>
				<option value="open-issue">Open Issue</option>
				<option value="close-issue">Close Issue</option>
				<option value="create-pr">Create Pull Request</option>
				<option value="add-comment">Add Comment</option>
				<option value="merge-pr">Merge Pull Request</option>
				<option value="close-pr">Close Pull Request</option>
				<option value="add-label">Add Label</option>
				<option value="remove-label">Remove Label</option>
				<option value="request-review">Request Review</option>
				<option value="assign-issue">Assign Issue</option>
				<option value="create-release">Create Release</option>
			</VSCodeSelect>
			<div className="flex flex-col gap-2">
				<label
					className="font-medium text-[color:var(--vscode-foreground)] text-sm"
					htmlFor="github-repository"
				>
					Repository
				</label>
				<input
					className={INPUT_CLASS}
					disabled={disabled}
					id="github-repository"
					onChange={handleParamChange("repository")}
					placeholder="owner/repo (optional, defaults to current)"
					type="text"
					value={params.repository || ""}
				/>
			</div>
			<GitHubOperationFields
				disabled={disabled}
				onCommaSeparatedChange={handleCommaSeparatedChange}
				onParamChange={handleParamChange}
				params={params}
			/>
			{actionError && (
				<span className="text-[color:var(--vscode-errorForeground)] text-xs">
					{actionError}
				</span>
			)}
		</>
	);
}
