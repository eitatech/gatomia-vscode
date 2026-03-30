/**
 * Devin VS Code Commands
 *
 * Registers and implements VS Code commands for Devin integration.
 * Currently provides the "Implement with Devin" command for single task delegation.
 *
 * @see specs/001-devin-integration/contracts/extension-api.ts:L243-L249
 */

import { commands, window, workspace } from "vscode";
import { join, dirname } from "node:path";
import { readFileSync, existsSync } from "node:fs";
import { parseTasksFromFile } from "../utils/task-parser";
import { DEVIN_COMMANDS } from "../features/devin/config";
import type { DevinCredentialsManager } from "../features/devin/devin-credentials-manager";
import type {
	DevinSessionManager,
	ReferenceDocument,
} from "../features/devin/devin-session-manager";
import type { DevinProgressPanel } from "../panels/devin-progress-panel";
import { showDevinErrorNotification } from "../features/devin/error-notifications";
import {
	getRemoteUrl,
	validateGitState,
} from "../features/devin/git-validator";
import { commitAndPush } from "../features/devin/git-operations";
import {
	showGitValidationError,
	confirmTaskInitiation,
	showSessionStartedNotification,
} from "../features/devin/task-initiation-ui";
import { BatchProcessor } from "../features/devin/batch-processor";
import {
	confirmBatchInitiation,
	showBatchResultNotification,
} from "../features/devin/batch-initiation-ui";
import { runBatchWithProgress } from "../features/devin/batch-progress-tracker";
import {
	readSpecContent,
	extractIncompleteTasks,
	extractTaskFromSpec,
} from "../features/devin/spec-content-reader";
import {
	logTaskStart,
	logTaskStartSuccess,
	logTaskStartFailure,
} from "../features/devin/telemetry";
import { isDevinError } from "../features/devin/errors";

// ============================================================================
// Types
// ============================================================================

/**
 * Context passed when invoking "Implement with Devin" from a spec task.
 */
export interface DevinTaskContext {
	readonly specPath: string;
	readonly taskId: string;
	readonly title: string;
	readonly description: string;
	readonly priority: "P1" | "P2" | "P3";
	readonly acceptanceCriteria?: string[];
}

/**
 * Shape of the tree item passed from the Spec Explorer when
 * the "Run with Devin" inline action is clicked on a task-item or task-group.
 */
export interface RunWithDevinTreeItem {
	readonly contextValue?: string;
	readonly task?: {
		readonly id: string;
		readonly title: string;
		readonly priority?: string;
	};
	readonly specName?: string;
	readonly filePath?: string;
	readonly parentName?: string;
}

// ============================================================================
// Command Registration
// ============================================================================

/**
 * Register all Devin-related VS Code commands.
 *
 * @param sessionManager - The session manager instance
 * @param credentialsManager - The credentials manager instance
 * @returns Array of disposables for command registrations
 */
export interface DevinCommandCallbacks {
	readonly onCredentialsConfigured?: () => void;
	readonly onSessionCreated?: () => void;
	readonly onSessionCancelled?: () => void;
}

export function registerDevinCommands(
	sessionManager: DevinSessionManager,
	credentialsManager: DevinCredentialsManager,
	progressPanel?: DevinProgressPanel,
	callbacks?: DevinCommandCallbacks
): { dispose(): void }[] {
	const disposables: { dispose(): void }[] = [];

	disposables.push(
		commands.registerCommand(
			DEVIN_COMMANDS.START_TASK,
			async (context?: DevinTaskContext) => {
				await handleStartSingleTask(
					context,
					sessionManager,
					credentialsManager,
					callbacks?.onSessionCreated
				);
			}
		)
	);

	disposables.push(
		commands.registerCommand(DEVIN_COMMANDS.CONFIGURE_CREDENTIALS, async () => {
			await handleConfigureCredentials(
				credentialsManager,
				callbacks?.onCredentialsConfigured
			);
		})
	);

	disposables.push(
		commands.registerCommand(
			DEVIN_COMMANDS.CANCEL_SESSION,
			async (arg?: string | { session?: { localId?: string } }) => {
				const localId = typeof arg === "string" ? arg : arg?.session?.localId;
				await handleCancelSession(
					localId,
					sessionManager,
					callbacks?.onSessionCancelled
				);
			}
		)
	);

	disposables.push(
		commands.registerCommand(DEVIN_COMMANDS.OPEN_PROGRESS, () => {
			progressPanel?.show();
		})
	);

	disposables.push(
		commands.registerCommand(
			DEVIN_COMMANDS.START_ALL_TASKS,
			async (specPath?: string) => {
				await handleStartAllTasks(
					specPath,
					sessionManager,
					credentialsManager,
					callbacks?.onSessionCreated
				);
			}
		)
	);

	return disposables;
}

