export interface OutlineSection {
	id: string;
	title: string;
	titleHtml?: string;
}

interface DocumentOutlineProps {
	sections?: OutlineSection[];
	onNavigate?: (sectionId: string) => void;
}

export const DocumentOutline = ({
	sections = [],
	onNavigate,
}: DocumentOutlineProps) => {
	if (sections.length === 0) {
		return null;
	}

	return (
		<nav
			aria-label="Document outline"
			className="rounded border border-[color:var(--vscode-input-border,#3c3c3c)] bg-[color:var(--vscode-tree-tableOddRowsBackground,transparent)] px-3 py-3 text-sm"
		>
			<p className="mb-2 text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.65))] text-xs uppercase tracking-wide">
				Outline
			</p>
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
