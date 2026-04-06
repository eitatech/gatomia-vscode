import { useCallback, useEffect, useMemo, useState } from "react";
import { MessageSquarePlus, Pencil } from "lucide-react";
import { useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";
import mermaid from "mermaid";
import { vscode } from "@/bridge/vscode";
import { renderPreviewMarkdown } from "@/lib/markdown/preview-renderer";
import { toFriendlyName } from "@/lib/document-title-utils";
import { DocumentOutline } from "@/components/preview/document-outline";
import { MermaidViewer } from "@/components/preview/mermaid-viewer";
import { PreviewFormContainer } from "@/components/forms/preview-form-container";
import { submitForm } from "@/features/preview/api/form-bridge";
import {
	RefineDialog,
	type RefineDialogValues,
} from "@/components/refine/refine-dialog";
import { UpdateDocumentButton } from "@/components/refine/update-document-button";
import { submitRefinement } from "@/features/preview/api/refine-bridge";
import type { PreviewExtensionMessage, PreviewWebviewMessage } from "./types";
import { PreviewFallback } from "./states/preview-fallback";
import { previewStore } from "./stores/preview-store";
import { RefineConfirmation } from "./components/refine-confirmation";

const ISSUE_TYPE_LABELS: Record<string, string> = {
	missingDetail: "Missing Detail",
	incorrectInfo: "Incorrect Info",
	missingAsset: "Missing Asset",
	other: "Other",
};

const PARAGRAPH_OPEN_PATTERN = /^<p>/;
const PARAGRAPH_CLOSE_PATTERN = /<\/p>\s*$/;

// Handler for window messages from extension
const handleExtensionMessage = (
	event: MessageEvent<PreviewExtensionMessage>
) => {
	const payload = event.data;
	if (!payload || typeof payload !== "object") {
		return;
	}

	switch (payload.type) {
		case "preview/load-document":
			previewStore.setDocument(payload.payload);
			break;
		case "preview/show-placeholder":
			previewStore.markStale(payload.payload?.reason);
			break;
		default:
			break;
	}
};

// Handler for task group button clicks
const handleTaskGroupClick = (event: MouseEvent) => {
	const target = event.target as HTMLElement;
	if (
		target.tagName === "BUTTON" &&
		target.hasAttribute("data-execute-task-group")
	) {
		const groupName = target.getAttribute("data-execute-task-group");
		if (groupName) {
			const message: PreviewWebviewMessage = {
				type: "preview/execute-task-group",
				payload: { groupName },
			};
			vscode.postMessage(message);
		}
	}
};

// Handler for file link clicks
const handleLinkClick = (event: MouseEvent) => {
	const target = event.target as HTMLElement;
	if (target.tagName === "A") {
		const href = target.getAttribute("href");
		if (href && !href.startsWith("http") && href.endsWith(".md")) {
			event.preventDefault();
			const message: PreviewWebviewMessage = {
				type: "preview/open-file",
				payload: { filePath: href },
			};
			vscode.postMessage(message);
		}
	}
};

// biome-ignore lint: Component requires multiple hooks and state management
export const PreviewApp = () => {
	const snapshot = useSyncExternalStore(
		previewStore.subscribe,
		previewStore.getSnapshot,
		previewStore.getSnapshot
	);
	const metadata = snapshot.document;
	const staleReason = snapshot.staleReason;
	const [lastRefinement, setLastRefinement] = useState<{
		requestId: string;
		issueType: string;
		sectionLabel?: string;
		description: string;
		message?: string;
	} | null>(null);
	const [tocVisible, setTocVisible] = useState(false);

	useEffect(() => {
		window.addEventListener("message", handleExtensionMessage);
		document.addEventListener("click", handleTaskGroupClick);
		document.addEventListener("click", handleLinkClick);

		return () => {
			window.removeEventListener("message", handleExtensionMessage);
			document.removeEventListener("click", handleTaskGroupClick);
			document.removeEventListener("click", handleLinkClick);
		};
	}, []);

	useEffect(() => {
		const readyMessage: PreviewWebviewMessage = { type: "preview/ready" };
		vscode.postMessage(readyMessage);
	}, []);

	// Initialize mermaid diagrams when content changes - runs after initial render
	// Mount interactive React components into the static markup
	// biome-ignore lint/correctness/useExhaustiveDependencies: metadata.sections is necessary for re-renders
	useEffect(() => {
		mermaid.initialize({
			startOnLoad: false,
			theme: "dark",
			// Use antiscript to allow text labels (HTML) but prevent script execution.
			// We also sanitize the output with DOMPurify in the viewer.
			securityLevel: "antiscript",
			themeVariables: {
				primaryColor: "#3c3c3c",
				primaryTextColor: "#cccccc",
				primaryBorderColor: "#555555",
				lineColor: "#888888",
				secondaryColor: "#252526",
				tertiaryColor: "#1e1e1e",
			},
		});

		const roots: ReturnType<typeof createRoot>[] = [];

		// Simple hash function for IDs
		const hashString = (str: string): string => {
			let hash = 0;
			for (let i = 0; i < str.length; i++) {
				const char = str.charCodeAt(i);
				// biome-ignore lint/suspicious/noBitwiseOperators: hashing algo uses bitwise
				hash = (hash << 5) - hash + char;
				// biome-ignore lint/suspicious/noBitwiseOperators: hashing algo uses bitwise
				hash &= hash;
			}
			// biome-ignore lint/suspicious/noBitwiseOperators: hashing algo uses bitwise
			return (hash >>> 0).toString(16).padStart(8, "0");
		};

		// Delay to allow DOM to render
		const timeoutId = setTimeout(() => {
			const diagrams = document.querySelectorAll<HTMLElement>(
				".mermaid:not([data-processed])"
			);
			for (let i = 0; i < diagrams.length; i++) {
				const el = diagrams[i];
				el.dataset.processed = "true";
				const code = el.textContent || "";
				// Make empty to host the React component
				el.innerHTML = "";

				// Reset styles to allow component control
				el.style.backgroundColor = "transparent";
				el.style.padding = "0";

				// Use hash-based ID for stability matching reference implementation
				const hash = hashString(code);
				const id = `mermaid-${hash}-${i}`; // Append index to handle identical diagrams
				const root = createRoot(el);
				root.render(<MermaidViewer code={code} id={id} />);
				roots.push(root);
			}
		}, 100);

		return () => {
			clearTimeout(timeoutId);
			// Unmount roots to prevent memory leaks
			// roots.forEach((root) => root.unmount());
			// Note: Since the parent DOM nodes are likely removed by React's diffing of dangerousHtml,
			// explicit unmount might warn, but is good practice if nodes persist.
			// However in this specific case (dangerouslySetInnerHTML replacement), the nodes are destroyed.
			// We skip explicit unmount to avoid errors on detached nodes, keeping it simple.
			// Actually, let's do it safely:
			for (const root of roots) {
				try {
					root.unmount();
				} catch {
					// Ignore unmount errors
				}
			}
		};
	}, [metadata?.sections]);

	const description = useMemo(() => {
		if (staleReason) {
			return staleReason;
		}
		return null;
	}, [staleReason]);

	const renderedSections = useMemo(() => {
		const sections = metadata?.sections ?? [];
		return sections.map((section) => ({
			...section,
			titleHtml: section.title
				? renderPreviewMarkdown(section.title)
						.replace(PARAGRAPH_OPEN_PATTERN, "")
						.replace(PARAGRAPH_CLOSE_PATTERN, "")
				: "",
			html: section.body ? renderPreviewMarkdown(section.body) : "",
		}));
	}, [metadata?.sections]);

	const documentType = useMemo(() => {
		if (
			metadata?.filePath?.includes("/docs/") ||
			metadata?.filePath?.startsWith("docs/")
		) {
			return "doc";
		}
		return metadata?.documentType;
	}, [metadata?.filePath, metadata?.documentType]);

	const handleReload = () => {
		const message: PreviewWebviewMessage = { type: "preview/request-reload" };
		vscode.postMessage(message);
	};

	const dismissRefinementMessage = () => {
		setLastRefinement(null);
	};

	const handleFormSubmit = useCallback(
		async (payload: {
			documentId: string;
			sessionId: string;
			fields: Array<{
				fieldId: string;
				value: string | string[];
				dirty: boolean;
			}>;
			submittedAt: string;
		}) => {
			try {
				await submitForm(payload);
			} catch (error) {
				console.error("[PreviewApp] Form submission failed", error);
				throw error;
			}
		},
		[]
	);

	const handleRefineSubmit = useCallback(
		async (values: RefineDialogValues) => {
			if (!metadata) {
				throw new Error("Document metadata unavailable");
			}
			const result = await submitRefinement({
				documentId: metadata.documentId,
				documentType: metadata.documentType,
				documentVersion: metadata.version,
				sectionRef: values.sectionRef,
				issueType: values.issueType,
				description: values.description,
				actionType: "refine", // Manual refinement
			});
			const sectionLabel =
				values.sectionRef &&
				metadata.sections?.find((section) => section.id === values.sectionRef)
					?.title;
			setLastRefinement({
				requestId: result.requestId,
				issueType: values.issueType,
				sectionLabel: sectionLabel ?? values.sectionRef,
				description: values.description,
				message: result.message,
			});
		},
		[metadata]
	);

	const handleDocumentUpdate = useCallback(
		async (additionalContext?: string) => {
			if (!metadata) {
				throw new Error("Document metadata unavailable");
			}

			// Format changed dependencies for the prompt
			const changedDeps =
				metadata.outdatedInfo?.changedDependencies.map((dep) => ({
					documentId: dep.documentId,
					documentType: dep.documentType,
				})) || [];

			const result = await submitRefinement({
				documentId: metadata.documentId,
				documentType: metadata.documentType,
				documentVersion: metadata.version,
				issueType: "other", // Not a manual issue, but dependency sync
				description:
					additionalContext || "Synchronizing with updated dependencies",
				actionType: "update", // Dependency-triggered update
				changedDependencies: changedDeps,
			});

			setLastRefinement({
				requestId: result.requestId,
				issueType: "other",
				description: `Document updated based on ${changedDeps.length} dependency change(s)`,
				message: result.message,
			});
		},
		[metadata]
	);

	const openInEditor = () => {
		const message: PreviewWebviewMessage = { type: "preview/open-in-editor" };
		vscode.postMessage(message);
	};

	const scrollToSection = (sectionId: string) => {
		const element = document.getElementById(sectionId);
		element?.scrollIntoView({ behavior: "smooth", block: "start" });
	};

	if (!metadata) {
		return (
			<div className="flex h-full flex-col gap-3 px-4 py-4 text-[color:var(--vscode-foreground)]">
				<PreviewFallback
					actionLabel="Open document in editor"
					description="Choose any SpecKit document from the explorer to load a preview."
					onAction={openInEditor}
					title="No document selected"
				/>
			</div>
		);
	}

	return (
		<div className="flex h-full flex-col gap-3 px-4 py-4 text-[color:var(--vscode-foreground)]">
			<header className="flex flex-col gap-1">
				<div className="flex items-center justify-between gap-3">
					<div className="flex flex-col gap-1">
						<h1 className="font-semibold text-xl">
							{toFriendlyName(metadata.title)}
						</h1>
						{metadata.filePath && (
							<p className="text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.65))] text-xs">
								{metadata.filePath}
							</p>
						)}
						{description && (
							<p className="text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.65))] text-sm">
								{description}
							</p>
						)}
					</div>
					<div className="flex flex-wrap items-center gap-2">
						<RefineDialog
							documentTitle={metadata.title}
							onSubmit={handleRefineSubmit}
							sections={
								metadata.sections?.map((section) => ({
									id: section.id,
									title: section.title,
								})) ?? []
							}
							triggerLabel={<MessageSquarePlus className="h-4 w-4" />}
						/>
						<button
							aria-label="Toggle table of contents"
							aria-pressed={tocVisible}
							className="rounded border border-[color:var(--vscode-button-border,transparent)] bg-[color:var(--vscode-button-secondaryBackground,#3c3c3c)] px-2 py-1 text-[color:var(--vscode-button-secondaryForeground)] text-sm transition-colors hover:bg-[color:var(--vscode-button-secondaryHoverBackground)]"
							onClick={() => setTocVisible(!tocVisible)}
							title="Table of Contents"
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
									d="M4 6h16M4 12h10M4 18h14"
									strokeLinecap="round"
									strokeLinejoin="round"
								/>
							</svg>
						</button>
						<button
							aria-label="Edit"
							className="rounded border border-[color:var(--vscode-button-border,transparent)] bg-[color:var(--vscode-button-background)] px-3 py-1 text-[color:var(--vscode-button-foreground)] text-sm"
							onClick={openInEditor}
							type="button"
						>
							<Pencil className="h-4 w-4" />
						</button>
					</div>
				</div>
			</header>

			{/* Show update banner if document is outdated */}
			{metadata.isOutdated && (
				<UpdateDocumentButton
					document={metadata}
					onUpdate={handleDocumentUpdate}
				/>
			)}

			<DocumentOutline
				isVisible={tocVisible}
				onClose={() => setTocVisible(false)}
				onNavigate={scrollToSection}
				sections={renderedSections.map((s) => ({
					id: s.id,
					title: s.title,
					titleHtml: s.titleHtml,
				}))}
			/>

			<div className="flex h-full flex-col gap-4 overflow-hidden">
				<article className="flex flex-1 flex-col gap-6 overflow-y-auto rounded border border-[color:var(--vscode-input-border,#3c3c3c)] bg-[color:var(--vscode-editor-background)] px-5 py-4">
					{renderedSections.length === 0 ? (
						<PreviewFallback
							actionLabel="Open in editor"
							description="This document does not contain any headings. Open it in the editor to review the raw Markdown."
							onAction={openInEditor}
							title="No sections detected"
						/>
					) : (
						renderedSections.map((section) => (
							<section
								className="flex flex-col gap-2"
								id={section.id}
								key={section.id}
							>
								<h2
									className="font-semibold text-lg"
									/* biome-ignore lint/security/noDangerouslySetInnerHtml: Markdown is rendered via markdown-it before reaching the webview. */
									dangerouslySetInnerHTML={{ __html: section.titleHtml }}
								/>
								<div
									className="prose prose-invert max-w-none text-sm"
									/* biome-ignore lint/security/noDangerouslySetInnerHtml: Markdown is rendered via markdown-it before reaching the webview. */
									dangerouslySetInnerHTML={{ __html: section.html }}
								/>
							</section>
						))
					)}

					{staleReason && (
						<div
							aria-live="polite"
							className="flex flex-col gap-2 rounded border border-[color:var(--vscode-inputValidation-warningBorder,#e5c07b)] bg-[color:var(--vscode-inputValidation-warningBackground,#3b3222)] px-3 py-2 text-sm"
							role="alert"
						>
							<strong>{staleReason}</strong>
							<button
								className="self-start rounded border border-[color:var(--vscode-button-border,transparent)] bg-[color:var(--vscode-button-background)] px-3 py-1 text-[color:var(--vscode-button-foreground)]"
								onClick={handleReload}
								type="button"
							>
								Reload preview
							</button>
						</div>
					)}

					{lastRefinement && (
						<RefineConfirmation
							descriptionPreview={lastRefinement.description}
							issueType={
								ISSUE_TYPE_LABELS[lastRefinement.issueType] ??
								lastRefinement.issueType
							}
							message={lastRefinement.message}
							onDismiss={dismissRefinementMessage}
							requestId={lastRefinement.requestId}
							sectionRef={lastRefinement.sectionLabel ?? "Entire document"}
						/>
					)}
				</article>

				{(metadata.forms?.length ?? 0) > 0 && (
					<PreviewFormContainer
						documentId={metadata.documentId}
						fields={metadata.forms ?? []}
						onCancel={handleReload}
						onSubmit={handleFormSubmit}
						readOnly={metadata.permissions?.canEditForms === false}
						readOnlyReason={metadata.permissions?.reason}
						sessionId={metadata.sessionId ?? metadata.documentId}
					/>
				)}
			</div>

			<footer className="mt-auto border-[color:var(--vscode-widget-border,#3c3c3c)] border-t bg-[color:var(--vscode-editor-background)] p-4">
				<dl className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
					<div>
						<dt className="text-[color:var(--vscode-descriptionForeground)] text-xs uppercase tracking-wide">
							Type
						</dt>
						<dd>{documentType}</dd>
					</div>
					<div>
						<dt className="text-[color:var(--vscode-descriptionForeground)] text-xs uppercase tracking-wide">
							Version
						</dt>
						<dd>{metadata.version ?? "—"}</dd>
					</div>
					<div>
						<dt className="text-[color:var(--vscode-descriptionForeground)] text-xs uppercase tracking-wide">
							Owner
						</dt>
						<dd>{metadata.owner ?? "—"}</dd>
					</div>
					<div>
						<dt className="text-[color:var(--vscode-descriptionForeground)] text-xs uppercase tracking-wide">
							Last Updated
						</dt>
						<dd>{metadata.updatedAt ?? "—"}</dd>
					</div>
				</dl>
			</footer>
		</div>
	);
};