// ============================================================================
// Command Handlers
// ============================================================================

async function handleStartSingleTask(
	context: DevinTaskContext | undefined,
	sessionManager: DevinSessionManager,
	credentialsManager: DevinCredentialsManager,
	onSessionCreated?: () => void
): Promise<void> {
	if (!context) {
		await window.showErrorMessage(
			"No task context provided. Use this command from the Spec Explorer context menu."
		);
		return;
	}

	logTaskStart(context.taskId, "");

	try {
		const gitResult = await validateGitState();
		if (!gitResult.isValid) {
			await showGitValidationError(gitResult.errors);
			return;
		}

		const branch = gitResult.branch;
		const repoUrl = (await getRemoteUrl()) ?? "";

		const confirmed = await confirmTaskInitiation({
			taskId: context.taskId,
			title: context.title,
			branch,
			repoUrl,
		});

		if (!confirmed) {
			return;
		}

		const session = await sessionManager.startTask({
			specPath: context.specPath,
			taskId: context.taskId,
			title: context.title,
			description: context.description,
			priority: context.priority,
			branch,
			repoUrl,
			acceptanceCriteria: context.acceptanceCriteria,
		});

		logTaskStartSuccess(context.taskId, session.sessionId, session.apiVersion);
		onSessionCreated?.();
		await showSessionStartedNotification(context.taskId, session.devinUrl);
	} catch (error: unknown) {
		const errorCode = isDevinError(error) ? error.code : "UNKNOWN";
		const errorMessage = error instanceof Error ? error.message : String(error);
		logTaskStartFailure(context.taskId, errorCode, errorMessage);
		await showDevinErrorNotification(error);
	}
}

async function handleConfigureCredentials(
	credentialsManager: DevinCredentialsManager,
	onSuccess?: () => void
): Promise<void> {
	const apiKey = await window.showInputBox({
		prompt: "Enter your Devin API key",
		placeHolder: "cog_... or apk_...",
		password: true,
		ignoreFocusOut: true,
	});

	if (!apiKey) {
		return;
	}

	let orgId: string | undefined;
	if (apiKey.startsWith("cog_")) {
		orgId = await window.showInputBox({
			prompt: "Enter your Devin Organization ID (required for v3 API)",
			placeHolder: "org-...",
			ignoreFocusOut: true,
		});

		if (!orgId) {
			return;
		}
	}

	try {
		await credentialsManager.store(apiKey, orgId);
		onSuccess?.();
		await window.showInformationMessage(
			"Devin credentials configured successfully."
		);
	} catch (error: unknown) {
		await showDevinErrorNotification(error);
	}
}

async function handleCancelSession(
	localId: string | undefined,
	sessionManager: DevinSessionManager,
	onSessionCancelled?: () => void
): Promise<void> {
	if (!localId) {
		await window.showErrorMessage("No session ID provided.");
		return;
	}

	try {
		await sessionManager.cancelSession(localId);
		onSessionCancelled?.();
		await window.showInformationMessage("Devin session cancelled.");
	} catch (error: unknown) {
		await showDevinErrorNotification(error);
	}
}

async function handleStartAllTasks(
	specPath: string | undefined,
	sessionManager: DevinSessionManager,
	credentialsManager: DevinCredentialsManager,
	onSessionCreated?: () => void
): Promise<void> {
	if (!specPath) {
		await window.showErrorMessage(
			"No spec path provided. Use this command from the Spec Explorer."
		);
		return;
	}

	try {
		const gitResult = await validateGitState();
		if (!gitResult.isValid) {
			await showGitValidationError(gitResult.errors);
			return;
		}

		const branch = gitResult.branch;
		const repoUrl = (await getRemoteUrl()) ?? "";

		const content = await readSpecContent(specPath);
		const taskIds = extractIncompleteTasks(content);

		if (taskIds.length === 0) {
			await window.showInformationMessage(
				"No incomplete tasks found in the spec."
			);
			return;
		}

		const tasks = taskIds.flatMap((id) => {
			const details = extractTaskFromSpec(content, id);
			if (!details) {
				return [];
			}
			return [
				{
					taskId: details.taskId,
					title: details.title,
					description: details.description,
					priority: "P1" as const,
					acceptanceCriteria: details.acceptanceCriteria,
				},
			];
		});

		const confirmed = await confirmBatchInitiation({
			taskCount: tasks.length,
			taskIds: tasks.map((t) => t.taskId),
			branch,
			repoUrl,
			specPath,
		});

		if (!confirmed) {
			return;
		}

		const credentials = await credentialsManager.getOrThrow();
		const { createDevinApiClient } = await import(
			"../features/devin/devin-api-client-factory"
		);
		const apiClient = createDevinApiClient({
			token: credentials.apiKey,
			orgId: credentials.orgId,
		});

		const processor = new BatchProcessor(
			apiClient,
			sessionManager.getStorage(),
			credentialsManager
		);

		const results = await runBatchWithProgress(processor, {
			specPath,
			branch,
			repoUrl,
			tasks,
		});

		if (results.successful.length > 0) {
			onSessionCreated?.();
		}
		await showBatchResultNotification(
			results.successful.length,
			results.failed.length
		);
	} catch (error: unknown) {
		await showDevinErrorNotification(error);
	}
}

