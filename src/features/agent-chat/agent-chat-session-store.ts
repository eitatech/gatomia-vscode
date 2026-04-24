/**
 * AgentChatSessionStore — workspaceState-backed persistence for the Agent
 * Chat Panel feature.
 *
 * Implements:
 *   - T009a: manifest + transcript CRUD, concurrency mutex,
 *            onDidChangeManifest emitter, schema-versioned layout.
 *   - T009b: archival (count / size thresholds), retention eviction with
 *            orphaned-worktree migration, flushForDeactivation()
 *            single-atomic-update contract, idempotent restart restore.
 *
 * @see specs/018-agent-chat-panel/contracts/agent-chat-session-storage.md
 * @see specs/018-agent-chat-panel/data-model.md §3
 */

import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { EventEmitter } from "vscode";
import {
	AGENT_CHAT_STORAGE_KEYS,
	type AgentChatSession,
	type AgentChatSettings,
	type ChatMessage,
	type CreateSessionInput,
	DEFAULT_AGENT_CHAT_SETTINGS,
	type OrphanedWorktreeEntry,
	type OrphanedWorktreeList,
	type SessionManifest,
	type SessionManifestEntry,
	type SystemChatMessage,
	TERMINAL_STATES,
	transcriptKeyFor,
} from "./types";

// ============================================================================
// Dependencies injected by constructor
// ============================================================================

/**
 * Minimal Memento interface (compatible with `vscode.Memento` /
 * `ExtensionContext.workspaceState`).
 */
export interface AgentChatMemento {
	get<T>(key: string, defaultValue?: T): T | undefined;
	update(key: string, value: unknown): Thenable<void>;
	keys?(): readonly string[];
}

/**
 * Archive IO abstraction. Injected so tests do not touch the filesystem.
 * Production callers pass an implementation backed by
 * `vscode.workspace.fs.writeFile` rooted at `globalStorageUri`.
 */
export interface AgentChatArchiveWriter {
	/**
	 * Append archived messages to a session's archive folder. Returns the
	 * filename (relative to `<globalStorage>/agent-chat/<sessionId>/`) that
	 * received the append.
	 */
	appendLines(sessionId: string, messages: ChatMessage[]): Promise<string>;

	/** Read a page of archived messages from disk. */
	readLines(
		sessionId: string,
		offset: number,
		limit: number
	): Promise<ChatMessage[]>;
}

export interface AgentChatSessionStoreOptions {
	workspaceState: AgentChatMemento;
	archive: AgentChatArchiveWriter;
	/**
	 * Called during `initialize()` for every non-terminal cloud session so
	 * spec 016's polling can re-attach. Optional — omit in tests that do not
	 * exercise cloud sessions.
	 */
	cloudAttach?: (cloudSessionLocalId: string) => Promise<void>;
	/**
	 * Synchronous predicate used during `initialize()` to determine whether a
	 * worktree path still exists. Defaults to `fs.existsSync`; overridden in
	 * tests.
	 */
	worktreeExists?: (absolutePath: string) => boolean;
	/** Clock injection for deterministic tests. Defaults to `Date.now()`. */
	now?: () => number;
}

// ============================================================================
// Internal constants
// ============================================================================

/** Archive threshold (research R4). */
const MAX_TRANSCRIPT_MESSAGES = 10_000;
const MAX_TRANSCRIPT_BYTES = 2 * 1024 * 1024; // 2 MB
const ARCHIVE_PIVOT_RATIO = 0.25;

/** Retention cap (research R4). */
const MAX_MANIFEST_SESSIONS = 100;

/** Current schema version. */
const SCHEMA_VERSION = 1;

// ============================================================================
// Persisted transcript shape
// ============================================================================

interface TranscriptFile {
	schemaVersion: typeof SCHEMA_VERSION;
	sessionId: string;
	messages: ChatMessage[];
	hasArchive: boolean;
	latestArchiveFile?: string;
	updatedAt: number;
}

// ============================================================================
// Store
// ============================================================================

export class AgentChatSessionStore {
	private readonly workspaceState: AgentChatMemento;
	private readonly archive: AgentChatArchiveWriter;
	private readonly cloudAttach?: (localId: string) => Promise<void>;
	private readonly worktreeExists: (absolutePath: string) => boolean;
	private readonly now: () => number;

