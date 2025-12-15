import { Button } from "@/components/ui/button";
import { useState } from "react";
import type { DocumentArtifact } from "@/features/preview/types";

interface UpdateDocumentButtonProps {
	document: DocumentArtifact;
	onUpdate: (additionalContext?: string) => Promise<void>;
}

export function UpdateDocumentButton({
	document,
	onUpdate,
}: UpdateDocumentButtonProps) {
	const [isUpdating, setIsUpdating] = useState(false);
	const [showDetails, setShowDetails] = useState(false);
	const [additionalContext, setAdditionalContext] = useState("");

	if (!(document.isOutdated && document.outdatedInfo)) {
		return null;
	}

	const handleUpdate = async () => {
		setIsUpdating(true);
		try {
			await onUpdate(additionalContext || undefined);
			setAdditionalContext("");
			setShowDetails(false);
		} catch (error) {
			console.error("Failed to update document:", error);
		} finally {
			setIsUpdating(false);
		}
	};

	const { changedDependencies } = document.outdatedInfo;
	const depCount = changedDependencies.length;

	return (
		<div className="rounded border border-[color:var(--vscode-inputValidation-warningBorder,#ff8c00)] bg-[color:var(--vscode-inputValidation-warningBackground,#352a05)] p-4">
			<div className="flex items-start justify-between gap-3">
				<div className="flex-1">
					<h3 className="font-semibold text-[color:var(--vscode-foreground)] text-base">
						Document Update Available
					</h3>
					<p className="mt-1 text-[color:var(--vscode-descriptionForeground)] text-sm">
						{depCount === 1
							? "A dependent document has"
							: `${depCount} dependent documents have`}{" "}
						been updated. Update this document to maintain consistency.
					</p>

					{showDetails && (
						<div className="mt-3 space-y-2">
							<p className="font-medium text-[color:var(--vscode-foreground)] text-xs uppercase tracking-wide">
								Changed Dependencies:
							</p>
							<ul className="ml-4 list-disc space-y-1 text-[color:var(--vscode-descriptionForeground)] text-sm">
								{changedDependencies.map((dep) => (
									<li key={dep.documentId}>
										{dep.documentId}
										<span className="ml-2 text-xs opacity-70">
											({dep.documentType})
										</span>
									</li>
								))}
							</ul>

							<label className="mt-3 flex flex-col gap-2 text-sm">
								<span className="font-medium text-[color:var(--vscode-foreground)]">
									Additional Context (optional)
								</span>
								<textarea
									className="min-h-[80px] resize-none rounded border bg-[color:var(--vscode-input-background)] px-3 py-2 text-[color:var(--vscode-input-foreground)]"
									onChange={(e) => setAdditionalContext(e.target.value)}
									placeholder="Add any specific instructions or context..."
									value={additionalContext}
								/>
							</label>
						</div>
					)}
				</div>
			</div>

			<div className="mt-3 flex gap-2">
				<Button
					disabled={isUpdating}
					onClick={handleUpdate}
					size="sm"
					variant="default"
				>
					{isUpdating ? "Updating..." : "Update Document"}
				</Button>
				<Button
					onClick={() => setShowDetails(!showDetails)}
					size="sm"
					variant="ghost"
				>
					{showDetails ? "Hide Details" : "Show Details"}
				</Button>
			</div>
		</div>
	);
}