async function handleRunWithDevin(
	item: RunWithDevinTreeItem | undefined,
	sessionManager: DevinSessionManager,
	credentialsManager: DevinCredentialsManager,
	onSessionCreated?: () => void
): Promise<void> {
	const isTaskGroup = item?.contextValue === "task-group";
	const isTaskItem = item?.task !== undefined;

	if (!(isTaskGroup || isTaskItem)) {
		await window.showErrorMessage(
			"No task selected. Use this action from the Spec Explorer task list."
		);
		return;
	}

	try {
		const hasCredentials = await credentialsManager.hasCredentials();
		if (!hasCredentials) {
			const configure = await window.showWarningMessage(
				"Devin credentials are not configured. Configure them now?",
				"Configure",
				"Cancel"
			);
			if (configure === "Configure") {
				await commands.executeCommand(DEVIN_COMMANDS.CONFIGURE_CREDENTIALS);
			}
			return;
		}

		if (isTaskGroup) {
			await handleRunGroupWithDevin(
				item,
				sessionManager,
				credentialsManager,
				onSessionCreated
			);
		} else {
			await handleRunSingleTaskWithDevin(
				item,
				sessionManager,
				credentialsManager,
				onSessionCreated
			);
		}
	} catch (error: unknown) {
		const errorCode = isDevinError(error) ? error.code : "UNKNOWN";
		const errorMessage = error instanceof Error ? error.message : String(error);
		logTaskStartFailure("", errorCode, errorMessage);
		await showDevinErrorNotification(error);
	}
}

async function handleRunSingleTaskWithDevin(
	item: RunWithDevinTreeItem,
	sessionManager: DevinSessionManager,
	credentialsManager: DevinCredentialsManager,
	onSessionCreated?: () => void
): Promise<void> {
	const task = item.task;
	if (!task) {
		return;
	}

	const { id: taskId, title: taskTitle } = task;
	logTaskStart(taskId, "run-with-devin");

	const gitValidation = await validateGitState();
	if (!gitValidation.isValid) {
		await showGitValidationError(gitValidation.errors);
		return;
	}

	const confirmed = await window.showInformationMessage(
		`Run with Devin: commit, push, and delegate "${taskId}: ${taskTitle}" to Devin?`,
		{ modal: true },
		"Run with Devin"
	);

	if (confirmed !== "Run with Devin") {
		return;
	}

	const gitResult = await window.withProgress(
		{
			location: { viewId: "gatomia.views.specExplorer" },
			title: "Committing and pushing changes...",
		},
		() => commitAndPush(taskId, taskTitle)
	);

	if (!gitResult.success) {
		await window.showErrorMessage(`Git operation failed: ${gitResult.error}`);
		return;
	}

	const repoUrl = (await getRemoteUrl()) ?? "";

	const session = await sessionManager.startTask({
		specPath: item.filePath ?? "",
		taskId,
		title: taskTitle,
		description: taskTitle,
		priority: (task.priority as "P1" | "P2" | "P3") ?? "P1",
		branch: gitResult.branch,
		repoUrl,
	});

	logTaskStartSuccess(taskId, session.sessionId, session.apiVersion);
	onSessionCreated?.();
	await showSessionStartedNotification(taskId, session.devinUrl);
}

