import { type ExtensionContext, type Uri, commands, window } from "vscode";
import { DocumentTemplateProcessor } from "../../services/document-template-processor";

/**
 * Register commands related to document versioning and ownership.
 */
export function registerDocumentVersioningCommands(
	context: ExtensionContext
): void {
	const processor = DocumentTemplateProcessor.getInstance(context);

	// Command to process a newly created document
	const processNewDocCommand = commands.registerCommand(
		"gatomia.processNewDocument",
		async (uri?: Uri) => {
			const targetUri = uri || window.activeTextEditor?.document.uri;
			if (!targetUri) {
				window.showErrorMessage(
					"No document selected. Please open a markdown file."
				);
				return;
			}

			try {
				await processor.processNewDocument(targetUri);
				window.showInformationMessage(
					"Document processed: version 1.0 with author information."
				);
			} catch (error) {
				window.showErrorMessage(
					`Failed to process document: ${error instanceof Error ? error.message : String(error)}`
				);
			}
		}
	);

	// Command to increment version of existing document
	const updateDocVersionCommand = commands.registerCommand(
		"gatomia.updateDocumentVersion",
		async (uri?: Uri) => {
			const targetUri = uri || window.activeTextEditor?.document.uri;
			if (!targetUri) {
				window.showErrorMessage(
					"No document selected. Please open a markdown file."
				);
				return;
			}

			try {
				await processor.processDocumentUpdate(targetUri);
				const metadata = await processor.getDocumentMetadata(targetUri);
				window.showInformationMessage(
					`Document updated to version ${metadata.version}`
				);
			} catch (error) {
				window.showErrorMessage(
					`Failed to update document version: ${error instanceof Error ? error.message : String(error)}`
				);
			}
		}
	);

	// Command to show document metadata
	const showMetadataCommand = commands.registerCommand(
		"gatomia.showDocumentMetadata",
		async (uri?: Uri) => {
			const targetUri = uri || window.activeTextEditor?.document.uri;
			if (!targetUri) {
				window.showErrorMessage(
					"No document selected. Please open a markdown file."
				);
				return;
			}

			try {
				const metadata = await processor.getDocumentMetadata(targetUri);
				window.showInformationMessage(
					`Version: ${metadata.version} | Owner: ${metadata.owner}`
				);
			} catch (error) {
				window.showErrorMessage(
					`Failed to read document metadata: ${error instanceof Error ? error.message : String(error)}`
				);
			}
		}
	);

	context.subscriptions.push(
		processNewDocCommand,
		updateDocVersionCommand,
		showMetadataCommand
	);
}
