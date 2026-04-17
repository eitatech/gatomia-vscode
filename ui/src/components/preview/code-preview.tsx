import { useCallback, useMemo, useState } from "react";
import hljs from "highlight.js";

interface CodePreviewProps {
	content: string;
	language: string;
	fileName?: string;
}

export const CodePreview = ({
	content,
	language,
	fileName,
}: CodePreviewProps) => {
	const [copied, setCopied] = useState(false);

	const highlighted = useMemo(() => {
		try {
			if (language && language !== "plaintext" && hljs.getLanguage(language)) {
				return hljs.highlight(content, {
					language,
					ignoreIllegals: true,
				}).value;
			}
			return hljs.highlightAuto(content).value;
		} catch {
			return content
				.replace(/&/g, "&amp;")
				.replace(/</g, "&lt;")
				.replace(/>/g, "&gt;");
		}
	}, [content, language]);

	const lineCount = useMemo(() => content.split("\n").length, [content]);

	const lineNumbers = useMemo(
		() => Array.from({ length: lineCount }, (_, i) => i + 1),
		[lineCount]
	);

	const handleCopy = useCallback(() => {
		navigator.clipboard
			.writeText(content)
			.then(() => {
				setCopied(true);
				setTimeout(() => setCopied(false), 2000);
			})
			.catch(() => {
				// Clipboard API may not be available
			});
	}, [content]);

	return (
		<div className="flex flex-col gap-2">
			<div className="flex items-center justify-between rounded-t border border-[color:var(--vscode-input-border,#3c3c3c)] border-b-0 bg-[color:var(--vscode-titleBar-activeBackground,#1e1e1e)] px-3 py-1.5">
				<div className="flex items-center gap-2">
					{fileName && (
						<span className="font-medium text-[color:var(--vscode-foreground)] text-sm">
							{fileName}
						</span>
					)}
					<span className="rounded bg-[color:var(--vscode-badge-background,#4d4d4d)] px-1.5 py-0.5 text-[color:var(--vscode-badge-foreground,#fff)] text-xs">
						{language}
					</span>
					<span className="text-[color:var(--vscode-descriptionForeground)] text-xs">
						{lineCount} lines
					</span>
				</div>
				<button
					className="rounded border border-[color:var(--vscode-button-border,transparent)] bg-[color:var(--vscode-button-secondaryBackground,#3c3c3c)] px-2 py-0.5 text-[color:var(--vscode-button-secondaryForeground)] text-xs transition-colors hover:bg-[color:var(--vscode-button-secondaryHoverBackground)]"
					onClick={handleCopy}
					type="button"
				>
					{copied ? "Copied!" : "Copy"}
				</button>
			</div>
			<div className="overflow-auto rounded-b border border-[color:var(--vscode-input-border,#3c3c3c)] bg-[color:var(--vscode-editor-background)]">
				<div className="flex">
					<div
						aria-hidden="true"
						className="select-none border-[color:var(--vscode-input-border,#3c3c3c)] border-r px-2 py-3 text-right text-[color:var(--vscode-editorLineNumber-foreground,#858585)] text-xs leading-5"
					>
						{lineNumbers.map((num) => (
							<div key={num}>{num}</div>
						))}
					</div>
					<pre className="m-0 flex-1 overflow-x-auto p-3 text-sm leading-5">
						<code
							className="hljs"
							/* biome-ignore lint/security/noDangerouslySetInnerHtml: Content is sanitized by highlight.js */
							dangerouslySetInnerHTML={{ __html: highlighted }}
						/>
					</pre>
				</div>
			</div>
		</div>
	);
};
