interface PreviewFallbackProps {
	title: string;
	description?: string;
	actionLabel?: string;
	onAction?: () => void;
}

export const PreviewFallback = ({
	title,
	description,
	actionLabel,
	onAction,
}: PreviewFallbackProps) => (
	<section className="flex flex-col gap-3 rounded border border-[color:var(--vscode-input-border,#3c3c3c)] bg-[color:var(--vscode-editor-background)] px-4 py-6 text-center">
		<div className="flex flex-col gap-1">
			<h2 className="font-semibold text-[color:var(--vscode-foreground)] text-lg">
				{title}
			</h2>
			{description ? (
				<p className="text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.65))] text-sm">
					{description}
				</p>
			) : null}
		</div>
		{actionLabel ? (
			<button
				className="mx-auto rounded border border-[color:var(--vscode-button-border,transparent)] bg-[color:var(--vscode-button-background)] px-3 py-1 text-[color:var(--vscode-button-foreground)] text-sm"
				onClick={onAction}
				type="button"
			>
				{actionLabel}
			</button>
		) : null}
	</section>
);
