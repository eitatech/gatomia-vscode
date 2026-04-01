/**
 * Cloud Agent Commands
 *
 * VS Code commands for provider selection, credential configuration,
 * session dispatch, cancel, and external link actions.
 *
 * @see specs/016-multi-provider-agents/contracts/ui-events.md
 * @see specs/016-multi-provider-agents/plan.md
 */

import { Uri, commands, window, workspace } from "vscode";
import { dirname } from "node:path";
import type { AgentSessionStorage } from "../features/cloud-agents/agent-session-storage";
import type { AgentPollingService } from "../features/cloud-agents/agent-polling-service";
import type { CloudAgentProvider } from "../features/cloud-agents/cloud-agent-provider";
import type { ProviderRegistry } from "../features/cloud-agents/provider-registry";
import { logInfo, logError } from "../features/cloud-agents/logging";
import {
	ProviderError,
	type AgentSession,
	type SpecTask,
	type SessionContext,
} from "../features/cloud-agents/types";
import {
	getCurrentBranch,
	getRemoteUrl,
} from "../features/devin/git-validator";

// ============================================================================
// Types
// ============================================================================

/**
 * Shape of the tree item passed from the Spec Explorer when
 * the "Run on Cloud" inline action is clicked on a task-item or task-group.
 */
export interface DispatchTreeItem {
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
// Command IDs
// ============================================================================

export const CLOUD_AGENT_COMMANDS = {
	SELECT_PROVIDER: "gatomia.selectProvider",
	CHANGE_PROVIDER: "gatomia.changeProvider",
	CONFIGURE_PROVIDER: "gatomia.configureProvider",
	DISPATCH_TASK: "gatomia.dispatchTask",
	CANCEL_SESSION: "gatomia.cancelSession",
	REFRESH: "gatomia.refreshCloudAgents",
} as const;

// ============================================================================
// Command Registration
// ============================================================================

/**
 * Options for Cloud Agent command registration.
 */
export interface CloudAgentCommandOptions {
	registry: ProviderRegistry;
	sessionStorage?: AgentSessionStorage;
	pollingService?: AgentPollingService;
	onSessionCreated?: () => void;
	onRefresh?: () => void;
}

/**
 * Registers all Cloud Agent commands with VS Code.
 * @param opts - Command dependencies
 * @returns Disposable array for cleanup
 *
 * @see specs/016-multi-provider-agents/contracts/ui-events.md
 */
export function registerCloudAgentCommands(
	opts: ProviderRegistry | CloudAgentCommandOptions
): { dispose(): void }[] {
	const options: CloudAgentCommandOptions =
		"registry" in opts ? opts : { registry: opts };
	const { registry } = options;
	const disposables: { dispose(): void }[] = [];

	disposables.push(
		commands.registerCommand(
			CLOUD_AGENT_COMMANDS.SELECT_PROVIDER,
			async (providerId?: string) => {
				await handleSelectProvider(options, providerId);
			}
		)
	);

	disposables.push(
		commands.registerCommand(CLOUD_AGENT_COMMANDS.CHANGE_PROVIDER, async () => {
			await handleChangeProvider(options);
		})
	);

	disposables.push(
		commands.registerCommand(
			CLOUD_AGENT_COMMANDS.CONFIGURE_PROVIDER,
			async (providerId?: string) => {
				await handleConfigureProvider(registry, providerId);
			}
		)
	);

	disposables.push(
		commands.registerCommand(
			CLOUD_AGENT_COMMANDS.DISPATCH_TASK,
			async (itemOrTaskId?: DispatchTreeItem | string, specPath?: string) => {
				await handleDispatchTask(options, itemOrTaskId, specPath);
			}
		)
	);

	disposables.push(
		commands.registerCommand(
			CLOUD_AGENT_COMMANDS.CANCEL_SESSION,
			async (localId?: string) => {
				await handleCancelSession(options, localId);
			}
		)
	);

	disposables.push(
		commands.registerCommand(CLOUD_AGENT_COMMANDS.REFRESH, async () => {
			await handleRefresh(options);
		})
	);

	return disposables;
}

// ============================================================================
// Command Handlers
// ============================================================================

async function handleSelectProvider(
	opts: CloudAgentCommandOptions,
	providerId?: string
): Promise<void> {
	const { registry } = opts;
	try {
		let selectedId = providerId;

		if (!selectedId) {
			const providers = registry.getAll();
			if (providers.length === 0) {
				window.showInformationMessage(
					"No cloud agent providers are available."
				);
				return;
			}

			const items = providers.map((p) => ({
				label: p.metadata.displayName,
				description: p.metadata.description,
				id: p.metadata.id,
			}));

			const picked = await window.showQuickPick(items, {
				placeHolder: "Select a cloud agent provider",
			});

			if (!picked) {
				return;
			}
			selectedId = picked.id;
		}

		const provider = registry.get(selectedId);
		if (!provider) {
			window.showErrorMessage(`Provider "${selectedId}" not found.`);
			return;
		}

		await registry.setActive(selectedId);
		logInfo(`Provider selected: ${selectedId}`);

		const hasCreds = await provider.hasCredentials();
		if (!hasCreds) {
			const configured = await provider.configureCredentials();
			if (!configured) {
				await registry.clearActive();
				logInfo("Credential configuration cancelled, provider deselected");
				opts.onRefresh?.();
				return;
			}
		}

		opts.onRefresh?.();
	} catch (error) {
		logError("Failed to select provider", error);
		window.showErrorMessage("Failed to select provider.");
	}
}

async function handleChangeProvider(
	opts: CloudAgentCommandOptions
): Promise<void> {
	try {
		await opts.registry.clearActive();
		opts.onRefresh?.();
		logInfo("Provider cleared, showing selection");
		await commands.executeCommand(CLOUD_AGENT_COMMANDS.SELECT_PROVIDER);
	} catch (error) {
		logError("Failed to change provider", error);
	}
}

async function handleConfigureProvider(
	registry: ProviderRegistry,
	providerId?: string
): Promise<void> {
	try {
		const id = providerId ?? registry.getActive()?.metadata.id;
		if (!id) {
			window.showInformationMessage(
				"No provider selected. Please select a provider first."
			);
			return;
		}

		const provider = registry.get(id);
		if (!provider) {
			window.showErrorMessage(`Provider "${id}" not found.`);
			return;
		}

		const success = await provider.configureCredentials();
		if (success) {
			window.showInformationMessage(
				`${provider.metadata.displayName} credentials configured.`
			);
			logInfo(`Credentials configured for: ${id}`);
		}
	} catch (error) {
		logError("Failed to configure provider credentials", error);
		window.showErrorMessage("Failed to configure credentials.");
	}
}

interface ExtractedTask {
	taskId: string;
	taskTitle: string;
	taskDescription: string;
	path: string;
	isTaskGroup: boolean;
}

function extractTaskFromItem(
	itemOrTaskId: DispatchTreeItem | string | undefined,
	specPathArg?: string
): ExtractedTask | undefined {
	if (typeof itemOrTaskId === "object" && itemOrTaskId !== null) {
		const item = itemOrTaskId;
		if (item.task) {
			return {
				taskId: item.task.id,
				taskTitle: item.task.title,
				taskDescription: `${item.task.id}: ${item.task.title}`,
				path: item.filePath ?? "",
				isTaskGroup: false,
			};
		}
		if (item.contextValue === "task-group" && item.parentName) {
			return {
				taskId: item.parentName,
				taskTitle: item.parentName,
				taskDescription: `Task group: ${item.parentName}`,
				path: item.filePath ?? "",
				isTaskGroup: true,
			};
		}
		return;
	}
	const taskId = itemOrTaskId ?? "task";
	return {
		taskId,
		taskTitle: taskId,
		taskDescription: `Dispatch task ${taskId}`,
		path: specPathArg ?? "",
		isTaskGroup: false,
	};
}

async function ensureActiveProvider(
	registry: ProviderRegistry
): Promise<CloudAgentProvider | undefined> {
	const provider = registry.getActive();
	if (!provider) {
		window.showInformationMessage(
			"No provider selected. Please select a provider first."
		);
		await commands.executeCommand(CLOUD_AGENT_COMMANDS.SELECT_PROVIDER);
		return;
	}
	const hasCreds = await provider.hasCredentials();
	if (!hasCreds) {
		window.showInformationMessage(
			`Please configure ${provider.metadata.displayName} credentials first.`
		);
		await commands.executeCommand(
			CLOUD_AGENT_COMMANDS.CONFIGURE_PROVIDER,
			provider.metadata.id
		);
		return;
	}
	return provider;
}

async function handleDispatchTask(
	opts: CloudAgentCommandOptions,
	itemOrTaskId?: DispatchTreeItem | string,
	specPathArg?: string
): Promise<void> {
	try {
		const provider = await ensureActiveProvider(opts.registry);
		if (!provider) {
			return;
		}

		const extracted = extractTaskFromItem(itemOrTaskId, specPathArg);
		if (!extracted) {
			window.showErrorMessage(
				"No task selected. Use this action from the Spec Explorer task list."
			);
			return;
		}

		if (await isTaskAlreadyRunning(opts.sessionStorage, extracted)) {
			return;
		}

		const task: SpecTask = {
			id: extracted.taskId,
			title: extracted.taskTitle,
			description: extracted.taskDescription,
			priority: "medium",
		};
		const branch = (await getCurrentBranch()) ?? "main";
		const workspaceUri = workspace.workspaceFolders?.[0]?.uri.toString() ?? "";
		const repoUrl = (await getRemoteUrl()) ?? "";
		const featurePath = computeFeaturePath(extracted.path);
		const context: SessionContext = {
			branch,
			specPath: extracted.path,
			workspaceUri,
			repoUrl,
			featurePath,
			isFullFeature: extracted.isTaskGroup,
			taskIds: extracted.isTaskGroup ? undefined : [extracted.taskId],
		};

		const session = await createSessionWithRetry(provider, task, context);

		if (opts.sessionStorage) {
			await opts.sessionStorage.create(session);
		}
		if (opts.pollingService && !opts.pollingService.isRunning) {
			opts.pollingService.start(30_000);
		}

		opts.onSessionCreated?.();
		opts.onRefresh?.();

		logInfo(`Task dispatched to ${provider.metadata.id}: ${extracted.taskId}`);
		window.showInformationMessage(
			`Task "${extracted.taskTitle}" dispatched to ${provider.metadata.displayName}.`
		);
	} catch (error) {
		logError("Failed to dispatch task", error);
		const reason = extractErrorMessage(error);
		window.showErrorMessage(`Failed to dispatch task: ${reason}`);
	}
}

const MAX_DISPATCH_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

async function createSessionWithRetry(
	provider: CloudAgentProvider,
	task: SpecTask,
	context: SessionContext
): Promise<AgentSession> {
	let lastError: unknown;
	for (let attempt = 0; attempt <= MAX_DISPATCH_RETRIES; attempt++) {
		try {
			return await provider.createSession(task, context);
		} catch (error) {
			lastError = error;
			const isRecoverable = error instanceof ProviderError && error.recoverable;
			if (!isRecoverable || attempt === MAX_DISPATCH_RETRIES) {
				throw error;
			}
			logError(`Dispatch attempt ${attempt + 1} failed, retrying...`, error);
			await new Promise((resolve) => {
				setTimeout(resolve, RETRY_DELAY_MS * (attempt + 1));
			});
		}
	}
	throw lastError;
}

async function isTaskAlreadyRunning(
	sessionStorage: AgentSessionStorage | undefined,
	extracted: { taskId: string; taskTitle: string }
): Promise<boolean> {
	if (!sessionStorage) {
		return false;
	}
	const running = await sessionStorage.findActiveBySpecTaskId(extracted.taskId);
	if (!running) {
		return false;
	}
	const action = await window.showWarningMessage(
		`Task "${extracted.taskTitle}" is already running on ${running.providerId} (status: ${running.status}).`,
		"Open Session",
		"Cancel"
	);
	if (action === "Open Session" && running.externalUrl) {
		await commands.executeCommand(
			"vscode.open",
			Uri.parse(running.externalUrl)
		);
	}
	return true;
}

async function handleRefresh(opts: CloudAgentCommandOptions): Promise<void> {
	try {
		if (opts.pollingService) {
			await opts.pollingService.pollOnce();
		}
		opts.onRefresh?.();
		logInfo("Cloud Agent sessions refreshed");
	} catch (error) {
		logError("Failed to refresh cloud agent sessions", error);
	}
}

async function handleCancelSession(
	opts: CloudAgentCommandOptions,
	localId?: string
): Promise<void> {
	const { registry, sessionStorage, onRefresh } = opts;
	try {
		if (!localId) {
			window.showErrorMessage("No session specified to cancel.");
			return;
		}

		if (!sessionStorage) {
			window.showErrorMessage("Session storage not available.");
			return;
		}

		const session = await sessionStorage.getById(localId);
		if (!session) {
			window.showErrorMessage(`Session "${localId}" not found.`);
			return;
		}

		if (session.isReadOnly) {
			window.showWarningMessage(
				"Cannot cancel a read-only session from a previous provider."
			);
			return;
		}

		const provider = registry.get(session.providerId);
		if (provider) {
			await provider.cancelSession(localId);
		}

		await sessionStorage.update(localId, {
			status: "cancelled" as const,
			completedAt: Date.now(),
		});

		onRefresh?.();
		logInfo(`Session cancelled: ${localId}`);
		window.showInformationMessage("Session cancelled.");
	} catch (error) {
		logError("Failed to cancel session", error);
		window.showErrorMessage("Failed to cancel session.");
	}
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Compute the relative feature directory path from a tasks/spec file path.
 * e.g., "specs/016-multi-provider-agents/tasks.md" -> "specs/016-multi-provider-agents"
 */
function computeFeaturePath(specFilePath: string): string {
	return dirname(specFilePath);
}

function extractErrorMessage(error: unknown): string {
	if (error instanceof ProviderError) {
		return error.message;
	}
	if (error instanceof Error) {
		return error.message;
	}
	return String(error);
}
