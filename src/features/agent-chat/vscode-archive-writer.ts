/**
 * VS Code implementation of {@link AgentChatArchiveWriter}.
 *
 * Writes archived transcript chunks to
 * `<globalStorageUri>/agent-chat/<sessionId>/<iso-timestamp>.jsonl` using
 * `vscode.workspace.fs` so the behaviour works in both desktop and web
 * extension hosts.
 *
 * Only exercised when a session exceeds 10k messages or 2MB (research R4);
 * kept intentionally minimal.
 *
 * @see contracts/agent-chat-session-storage.md
 */

import { Uri, workspace } from "vscode";
import type { AgentChatArchiveWriter } from "./agent-chat-session-store";
import type { ChatMessage } from "./types";

const ARCHIVE_ROOT = "agent-chat";
const FILE_TYPE_FILE = 1;

async function listArchiveFiles(dir: Uri): Promise<string[]> {
	try {
		const entries = (await workspace.fs.readDirectory(dir)) as [
			string,
			number,
		][];
		return entries
			.filter(([, type]) => type === FILE_TYPE_FILE)
			.map(([name]) => name)
			.sort();
	} catch {
		return [];
	}
}

async function readJsonlLines(
	uri: Uri,
	decoder: InstanceType<typeof TextDecoder>
): Promise<string[]> {
	const bytes = await workspace.fs.readFile(uri);
	return decoder.decode(bytes).split("\n").filter(Boolean);
}

function safeParseMessage(line: string): ChatMessage | undefined {
	try {
		return JSON.parse(line) as ChatMessage;
	} catch {
		return;
	}
}

function isDefined<T>(value: T | undefined): value is T {
	return value !== undefined;
}

/**
 * Create an archive writer rooted at the extension's global storage uri.
 */
export function createVscodeArchiveWriter(
	globalStorageUri: Uri
): AgentChatArchiveWriter {
	const encoder = new TextEncoder();
	const decoder = new TextDecoder("utf-8");

	async function ensureDir(dir: Uri): Promise<void> {
		try {
			await workspace.fs.createDirectory(dir);
		} catch {
			// Directory may already exist; `createDirectory` is idempotent per
			// the VS Code API contract but the mock in web hosts has thrown
			// before. Swallow and let subsequent read/write fail loudly.
		}
	}

	function sessionDir(sessionId: string): Uri {
		return Uri.joinPath(globalStorageUri, ARCHIVE_ROOT, sessionId);
	}

	function archiveFileName(): string {
		const iso = new Date().toISOString().replace(/[:.]/g, "-");
		return `${iso}.jsonl`;
	}

	return {
		async appendLines(
			sessionId: string,
			messages: ChatMessage[]
		): Promise<string> {
			const dir = sessionDir(sessionId);
			await ensureDir(dir);
			const name = archiveFileName();
			const target = Uri.joinPath(dir, name);
			const lines = messages.map((m) => JSON.stringify(m)).join("\n");
			const payload = encoder.encode(`${lines}\n`);
			await workspace.fs.writeFile(target, payload);
			return name;
		},

		async readLines(
			sessionId: string,
			offset: number,
			limit: number
		): Promise<ChatMessage[]> {
			const dir = sessionDir(sessionId);
			const files = await listArchiveFiles(dir);
			const allLines: string[] = [];
			for (const file of files) {
				const lines = await readJsonlLines(Uri.joinPath(dir, file), decoder);
				allLines.push(...lines);
			}
			const slice = allLines.slice(offset, offset + limit);
			return slice.map(safeParseMessage).filter(isDefined);
		},
	};
}
