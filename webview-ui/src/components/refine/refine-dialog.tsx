import { useMemo, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PreviewRefinementIssueType } from "@/features/preview/types";

export interface RefineDialogValues {
	sectionRef?: string;
	issueType: PreviewRefinementIssueType;
	description: string;
}

interface RefineDialogProps {
	documentTitle: string;
	sections: Array<{ id: string; title: string }>;
	onSubmit: (values: RefineDialogValues) => Promise<void>;
	onSubmitted?: () => void;
	triggerLabel?: string;
}

const ISSUE_TYPE_OPTIONS: Array<{
	value: PreviewRefinementIssueType;
	label: string;
}> = [
	{ value: "missingDetail", label: "Missing Detail" },
	{ value: "incorrectInfo", label: "Incorrect Info" },
	{ value: "missingAsset", label: "Missing Asset" },
	{ value: "other", label: "Other" },
];

const MIN_DESCRIPTION_LENGTH = 20;

export function RefineDialog({
	documentTitle,
	sections,
	onSubmit,
	onSubmitted,
	triggerLabel = "Refine Document",
}: RefineDialogProps) {
	const [isOpen, setIsOpen] = useState(false);
	const [issueType, setIssueType] = useState<PreviewRefinementIssueType | "">(
		""
	);
	const [sectionRef, setSectionRef] = useState<string>("");
	const [description, setDescription] = useState("");
	const [errors, setErrors] = useState<{
		issueType?: string;
		description?: string;
	}>({});
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [submitError, setSubmitError] = useState<string | null>(null);

	const handleOpen = (open: boolean) => {
		setIsOpen(open);
		if (!open) {
			setSubmitError(null);
		}
	};

	const sectionOptions = useMemo(() => sections ?? [], [sections]);

	const validate = () => {
		const nextErrors: { issueType?: string; description?: string } = {};
		if (!issueType) {
			nextErrors.issueType = "Select an issue type";
		}
		if (!description || description.trim().length < MIN_DESCRIPTION_LENGTH) {
			nextErrors.description = `Describe the issue in at least ${MIN_DESCRIPTION_LENGTH} characters`;
		}
		return nextErrors;
	};

	const resetForm = () => {
		setIssueType("");
		setSectionRef("");
		setDescription("");
		setErrors({});
	};

	const handleSubmit = async (event: FormEvent) => {
		event.preventDefault();
		const nextErrors = validate();
		setErrors(nextErrors);
		if (Object.keys(nextErrors).length > 0) {
			return;
		}

		setIsSubmitting(true);
		setSubmitError(null);
		try {
			await onSubmit({
				sectionRef: sectionRef || undefined,
				issueType: issueType as PreviewRefinementIssueType,
				description: description.trim(),
			});
			resetForm();
			handleOpen(false);
			onSubmitted?.();
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Failed to submit refinement";
			setSubmitError(message);
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<>
			<Button onClick={() => handleOpen(true)} size="sm" variant="secondary">
				{triggerLabel}
			</Button>
			{isOpen && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-[color:color-mix(in_srgb,var(--vscode-editor-background)_80%,#000000)]/80 px-4">
					<section className="w-full max-w-xl rounded border border-[color:var(--vscode-input-border,#3c3c3c)] bg-[color:var(--vscode-editor-background)] p-5 shadow-lg">
						<header className="mb-4 flex items-start justify-between gap-4">
							<div>
								<p className="text-[color:var(--vscode-descriptionForeground)] text-xs uppercase tracking-wide">
									Refine
								</p>
								<h2 className="font-semibold text-[color:var(--vscode-foreground)] text-lg">
									{documentTitle}
								</h2>
							</div>
							<button
								className="rounded px-2 py-1 text-[color:var(--vscode-descriptionForeground)] text-sm hover:bg-[color:var(--vscode-editor-selectionBackground)]"
								onClick={() => handleOpen(false)}
								type="button"
							>
								Close
							</button>
						</header>
						<form className="flex flex-col gap-4" onSubmit={handleSubmit}>
							<label className="flex flex-col gap-2 text-sm">
								<span className="font-medium text-[color:var(--vscode-foreground)]">
									Issue Type
								</span>
								<select
									className={cn(
										"rounded border bg-[color:var(--vscode-dropdown-background)] px-3 py-2 text-[color:var(--vscode-dropdown-foreground)]",
										errors.issueType &&
											"border-[color:var(--vscode-inputValidation-errorBorder,#be1100)]"
									)}
									onChange={(event) =>
										setIssueType(
											event.target.value as PreviewRefinementIssueType
										)
									}
									value={issueType}
								>
									<option value="">Select an option</option>
									{ISSUE_TYPE_OPTIONS.map((option) => (
										<option key={option.value} value={option.value}>
											{option.label}
										</option>
									))}
								</select>
								{errors.issueType && (
									<span className="text-[color:var(--vscode-inputValidation-errorForeground,#f48771)] text-xs">
										{errors.issueType}
									</span>
								)}
							</label>

							<label className="flex flex-col gap-2 text-sm">
								<span className="font-medium text-[color:var(--vscode-foreground)]">
									Section (optional)
								</span>
								<select
									className="rounded border bg-[color:var(--vscode-dropdown-background)] px-3 py-2 text-[color:var(--vscode-dropdown-foreground)]"
									onChange={(event) => setSectionRef(event.target.value)}
									value={sectionRef}
								>
									<option value="">Entire document</option>
									{sectionOptions.map((section) => (
										<option key={section.id} value={section.id}>
											{section.title}
										</option>
									))}
								</select>
							</label>

							<label className="flex flex-col gap-2 text-sm">
								<span className="font-medium text-[color:var(--vscode-foreground)]">
									Describe what needs refinement
								</span>
								<textarea
									className={cn(
										"min-h-[120px] resize-none rounded border bg-[color:var(--vscode-input-background)] px-3 py-2 text-[color:var(--vscode-input-foreground)]",
										errors.description &&
											"border-[color:var(--vscode-inputValidation-errorBorder,#be1100)]"
									)}
									onChange={(event) => setDescription(event.target.value)}
									placeholder="Add at least 20 characters..."
									value={description}
								/>
								{errors.description && (
									<span className="text-[color:var(--vscode-inputValidation-errorForeground,#f48771)] text-xs">
										{errors.description}
									</span>
								)}
							</label>

							{submitError && (
								<div className="rounded border border-[color:var(--vscode-inputValidation-errorBorder,#be1100)] bg-[color:var(--vscode-inputValidation-errorBackground,#5a1d1d)] px-3 py-2 text-[color:var(--vscode-errorForeground)] text-xs">
									{submitError}
								</div>
							)}

							<div className="flex justify-end gap-2">
								<Button
									onClick={() => handleOpen(false)}
									type="button"
									variant="ghost"
								>
									Cancel
								</Button>
								<Button disabled={isSubmitting} type="submit">
									{isSubmitting ? "Sending..." : "Submit"}
								</Button>
							</div>
						</form>
					</section>
				</div>
			)}
		</>
	);
}
