interface RefineConfirmationProps {
	requestId: string;
	message?: string;
	issueType: string;
	sectionRef?: string;
	descriptionPreview?: string;
	onDismiss?: () => void;
}

export function RefineConfirmation({
	requestId,
	message,
	issueType,
	sectionRef,
	descriptionPreview,
	onDismiss,
}: RefineConfirmationProps) {
	return (
		<section className="rounded border border-[color:var(--vscode-inputValidation-infoBorder,#1a85ff)] bg-[color:var(--vscode-inputValidation-infoBackground,#051526)] px-4 py-3 text-[color:var(--vscode-foreground)] text-sm">
			<div className="flex items-start justify-between gap-3">
				<div>
					<h3 className="font-semibold text-base">Refinement submitted</h3>
					<p className="text-[color:var(--vscode-descriptionForeground)]">
						{message ??
							"We captured your feedback and queued it for processing."}
					</p>
				</div>
				{onDismiss && (
					<button
						className="text-[color:var(--vscode-descriptionForeground)] text-xs hover:underline"
						onClick={onDismiss}
						type="button"
					>
						Dismiss
					</button>
				)}
			</div>
			<dl className="mt-3 grid gap-2 text-[color:var(--vscode-descriptionForeground)] text-xs sm:grid-cols-2">
				<div>
					<dt className="uppercase tracking-wide">Request ID</dt>
					<dd className="text-[color:var(--vscode-foreground)]">{requestId}</dd>
				</div>
				<div>
					<dt className="uppercase tracking-wide">Issue Type</dt>
					<dd className="text-[color:var(--vscode-foreground)]">{issueType}</dd>
				</div>
				{sectionRef && (
					<div>
						<dt className="uppercase tracking-wide">Section</dt>
						<dd className="text-[color:var(--vscode-foreground)]">
							{sectionRef}
						</dd>
					</div>
				)}
			</dl>
			{descriptionPreview && (
				<div className="mt-3 rounded bg-[color:var(--vscode-editor-background)] px-3 py-2 text-[color:var(--vscode-foreground)] text-xs">
					{descriptionPreview}
				</div>
			)}
		</section>
	);
}