	/**
	 * Per-session aggregate cache. Rebuilt in memory on every write so the
	 * canonical state lives in `workspaceState`; this cache is just for O(1)
	 * reads between writes.
	 */
	private readonly sessions = new Map<string, AgentChatSession>();

	/**
	 * Serialisation chain. Every mutation `.enqueue()`s onto this chain so
	 * concurrent writes never interleave.
	 */
	private writeChain: Promise<void> = Promise.resolve();

	private readonly _onDidChangeManifest = new EventEmitter<SessionManifest>();
	readonly onDidChangeManifest = this._onDidChangeManifest.event;

	constructor(options: AgentChatSessionStoreOptions) {
		this.workspaceState = options.workspaceState;
		this.archive = options.archive;
		this.cloudAttach = options.cloudAttach;
		this.worktreeExists = options.worktreeExists ?? existsSync;
		this.now = options.now ?? Date.now;
	}

	// ------------------------------------------------------------------
	// Public API
	// ------------------------------------------------------------------

	/**
	 * Load manifest, run restart-restore logic (FR-019a/b/c), and populate the
	 * in-memory cache. Safe to call multiple times; subsequent calls are no-ops
	 * for already-restored sessions (idempotent).
	 *
	 * @see contracts/agent-chat-session-storage.md §6.1
	 */
	async initialize(): Promise<void> {
		const manifest = this.readManifest();
		for (const entry of manifest.sessions) {
			this.sessions.set(entry.id, this.hydrateSession(entry));
		}

		let manifestDirty = false;
		for (const entry of manifest.sessions) {
			const wasStamped = await this.restoreEntry(entry);
			manifestDirty = manifestDirty || wasStamped;
		}

		if (manifestDirty) {
			await this.persistManifest(manifest);
		}
	}

	/**
	 * Per-entry restart-restore logic. Returns `true` when the entry was mutated
	 * (caller persists the manifest once at the end).
	 */
	private async restoreEntry(entry: SessionManifestEntry): Promise<boolean> {
		let mutated = false;
		const previousState = entry.lifecycleState;

		if (this.shouldStampAcpShutdown(entry)) {
			entry.lifecycleState = "ended-by-shutdown";
			entry.endedAt = entry.endedAt ?? this.now();
			entry.updatedAt = this.now();
			this.refreshCacheEntry(entry);
			mutated = true;
		}

		if (
			entry.source === "acp" &&
			(previousState !== "ended-by-shutdown" ||
				!this.hasTailShutdownMarker(entry.id)) &&
			this.needsShutdownMarker(entry.id)
		) {
			await this.appendSystemMessageInternal(entry.id, {
				kind: "ended-by-shutdown",
				content: "Session ended because VS Code closed.",
			});
		}

		if (
			entry.source === "cloud" &&
			!TERMINAL_STATES.has(entry.lifecycleState) &&
			entry.cloudSessionLocalId &&
			this.cloudAttach
		) {
			await this.cloudAttach(entry.cloudSessionLocalId);
		}

		if (
			entry.executionTargetKind === "worktree" &&
			entry.worktreePath &&
			!this.worktreeExists(entry.worktreePath) &&
			this.needsWorktreeCleanedMarker(entry.id)
		) {
			await this.appendSystemMessageInternal(entry.id, {
				kind: "worktree-cleaned",
				content: `Worktree at ${entry.worktreePath} no longer exists on disk.`,
			});
		}

		return mutated;
	}

	private shouldStampAcpShutdown(entry: SessionManifestEntry): boolean {
		return entry.source === "acp" && !TERMINAL_STATES.has(entry.lifecycleState);
	}

