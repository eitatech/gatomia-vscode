import { useCallback, useEffect, useMemo, useState } from "react";
import { useSyncExternalStore } from "react";
import { vscode } from "@/bridge/vscode";
import { renderPreviewMarkdown } from "@/lib/markdown/preview-renderer";
import { DocumentOutline } from "@/components/preview/document-outline";
import { PreviewFormContainer } from "@/components/forms/preview-form-container";
import { submitForm } from "@/features/preview/api/form-bridge";
import {
	RefineDialog,
	type RefineDialogValues,
} from "@/components/refine/refine-dialog";
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

	useEffect(() => {
		const handler = (event: MessageEvent<PreviewExtensionMessage>) => {
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

		window.addEventListener("message", handler);
		return () => {
			window.removeEventListener("message", handler);
		};
	}, []);

	useEffect(() => {
		const readyMessage: PreviewWebviewMessage = { type: "preview/ready" };
		vscode.postMessage(readyMessage);
	}, []);

	const description = useMemo(() => {
		if (staleReason) {
			return staleReason;
		}
		if (!metadata?.documentType) {
			return "Select a document to load its preview.";
		}

		return `Rendering ${metadata.documentType} in Markdown preview.`;
	}, [metadata, staleReason]);

	const renderedSections = useMemo(() => {
		const sections = metadata?.sections ?? [];
		return sections.map((section) => ({
			...section,
			html: section.body ? renderPreviewMarkdown(section.body) : "",
		}));
	}, [metadata?.sections]);

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
						<h1 className="font-semibold text-xl">{metadata.title}</h1>
						<p className="text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.65))] text-sm">
							{description}
						</p>
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
						/>
						<button
							className="rounded border border-[color:var(--vscode-button-border,transparent)] bg-[color:var(--vscode-button-background)] px-3 py-1 text-[color:var(--vscode-button-foreground)] text-sm"
							onClick={openInEditor}
							type="button"
						>
							Open in Editor
						</button>
					</div>
				</div>
				<dl className="grid grid-cols-2 gap-3 rounded border border-[color:var(--vscode-input-border,#3c3c3c)] bg-[color:var(--vscode-editor-background)] px-3 py-3 text-sm md:grid-cols-4">
					<div>
						<dt className="text-[color:var(--vscode-descriptionForeground)] text-xs uppercase tracking-wide">
							Type
						</dt>
						<dd>{metadata.documentType}</dd>
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
			</header>

			<div className="grid h-full gap-4 md:grid-cols-[240px_1fr]">
				<DocumentOutline
					onNavigate={scrollToSection}
					sections={metadata.sections}
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
									<h2 className="font-semibold text-lg">{section.title}</h2>
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
			</div>
		</div>
	);
};
