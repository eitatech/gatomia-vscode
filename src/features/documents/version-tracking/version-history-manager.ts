import type { ExtensionContext } from "vscode";
import type {
	IVersionHistoryManager,
	VersionHistoryEntry,
	DocumentState,
	WorkspaceVersionState,
} from "../../../types";

const WORKSPACE_STATE_KEY = "gatomia.versionTracking.state";
const MAX_HISTORY_ENTRIES = 50;
const SCHEMA_VERSION = "1.0";

/**
 * Manages version history and document state in VS Code workspace storage.
 * Implements FIFO rotation to limit history to 50 entries per document.
 */
export class VersionHistoryManager implements IVersionHistoryManager {
	private readonly context: ExtensionContext;

	constructor(context: ExtensionContext) {
		this.context = context;
	}

	/**
	 * Get version history for a specific document.
	 * Returns up to 50 most recent entries (FIFO rotation).
	 */
	async getHistory(documentPath: string): Promise<VersionHistoryEntry[]> {
		const state = await this.loadWorkspaceState();
		const documentState = state.documents[documentPath];

		if (!documentState?.history) {
			return [];
		}

		// Always return max 50 most recent entries
		if (documentState.history.length > MAX_HISTORY_ENTRIES) {
			return documentState.history.slice(-MAX_HISTORY_ENTRIES);
		}

		return documentState.history;
	}

	/**
	 * Add new version history entry for a document.
	 * Automatically applies FIFO rotation if >50 entries.
	 */
	async addEntry(
		documentPath: string,
		entry: VersionHistoryEntry
	): Promise<void> {
		const state = await this.loadWorkspaceState();

		// Initialize document state if doesn't exist
		if (!state.documents[documentPath]) {
			state.documents[documentPath] = {
				currentVersion: entry.newVersion,
				owner: entry.author,
				createdBy: entry.author,
				history: [],
			};
		}

		const docState = state.documents[documentPath];

		// Add entry to history
		docState.history.push(entry);

		// Apply FIFO rotation if exceeds max entries
		if (docState.history.length > MAX_HISTORY_ENTRIES) {
			docState.history = docState.history.slice(-MAX_HISTORY_ENTRIES);
		}

		await this.saveWorkspaceState(state);
	}

	/**
	 * Get current document state (cached metadata + history).
	 */
	async getDocumentState(
		documentPath: string
	): Promise<DocumentState | undefined> {
		const state = await this.loadWorkspaceState();
		return state.documents[documentPath];
	}

	/**
	 * Update cached document state (version, owner, lastIncrementTimestamp).
	 * Used to keep workspace state synchronized with frontmatter.
	 */
	async updateDocumentState(
		documentPath: string,
		partialState: Partial<DocumentState>
	): Promise<void> {
		const state = await this.loadWorkspaceState();

		// Initialize document state if doesn't exist
		if (!state.documents[documentPath]) {
			state.documents[documentPath] = {
				currentVersion: partialState.currentVersion ?? "1.0",
				owner: partialState.owner ?? "Unknown",
				createdBy: partialState.createdBy ?? "Unknown",
				history: [],
			};
		}

		// Merge updates with existing state
		Object.assign(state.documents[documentPath], partialState);

		await this.saveWorkspaceState(state);
	}

	/**
	 * Clear all version history for a document (used by reset command).
	 */
	async clearHistory(documentPath: string): Promise<void> {
		const state = await this.loadWorkspaceState();
		const docState = state.documents[documentPath];

		if (!docState) {
			// Document not tracked, nothing to clear
			return;
		}

		// Clear history and timestamp
		docState.history = [];
		docState.lastIncrementTimestamp = undefined;

		await this.saveWorkspaceState(state);
	}

	/**
	 * Get entire workspace version state (for debugging/export).
	 */
	getWorkspaceState(): Promise<WorkspaceVersionState> {
		return this.loadWorkspaceState();
	}

	/**
	 * Load workspace state from VS Code Memento API.
	 * Returns empty state if no state exists.
	 */
	private loadWorkspaceState(): WorkspaceVersionState {
		const state =
			this.context.workspaceState.get<WorkspaceVersionState>(
				WORKSPACE_STATE_KEY
			);

		if (!state) {
			return {
				schemaVersion: SCHEMA_VERSION,
				documents: {},
			};
		}

		return state;
	}

	/**
	 * Save workspace state to VS Code Memento API.
	 */
	private async saveWorkspaceState(
		state: WorkspaceVersionState
	): Promise<void> {
		await this.context.workspaceState.update(WORKSPACE_STATE_KEY, state);
	}
}