	/**
	 * Create a new session and persist the manifest + empty transcript.
	 */
	createSession(input: CreateSessionInput): Promise<AgentChatSession> {
		return this.enqueue(async () => {
			const manifest = this.readManifest();
			const id = randomUUID();
			const createdAt = input.createdAt ?? this.now();

			const session: AgentChatSession = {
				id,
				source: input.source,
				agentId: input.agentId,
				agentDisplayName: input.agentDisplayName,
				capabilities: input.capabilities,
				selectedModeId: input.selectedModeId,
				selectedModelId: input.selectedModelId,
				executionTarget: input.executionTarget,
				lifecycleState: "initializing",
				trigger: input.trigger,
				worktree: input.worktree,
				cloud: input.cloud,
				createdAt,
				updatedAt: createdAt,
				workspaceUri: input.workspaceUri ?? "",
			};

			const entry = this.toManifestEntry(session);
			manifest.sessions.unshift(entry);
			await this.enforceRetention(manifest);

			await this.persistTranscript(id, {
				schemaVersion: SCHEMA_VERSION,
				sessionId: id,
				messages: [],
				hasArchive: false,
				updatedAt: createdAt,
			});
			await this.persistManifest(manifest);
			this.sessions.set(id, session);
			return session;
		});
	}

	/** Append messages to a session's transcript with archival as needed. */
	appendMessages(sessionId: string, messages: ChatMessage[]): Promise<void> {
		return this.enqueue(async () => {
			if (messages.length === 0) {
				return;
			}
			const file = this.readTranscript(sessionId);
			if (!file) {
				throw new Error(
					`[agent-chat-session-store] unknown session: ${sessionId}`
				);
			}
			file.messages.push(...messages);

			// Archival thresholds (research R4).
			if (
				file.messages.length > MAX_TRANSCRIPT_MESSAGES ||
				approxJsonByteLength(file.messages) > MAX_TRANSCRIPT_BYTES
			) {
				await this.archiveOldest(file);
				await this.markSessionArchived(sessionId);
			}

			file.updatedAt = this.now();
			await this.persistTranscript(sessionId, file);
			await this.touchManifestEntry(sessionId);
		});
	}

	/** Replace subsets of existing messages (e.g. deliveryStatus patches). */
	updateMessages(
		sessionId: string,
		updates: Array<{ id: string; patch: Partial<ChatMessage> }>
	): Promise<void> {
		return this.enqueue(async () => {
			const file = this.readTranscript(sessionId);
			if (!file) {
				return;
			}
			for (const update of updates) {
				const idx = file.messages.findIndex((m) => m.id === update.id);
				if (idx >= 0) {
					file.messages[idx] = {
						...file.messages[idx],
						...update.patch,
					} as ChatMessage;
				}
			}
			file.updatedAt = this.now();
			await this.persistTranscript(sessionId, file);
		});
	}

	/** Update manifest fields for a session (lifecycleState, endedAt, …). */
	updateSession(
		sessionId: string,
		patch: Partial<AgentChatSession>
	): Promise<void> {
		return this.enqueue(async () => {
			const manifest = this.readManifest();
			const entry = manifest.sessions.find((s) => s.id === sessionId);
			if (!entry) {
				return;
			}
			const session = this.sessions.get(sessionId);
			if (session) {
				Object.assign(session, patch, { updatedAt: this.now() });
				const refreshed = this.toManifestEntry(session);
				Object.assign(entry, refreshed);
			}
			manifest.updatedAt = this.now();
			await this.persistManifest(manifest);
		});
	}

	deleteSession(sessionId: string): Promise<void> {
		return this.enqueue(async () => {
			const manifest = this.readManifest();
			const idx = manifest.sessions.findIndex((s) => s.id === sessionId);
			if (idx < 0) {
				return;
			}
			const [removed] = manifest.sessions.splice(idx, 1);
			await this.workspaceState.update(transcriptKeyFor(sessionId), undefined);
			await this.migrateWorktreeIfOrphaned(removed);
			manifest.updatedAt = this.now();
			await this.persistManifest(manifest);
			this.sessions.delete(sessionId);
		});
	}

	readArchive(
		sessionId: string,
		offset: number,
		limit: number
	): Promise<ChatMessage[]> {
		return this.archive.readLines(sessionId, offset, limit);
	}

	getSession(sessionId: string): Promise<AgentChatSession | undefined> {
		return Promise.resolve(this.sessions.get(sessionId));
	}

	listNonTerminal(): Promise<AgentChatSession[]> {
		const out: AgentChatSession[] = [];
		for (const session of this.sessions.values()) {
			if (!TERMINAL_STATES.has(session.lifecycleState)) {
				out.push(session);
			}
		}
		return Promise.resolve(out);
	}

