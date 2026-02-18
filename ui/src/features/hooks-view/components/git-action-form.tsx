import { TextareaPanel } from "@/components/textarea-panel";
import { VSCodeCheckbox } from "@/components/ui/vscode-checkbox";
import { VSCodeSelect } from "@/components/ui/vscode-select";
import type { ActionConfig, GitActionParams } from "../types";
import type { ChangeEvent } from "react";

export interface GitActionFormProps {
	action: ActionConfig;
	disabled?: boolean;
	actionError?: string;
	onActionChange: (action: ActionConfig) => void;
	onClearActionError?: () => void;
}

const INPUT_CLASS =
	"rounded border border-[color:var(--vscode-input-border)] bg-[color:var(--vscode-input-background)] px-3 py-2 text-[color:var(--vscode-input-foreground)] text-sm focus:border-[color:var(--vscode-focusBorder)] focus:outline-none w-full";

export const GitActionForm = ({
	action,
	disabled,
	actionError,
	onActionChange,
	onClearActionError,
}: GitActionFormProps) => {
	const params = action.parameters as GitActionParams;

	const handleParamChange =
		(field: string) =>
		(
			event: ChangeEvent<
				HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
			>
		) => {
			let value: string | boolean | undefined;
			if (event.target.type === "checkbox") {
				value = (event.target as HTMLInputElement).checked;
			} else {
				value = event.target.value;
			}
			onActionChange({
				...action,
				parameters: { ...params, [field]: value },
			});
			onClearActionError?.();
		};

	const handleOperationChange = (
		event: ChangeEvent<HTMLSelectElement>
	): void => {
		const nextOperation = event.target.value as GitActionParams["operation"];
		onActionChange({
			...action,
			type: "git",
			parameters: {
				...params,
				operation: nextOperation,
				...(nextOperation === "push"
					? { pushToRemote: false }
					: { pushToRemote: params.pushToRemote ?? false }),
			},
		});
		onClearActionError?.();
	};

	const isCommit = params.operation === "commit";
	const isPush = params.operation === "push";
	const isBranchOp =
		params.operation === "create-branch" ||
		params.operation === "checkout-branch" ||
		params.operation === "merge";
	const isTag = params.operation === "tag";
	const isStash = params.operation === "stash";

	return (
		<>
			<VSCodeSelect
				disabled={disabled}
				id="git-operation"
				label="Operation"
				onChange={handleOperationChange}
				value={params.operation}
			>
				<option value="commit">Commit</option>
				<option value="push">Push</option>
				<option value="create-branch">Create Branch</option>
				<option value="checkout-branch">Checkout Branch</option>
				<option value="pull">Pull</option>
				<option value="merge">Merge</option>
				<option value="tag">Tag</option>
				<option value="stash">Stash</option>
			</VSCodeSelect>

			{isCommit && (
				<>
					<div className="flex flex-col gap-2">
						<div className="flex items-center gap-1">
							<label
								className="font-medium text-[color:var(--vscode-foreground)] text-sm"
								htmlFor="git-message-template"
							>
								Message Template
							</label>
							<span
								aria-hidden="true"
								className="text-[color:var(--vscode-errorForeground)]"
							>
								*
							</span>
						</div>
						<TextareaPanel
							disabled={disabled}
							onChange={handleParamChange("messageTemplate")}
							placeholder="feat($feature): automated update at $timestamp"
							rows={2}
							textareaClassName="min-h-[4rem] text-sm"
							textareaProps={{ id: "git-message-template" }}
							value={params.messageTemplate || ""}
						/>
						<p className="text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.6))] text-xs">
							Available variables: $feature, $branch, $timestamp, $user
						</p>
					</div>
					<VSCodeCheckbox
						checked={params.pushToRemote ?? false}
						disabled={disabled}
						id="git-push-to-remote"
						label="Push to remote after commit"
						onChange={handleParamChange("pushToRemote")}
					/>
				</>
			)}

			{isPush && (
				<p className="text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.6))] text-xs">
					The push action immediately pushes the active branch to its upstream
					remote. No commit message is needed.
				</p>
			)}

			{isBranchOp && (
				<div className="flex flex-col gap-2">
					<div className="flex items-center gap-1">
						<label
							className="font-medium text-[color:var(--vscode-foreground)] text-sm"
							htmlFor="git-branch-name"
						>
							Branch Name
						</label>
						<span
							aria-hidden="true"
							className="text-[color:var(--vscode-errorForeground)]"
						>
							*
						</span>
					</div>
					<input
						className={INPUT_CLASS}
						disabled={disabled}
						id="git-branch-name"
						onChange={handleParamChange("branchName")}
						placeholder="feature/my-branch or $branch"
						type="text"
						value={params.branchName || ""}
					/>
					<p className="text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.6))] text-xs">
						Available variables: $branch, $feature, $timestamp
					</p>
				</div>
			)}

			{isTag && (
				<>
					<div className="flex flex-col gap-2">
						<div className="flex items-center gap-1">
							<label
								className="font-medium text-[color:var(--vscode-foreground)] text-sm"
								htmlFor="git-tag-name"
							>
								Tag Name
							</label>
							<span
								aria-hidden="true"
								className="text-[color:var(--vscode-errorForeground)]"
							>
								*
							</span>
						</div>
						<input
							className={INPUT_CLASS}
							disabled={disabled}
							id="git-tag-name"
							onChange={handleParamChange("tagName")}
							placeholder="v1.0.0 or v$timestamp"
							type="text"
							value={params.tagName || ""}
						/>
					</div>
					<div className="flex flex-col gap-2">
						<label
							className="font-medium text-[color:var(--vscode-foreground)] text-sm"
							htmlFor="git-tag-message"
						>
							Tag Message
						</label>
						<input
							className={INPUT_CLASS}
							disabled={disabled}
							id="git-tag-message"
							onChange={handleParamChange("tagMessage")}
							placeholder="Release $feature at $timestamp (optional)"
							type="text"
							value={params.tagMessage || ""}
						/>
						<p className="text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.6))] text-xs">
							Leave empty for a lightweight tag. Provide a message for an
							annotated tag.
						</p>
					</div>
				</>
			)}

			{isStash && (
				<div className="flex flex-col gap-2">
					<label
						className="font-medium text-[color:var(--vscode-foreground)] text-sm"
						htmlFor="git-stash-message"
					>
						Stash Message
					</label>
					<input
						className={INPUT_CLASS}
						disabled={disabled}
						id="git-stash-message"
						onChange={handleParamChange("stashMessage")}
						placeholder="WIP: $feature (optional)"
						type="text"
						value={params.stashMessage || ""}
					/>
					<p className="text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.6))] text-xs">
						Optional label for the stash entry.
					</p>
				</div>
			)}

			{actionError && (
				<span className="text-[color:var(--vscode-errorForeground)] text-xs">
					{actionError}
				</span>
			)}
		</>
	);
};
