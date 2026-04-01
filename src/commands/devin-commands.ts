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
import {
	showGitValidationError,
	confirmTaskInitiation,
	showSessionStartedNotification,
} from "../features/devin/task-initiation-ui";
import { BatchProcessor } from "../features/devin/batch-processor";
import { RateLimiter } from "../features/devin/rate-limiter";
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
					priority: "P2" as const,
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
			credentialsManager,
			new RateLimiter()
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

// handleRunWithDevin, handleRunSingleTaskWithDevin, handleRunGroupWithDevin,
// and resolveIncompleteGroupTasks were removed in the Cloud Agents migration.
// Task dispatch is now handled by gatomia.dispatchTask in cloud-agent-commands.ts.

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