	listActive(): Promise<AgentChatSession[]> {
		const out: AgentChatSession[] = [];
		for (const session of this.sessions.values()) {
			if (
				session.lifecycleState === "running" ||
				session.lifecycleState === "waiting-for-input" ||
				session.lifecycleState === "initializing"
			) {
				out.push(session);
			}
		}
		return Promise.resolve(out);
	}

	listRecent(): Promise<AgentChatSession[]> {
		const out: AgentChatSession[] = [];
		for (const session of this.sessions.values()) {
			if (TERMINAL_STATES.has(session.lifecycleState)) {
				out.push(session);
			}
		}
		return Promise.resolve(out);
	}

	getSettings(): Promise<AgentChatSettings> {
		const raw = this.workspaceState.get<AgentChatSettings>(
			AGENT_CHAT_STORAGE_KEYS.SETTINGS
		);
		if (!raw) {
			return Promise.resolve({ ...DEFAULT_AGENT_CHAT_SETTINGS });
		}
		// Merge defaults for missing fields (schema evolution safety).
		return Promise.resolve({
			schemaVersion: SCHEMA_VERSION,
			autoOpenPanelOnNewSession:
				raw.autoOpenPanelOnNewSession ??
				DEFAULT_AGENT_CHAT_SETTINGS.autoOpenPanelOnNewSession,
			maxConcurrentAcpSessions:
				raw.maxConcurrentAcpSessions ??
				DEFAULT_AGENT_CHAT_SETTINGS.maxConcurrentAcpSessions,
		});
	}

	/**
	 * Stamp non-terminal ACP sessions as ended-by-shutdown and persist the
	 * manifest in EXACTLY ONE workspaceState.update call. See
	 * contracts/agent-chat-session-storage.md §6.2 for the rationale.
	 */
	async flushForDeactivation(): Promise<void> {
		const manifest = this.readManifest();
		const at = this.now();

		for (const entry of manifest.sessions) {
			if (
				entry.source === "acp" &&
				!TERMINAL_STATES.has(entry.lifecycleState)
			) {
				entry.lifecycleState = "ended-by-shutdown";
				entry.endedAt = at;
				entry.updatedAt = at;
				const cached = this.sessions.get(entry.id);
				if (cached) {
					cached.lifecycleState = "ended-by-shutdown";
					cached.endedAt = at;
					cached.updatedAt = at;
				}
			}
		}
		manifest.updatedAt = at;

		// Single atomic update; let any rejection propagate unchanged. No retry.
		await this.workspaceState.update(
			AGENT_CHAT_STORAGE_KEYS.MANIFEST,
			manifest
		);
		this._onDidChangeManifest.fire(manifest);
	}

	// ------------------------------------------------------------------
	// Internals
	// ------------------------------------------------------------------

	private enqueue<T>(fn: () => Promise<T>): Promise<T> {
		const next = this.writeChain.then(fn);
		// Swallow rejections in the chain so subsequent callers don't inherit them.
		this.writeChain = next.then(noop, noop);
		return next;
	}

	private readManifest(): SessionManifest {
		const raw = this.workspaceState.get<SessionManifest>(
			AGENT_CHAT_STORAGE_KEYS.MANIFEST
		);
		if (raw && Array.isArray(raw.sessions)) {
			return {
				schemaVersion: SCHEMA_VERSION,
				sessions: [...raw.sessions],
				updatedAt: raw.updatedAt ?? this.now(),
			};
		}
		return {
			schemaVersion: SCHEMA_VERSION,
			sessions: [],
			updatedAt: this.now(),
		};
	}

	private async persistManifest(manifest: SessionManifest): Promise<void> {
		await this.workspaceState.update(
			AGENT_CHAT_STORAGE_KEYS.MANIFEST,
			manifest
		);
		this._onDidChangeManifest.fire(manifest);
	}

	private readTranscript(sessionId: string): TranscriptFile | undefined {
		const raw = this.workspaceState.get<TranscriptFile>(
			transcriptKeyFor(sessionId)
		);
		if (!(raw && Array.isArray(raw.messages))) {
			return;
		}
		return { ...raw, messages: [...raw.messages] };
	}

