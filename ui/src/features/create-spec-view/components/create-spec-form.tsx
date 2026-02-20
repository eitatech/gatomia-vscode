import type { ChangeEvent, FormEvent, MutableRefObject } from "react";
import type { ImageAttachmentMeta } from "../types";
import { SpecToolbar } from "./spec-toolbar";
import { ImageAttachmentStrip } from "./image-attachment-strip";

const DESCRIPTION_HELPER_ID = "create-spec-description-helper";

interface CreateSpecFormProps {
	description: string;
	fieldError: string | undefined;
	isSubmitting: boolean;
	isImporting: boolean;
	autosaveStatus: string;
	pendingImportConfirm: boolean;
	attachments: ImageAttachmentMeta[];
	onSubmit: (event: FormEvent<HTMLFormElement>) => void;
	onDescriptionChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
	onImport: () => void;
	onAttach: () => void;
	onConfirmImport: () => void;
	onCancelImport: () => void;
	onRemoveAttachment: (id: string) => void;
	descriptionRef: MutableRefObject<HTMLTextAreaElement | null>;
	formId: string;
}

export const CreateSpecForm = ({
	description,
	fieldError,
	isSubmitting,
	isImporting,
	autosaveStatus,
	pendingImportConfirm,
	attachments,
	onSubmit,
	onDescriptionChange,
	onImport,
	onAttach,
	onConfirmImport,
	onCancelImport,
	onRemoveAttachment,
	descriptionRef,
	formId,
}: CreateSpecFormProps) => (
	<form
		aria-busy={isSubmitting}
		className="flex flex-1 flex-col gap-4"
		id={formId}
		noValidate
		onSubmit={onSubmit}
	>
		<section className="flex flex-1 flex-col gap-2">
			<SpecToolbar
				attachCount={attachments.length}
				isAttaching={false}
				isImporting={isImporting}
				onAttach={onAttach}
				onImport={onImport}
			/>

			{pendingImportConfirm && (
				<div
					className="flex items-center justify-between gap-2 rounded border border-[color:var(--vscode-inputValidation-infoBorder)] bg-[color:var(--vscode-inputValidation-infoBackground)] px-3 py-2 text-sm"
					role="alert"
				>
					<span>This will replace the existing content. Continue?</span>
					<div className="flex gap-2">
						<button
							className="rounded px-2 py-1 text-xs hover:bg-[color:var(--vscode-button-secondaryHoverBackground)]"
							disabled={isSubmitting || isImporting}
							onClick={onConfirmImport}
							type="button"
						>
							Replace
						</button>
						<button
							className="rounded px-2 py-1 text-xs hover:bg-[color:var(--vscode-button-secondaryHoverBackground)]"
							onClick={onCancelImport}
							type="button"
						>
							Cancel
						</button>
					</div>
				</div>
			)}

			<div className="flex flex-col gap-2">
				<label
					className="font-medium text-[color:var(--vscode-foreground)] text-sm"
					htmlFor="create-spec-description"
				>
					Description{" "}
					<span className="text-[color:var(--vscode-errorForeground)]">*</span>
				</label>
				<div className="flex flex-col rounded border border-[color:color-mix(in_srgb,var(--vscode-foreground)_20%,transparent)] shadow-[0_16px_32px_rgba(0,0,0,0.25)] focus-within:border-[color:var(--vscode-focusBorder)]">
					<textarea
						aria-describedby={fieldError ? DESCRIPTION_HELPER_ID : undefined}
						aria-invalid={fieldError ? true : undefined}
						aria-required
						className="max-h-[60vh] min-h-[12rem] resize-none overflow-y-auto bg-transparent p-3 text-[color:var(--vscode-foreground)] text-sm leading-6 outline-none placeholder:text-[color:var(--vscode-input-placeholderForeground)]"
						disabled={isSubmitting}
						id="create-spec-description"
						name="description"
						onChange={onDescriptionChange}
						placeholder="Describe what you want to build or change…"
						ref={descriptionRef}
						value={description}
					/>
					{fieldError ? (
						<div
							className="flex items-center justify-end px-3 py-2 text-xs"
							id={DESCRIPTION_HELPER_ID}
						>
							<span className="text-[color:var(--vscode-errorForeground)]">
								{fieldError}
							</span>
						</div>
					) : null}
				</div>
			</div>

			<ImageAttachmentStrip
				attachments={attachments}
				onRemove={onRemoveAttachment}
			/>
		</section>

		<footer className="flex flex-col gap-3 border-[color:color-mix(in_srgb,var(--vscode-foreground)_12%,transparent)] border-t pt-4">
			<div className="flex flex-wrap items-center justify-between gap-3 text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.6))] text-xs">
				<span>{autosaveStatus}</span>
			</div>
		</footer>
	</form>
);
