import { window, Uri } from "vscode";
import type { IDocumentVersionService } from "./types";

/**
 * Command handler for resetting document version to 1.0.
 *
 * User Story 4 Extension: Reset Version Command
 * - Shows confirmation dialog before reset
 * - Resets version to "1.0" and updates owner
 * - Creates history entry with changeType = "reset"
 * - Refreshes Spec Explorer display
 *
 * Feature: 012-spec-version-tracking (Phase 7: T037)
 */
export async function resetDocumentVersionCommand(
	versionService: IDocumentVersionService,
	documentPathOrUri?: string | Uri
): Promise<void> {
	try {
		// Determine document path
		let documentPath: string;

		if (typeof documentPathOrUri === "string") {
			// Called with string path (e.g., from context menu)
			documentPath = documentPathOrUri;
		} else if (documentPathOrUri instanceof Uri) {
			// Called with URI (e.g., from tree view context)
			documentPath = documentPathOrUri.fsPath;
		} else {
			// Called without arguments - use active text editor
			const activeEditor = window.activeTextEditor;
			if (!activeEditor) {
				window.showErrorMessage(
					"No active document. Please open a document to reset its version."
				);
				return;
			}
			documentPath = activeEditor.document.uri.fsPath;
		}

		// Get current metadata for confirmation dialog
		let currentVersion = "unknown";
		try {
			const metadata = await versionService.getDocumentMetadata(documentPath);
			if (metadata) {
				currentVersion = metadata.version;
			}
		} catch {
			// If we can't get metadata, still allow reset
		}

		// Show confirmation dialog
		const fileName =
			Uri.file(documentPath).fsPath.split("/").pop() || "document";
		const confirmation = await window.showWarningMessage(
			`Reset version to 1.0 for "${fileName}"?\n\nCurrent version: ${currentVersion}\nThis action will create a version history entry but cannot be undone in the frontmatter.`,
			{ modal: true },
			"Reset to 1.0",
			"Cancel"
		);

		if (confirmation !== "Reset to 1.0") {
			return; // User cancelled
		}

		// Perform reset
		await versionService.resetDocumentVersion(documentPath);

		// Show success message
		window.showInformationMessage(`Version reset to 1.0 for "${fileName}"`);
	} catch (error) {
		const errorMessage =
			error instanceof Error ? error.message : "Unknown error";
		window.showErrorMessage(
			`Failed to reset document version: ${errorMessage}`
		);
		console.error("Error resetting document version:", error);
	}
}
