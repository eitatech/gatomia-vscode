export interface OutlineSection {
	id: string;
	title: string;
	titleHtml?: string;
}

interface DocumentOutlineProps {
	sections?: OutlineSection[];
	onNavigate?: (sectionId: string) => void;
	isVisible?: boolean;
	onClose?: () => void;
}

export const DocumentOutline = ({
	sections = [],
	onNavigate,
	isVisible = true,
	onClose,
}: DocumentOutlineProps) => {
	if (sections.length === 0 || !isVisible) {
		return null;
	}

	return (
		<nav
			aria-label="Table of Contents"
			className="fixed top-12 right-4 z-50 max-h-[calc(100vh-6rem)] w-64 overflow-y-auto rounded border border-[color:var(--vscode-input-border,#3c3c3c)] bg-[color:var(--vscode-editor-background,#1e1e1e)] px-3 py-3 text-sm shadow-lg"
		>
			<div className="mb-2 flex items-center justify-between">
				<p className="text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.65))] text-xs uppercase tracking-wide">
					Table of Contents
				</p>
				{onClose && (
					<button
						aria-label="Close table of contents"
						className="rounded p-1 text-[color:var(--vscode-foreground)] opacity-70 transition-opacity hover:opacity-100"
						onClick={onClose}
						type="button"
					>
						<svg
							aria-hidden="true"
							className="h-4 w-4"
							fill="none"
							stroke="currentColor"
							strokeWidth={2}
							viewBox="0 0 24 24"
						>
							<path
								d="M6 18L18 6M6 6l12 12"
								strokeLinecap="round"
								strokeLinejoin="round"
							/>
						</svg>
					</button>
				)}
			</div>
			<ul className="flex flex-col gap-1">
				{sections.map((section) => (
					<li key={section.id}>
						<button
							className="w-full truncate rounded border border-transparent px-2 py-1 text-left text-[color:var(--vscode-foreground)] transition-colors hover:border-[color:var(--vscode-focusBorder,#0078d4)]"
							onClick={() => onNavigate?.(section.id)}
							type="button"
						>
							{section.titleHtml ? (
								<span
									/* biome-ignore lint/security/noDangerouslySetInnerHtml: Markdown is rendered via markdown-it before reaching the webview. */
									dangerouslySetInnerHTML={{ __html: section.titleHtml }}
								/>
							) : (
								section.title
							)}
						</button>
					</li>
				))}
			</ul>
		</nav>
	);
};