	private async persistTranscript(
		sessionId: string,
		file: TranscriptFile
	): Promise<void> {
		await this.workspaceState.update(transcriptKeyFor(sessionId), file);
	}

	private toManifestEntry(session: AgentChatSession): SessionManifestEntry {
		return {
			id: session.id,
			source: session.source,
			agentId: session.agentId,
			agentDisplayName: session.agentDisplayName,
			lifecycleState: session.lifecycleState,
			executionTargetKind: session.executionTarget.kind,
			createdAt: session.createdAt,
			updatedAt: session.updatedAt,
			endedAt: session.endedAt,
			transcriptArchived: false,
			worktreePath: session.worktree?.absolutePath,
			cloudSessionLocalId: session.cloud?.cloudSessionLocalId,
		};
	}

	private hydrateSession(entry: SessionManifestEntry): AgentChatSession {
		return {
			id: entry.id,
			source: entry.source,
			agentId: entry.agentId,
			agentDisplayName: entry.agentDisplayName,
			// Capabilities are not serialized in the manifest; hydrate to "none"
			// and let the runner re-resolve on attach.
			capabilities: { source: "none" },
			executionTarget: hydrateExecutionTarget(entry),
			lifecycleState: entry.lifecycleState,
			trigger: { kind: "restore-from-persistence" },
			worktree: entry.worktreePath
				? {
						id: entry.id,
						absolutePath: entry.worktreePath,
						branchName: `gatomia/agent-chat/${entry.id}`,
						baseCommitSha: "",
						status: "in-use",
						createdAt: entry.createdAt,
					}
				: null,
			cloud: entry.cloudSessionLocalId
				? {
						providerId: "",
						cloudSessionLocalId: entry.cloudSessionLocalId,
					}
				: null,
			createdAt: entry.createdAt,
			updatedAt: entry.updatedAt,
			endedAt: entry.endedAt,
			workspaceUri: "",
		};
	}

	private refreshCacheEntry(entry: SessionManifestEntry): void {
		const cached = this.sessions.get(entry.id);
		if (cached) {
			cached.lifecycleState = entry.lifecycleState;
			cached.endedAt = entry.endedAt;
			cached.updatedAt = entry.updatedAt;
		} else {
			this.sessions.set(entry.id, this.hydrateSession(entry));
		}
	}

	private async touchManifestEntry(sessionId: string): Promise<void> {
		const manifest = this.readManifest();
		const entry = manifest.sessions.find((s) => s.id === sessionId);
		if (!entry) {
			return;
		}
		entry.updatedAt = this.now();
		manifest.updatedAt = this.now();
		// Persist immediately; callers are already inside the write chain.
		// Use persistManifest so `onDidChangeManifest` fires — the panel relies
		// on this signal to push `messages/appended` deltas to the webview.
		await this.persistManifest(manifest);
	}

	private async markSessionArchived(sessionId: string): Promise<void> {
		const manifest = this.readManifest();
		const entry = manifest.sessions.find((s) => s.id === sessionId);
		if (!entry) {
			return;
		}
		entry.transcriptArchived = true;
		manifest.updatedAt = this.now();
		await this.persistManifest(manifest);
	}

	private async archiveOldest(file: TranscriptFile): Promise<void> {
		const pivot = Math.max(
			1,
			Math.floor(file.messages.length * ARCHIVE_PIVOT_RATIO)
		);
		const chunk = file.messages.slice(0, pivot);
		const remaining = file.messages.slice(pivot);
		const archiveFile = await this.archive.appendLines(file.sessionId, chunk);

		const marker: SystemChatMessage = {
			id: randomUUID(),
			sessionId: file.sessionId,
			sequence: remaining.length > 0 ? remaining[0].sequence - 1 : 0,
			timestamp: this.now(),
			role: "system",
			kind: "restored-from-persistence",
			content: `Earlier transcript archived to ${archiveFile}. ${chunk.length} messages moved.`,
		};

		file.messages = [marker, ...remaining];
		file.hasArchive = true;
		file.latestArchiveFile = archiveFile;
	}