async function handleRunGroupWithDevin(
	item: RunWithDevinTreeItem,
	sessionManager: DevinSessionManager,
	credentialsManager: DevinCredentialsManager,
	onSessionCreated?: () => void
): Promise<void> {
	const groupName = item.parentName;
	const tasksFilePath = item.filePath;

	if (!(groupName && tasksFilePath)) {
		await window.showErrorMessage("Could not determine the task group.");
		return;
	}

	const result = resolveIncompleteGroupTasks(groupName, tasksFilePath);
	if (!result.tasks) {
		await window.showWarningMessage(result.reason ?? "No tasks to delegate.");
		return;
	}
	const incompleteTasks = result.tasks;

	const confirmed = await window.showInformationMessage(
		`Run with Devin: commit, push, and delegate "${groupName}" (${incompleteTasks.length} task(s)) as a single session to Devin?`,
		{ modal: true },
		"Run with Devin"
	);

	if (confirmed !== "Run with Devin") {
		return;
	}

	logTaskStart(incompleteTasks[0].id, "run-with-devin-group");

	const gitResult = await window.withProgress(
		{
			location: { viewId: "gatomia.views.specExplorer" },
			title: "Committing and pushing changes...",
		},
		() => commitAndPush(groupName, `group: ${groupName}`)
	);

	if (!gitResult.success) {
		await window.showErrorMessage(`Git operation failed: ${gitResult.error}`);
		return;
	}

	const repoUrl = (await getRemoteUrl()) ?? "";
	const referenceDocuments = loadReferenceDocuments(tasksFilePath);

	const session = await sessionManager.startTaskGroup({
		specPath: tasksFilePath,
		groupName,
		tasks: incompleteTasks.map((t) => ({
			taskId: t.id,
			title: t.title,
			priority: "P1" as const,
		})),
		branch: gitResult.branch,
		repoUrl,
		referenceDocuments,
	});

	const taskIds = incompleteTasks.map((t) => t.id).join(", ");
	logTaskStartSuccess(taskIds, session.sessionId, session.apiVersion);
	onSessionCreated?.();
	await showSessionStartedNotification(
		`${groupName} (${incompleteTasks.length} tasks)`,
		session.devinUrl
	);
}

interface ResolveGroupResult {
	readonly tasks?: { id: string; title: string }[];
	readonly reason?: string;
}

function resolveIncompleteGroupTasks(
	groupName: string,
	tasksFilePath: string
): ResolveGroupResult {
	const workspaceRoot = workspace.workspaceFolders?.[0]?.uri.fsPath;
	if (!workspaceRoot) {
		return { reason: "No workspace folder open." };
	}

	const absolutePath = join(workspaceRoot, tasksFilePath);
	const taskGroups = parseTasksFromFile(absolutePath);

	if (taskGroups.length === 0) {
		return { reason: `No task groups found in "${tasksFilePath}".` };
	}

	const group = taskGroups.find((g) => g.name === groupName);

	if (!group) {
		const available = taskGroups.map((g) => g.name).join(", ");
		return {
			reason: `Group "${groupName}" not found. Available groups: ${available}`,
		};
	}

	if (group.tasks.length === 0) {
		return { reason: `Group "${groupName}" has no tasks.` };
	}

	const incomplete = group.tasks.filter((t) => t.status !== "completed");
	if (incomplete.length === 0) {
		return {
			reason: `All ${group.tasks.length} task(s) in "${groupName}" are already completed.`,
		};
	}

	return { tasks: incomplete };
}

/**
 * Load reference documents (spec, plan, design, etc.) from the spec directory.
 *
 * Discovers the spec directory from the tasks file path and reads any
 * available design artifacts to include as context for Devin.
 */
function loadReferenceDocuments(tasksFilePath: string): ReferenceDocument[] {
	const workspaceRoot = workspace.workspaceFolders?.[0]?.uri.fsPath;
	if (!workspaceRoot) {
		return [];
	}

	const specDir = dirname(join(workspaceRoot, tasksFilePath));
	const documentTypes = [
		{ file: "spec.md", label: "Specification" },
		{ file: "plan.md", label: "Implementation Plan" },
		{ file: "design.md", label: "Design" },
		{ file: "data-model.md", label: "Data Model" },
		{ file: "requirements.md", label: "Requirements" },
	];

	const documents: ReferenceDocument[] = [];

	for (const { file, label } of documentTypes) {
		const filePath = join(specDir, file);
		if (existsSync(filePath)) {
			try {
				const content = readFileSync(filePath, "utf-8");
				if (content.trim().length > 0) {
					documents.push({ type: label, content });
				}
			} catch {
				// Skip unreadable files
			}
		}
	}

	return documents;
}