	private async enforceRetention(manifest: SessionManifest): Promise<void> {
		while (manifest.sessions.length > MAX_MANIFEST_SESSIONS) {
			// Retention evicts the entry with the oldest updatedAt (tail of the
			// list when sorted most-recent-first).
			manifest.sessions.sort((a, b) => b.updatedAt - a.updatedAt);
			const victim = manifest.sessions.pop();
			if (!victim) {
				break;
			}
			await this.workspaceState.update(transcriptKeyFor(victim.id), undefined);
			await this.migrateWorktreeIfOrphaned(victim);
			this.sessions.delete(victim.id);
		}
	}

	private async migrateWorktreeIfOrphaned(
		entry: SessionManifestEntry
	): Promise<void> {
		if (!entry.worktreePath) {
			return;
		}
		if (!this.worktreeExists(entry.worktreePath)) {
			return;
		}
		const list = this.readOrphanedList();
		const orphan: OrphanedWorktreeEntry = {
			sessionId: entry.id,
			absolutePath: entry.worktreePath,
			branchName: `gatomia/agent-chat/${entry.id}`,
			recordedAt: this.now(),
		};
		list.orphans.push(orphan);
		await this.workspaceState.update(
			AGENT_CHAT_STORAGE_KEYS.ORPHANED_WORKTREES,
			list
		);
	}

	private readOrphanedList(): OrphanedWorktreeList {
		const raw = this.workspaceState.get<OrphanedWorktreeList>(
			AGENT_CHAT_STORAGE_KEYS.ORPHANED_WORKTREES
		);
		if (raw && Array.isArray(raw.orphans)) {
			return { schemaVersion: SCHEMA_VERSION, orphans: [...raw.orphans] };
		}
		return { schemaVersion: SCHEMA_VERSION, orphans: [] };
	}

	private hasTailShutdownMarker(sessionId: string): boolean {
		const transcript = this.readTranscript(sessionId);
		if (!transcript || transcript.messages.length === 0) {
			return false;
		}
		const tail = transcript.messages.at(-1);
		return (
			tail?.role === "system" &&
			(tail as SystemChatMessage).kind === "ended-by-shutdown"
		);
	}

	private needsShutdownMarker(sessionId: string): boolean {
		return !this.hasTailShutdownMarker(sessionId);
	}

	private needsWorktreeCleanedMarker(sessionId: string): boolean {
		const transcript = this.readTranscript(sessionId);
		if (!transcript) {
			return false;
		}
		const tail = transcript.messages.at(-1);
		return !(
			tail?.role === "system" &&
			(tail as SystemChatMessage).kind === "worktree-cleaned"
		);
	}

	private async appendSystemMessageInternal(
		sessionId: string,
		body: { kind: SystemChatMessage["kind"]; content: string }
	): Promise<void> {
		const file = this.readTranscript(sessionId);
		if (!file) {
			return;
		}
		const lastSequence = file.messages.at(-1)?.sequence ?? -1;
		const marker: SystemChatMessage = {
			id: randomUUID(),
			sessionId,
			sequence: lastSequence + 1,
			timestamp: this.now(),
			role: "system",
			kind: body.kind,
			content: body.content,
		};
		file.messages.push(marker);
		file.updatedAt = this.now();
		await this.persistTranscript(sessionId, file);
	}
}

// ============================================================================
// Helpers
// ============================================================================

function approxJsonByteLength(messages: ChatMessage[]): number {
	// Cheap upper-bound estimate: each UTF-16 code unit is ≤2 bytes in UTF-8
	// for ASCII-heavy payloads. For chat content this is close enough to the
	// 2 MB threshold check.
	return JSON.stringify(messages).length * 2;
}

function hydrateExecutionTarget(
	entry: SessionManifestEntry
): AgentChatSession["executionTarget"] {
	if (entry.executionTargetKind === "worktree") {
		return { kind: "worktree", worktreeId: entry.id };
	}
	if (entry.executionTargetKind === "cloud") {
		return {
			kind: "cloud",
			providerId: "",
			cloudSessionId: entry.cloudSessionLocalId ?? "",
		};
	}
	return { kind: "local" };
}

function noop(): void {
	// Intentionally empty — used as a silent then/catch handler.
}
