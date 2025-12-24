/**
 * Spec Explorer review flow state management.
 * Handles persistence and state transitions for specs and change requests.
 *
 * Persistence Strategy:
 * - Specs are stored in SpecExplorer's workspace-backed state (extended with review-flow metadata)
 * - Change requests and status metadata are stored as JSON under .vscode/gatomia/spec-review-state.json
 * - State structure: { specStates: { [specId]: Specification } }
 * - State is loaded on first access and persisted after mutations
 */

import type {
	Specification,
	ChangeRequest,
	SpecStatus,
	ChangeRequestStatus,
	TaskLink,
} from "./types";
import { workspace } from "vscode";
import { join, dirname } from "path";
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import {
	serializeSpecification,
	deserializeSpecification,
	type PersistedSpecification,
} from "./storage";
import {
	logSpecStatusChange,
	logChangeRequestStatusChange,
	logSendToReviewAction,
	logSendToArchivedAction,
	logSpecUnarchived,
	logSpecReopenedFromChangeRequest,
	logOutstandingBlockerCount,
	logReviewTransitionEvent,
	logReviewExitEvent,
} from "./telemetry";
import { EventEmitter } from "vscode";
import { NotificationUtils } from "../../../utils/notification-utils";
import type { ReviewTransitionTrigger } from "./types";

// In-memory cache of spec states (synced with workspace persistence)
const specStateCache: Map<string, Specification> = new Map();
let cacheInitialized = false;
const autoReviewRetryQueue = new Set<string>();
let autoReviewInitialized = false;

// Event emitter for state changes
const _onReviewFlowStateChange = new EventEmitter<void>();
export const onReviewFlowStateChange = _onReviewFlowStateChange.event;

/**
 * Get workspace state file path for review flow metadata
 */
function getStateFilePath(): string | null {
	const workspaceRoot = workspace.workspaceFolders?.[0]?.uri.fsPath;
	if (!workspaceRoot) {
		return null;
	}
	return join(workspaceRoot, ".vscode", "gatomia", "spec-review-state.json");
}

/**
 * Load all spec states from persistence into cache
 */
function loadStateCache(): void {
	if (cacheInitialized) {
		return;
	}

	const filePath = getStateFilePath();
	if (!filePath) {
		cacheInitialized = true;
		return;
	}

	try {
		const raw = readFileSync(filePath, "utf8");
		const parsed = JSON.parse(raw) as {
			specStates?: Record<string, PersistedSpecification>;
		};
		specStateCache.clear();
		if (parsed.specStates) {
			for (const [specId, persisted] of Object.entries(parsed.specStates)) {
				specStateCache.set(specId, deserializeSpecification(persisted));
			}
		}
	} catch (error) {
		const nodeError = error as NodeJS.ErrnoException;
		if (nodeError.code !== "ENOENT") {
			console.error("[ReviewFlow State] Failed to load state cache:", error);
		}
	}

	cacheInitialized = true;
}

/**
 * Persist state cache to workspace storage
 */
function persistStateCache(): void {
	const filePath = getStateFilePath();
	if (!filePath) {
		return;
	}

	const payload: Record<string, PersistedSpecification> = {};
	for (const [specId, spec] of specStateCache.entries()) {
		payload[specId] = serializeSpecification(spec);
	}

	try {
		mkdirSync(dirname(filePath), { recursive: true });
		writeFileSync(
			filePath,
			JSON.stringify({ specStates: payload }, null, 2),
			"utf8"
		);
	} catch (error) {
		console.error("[ReviewFlow State] Failed to persist state cache:", error);
	}
}

/**
 * Validate status transition according to FSM rules
 */
function validateStatusTransition(
	currentStatus: SpecStatus,
	newStatus: SpecStatus
): boolean {
	const normalizedCurrent = normalizeStatus(currentStatus);
	const normalizedNext = normalizeStatus(newStatus);

	const validTransitions: Record<SpecStatus, SpecStatus[]> = {
		current: ["review"],
		readyToReview: ["reopened", "review"],
		review: ["reopened", "archived", "current"],
		reopened: ["review"],
		archived: ["reopened"],
	};

	return validTransitions[normalizedCurrent]?.includes(normalizedNext) ?? false;
}

function normalizeStatus(status: SpecStatus): SpecStatus {
	if (status === "readyToReview") {
		return "review";
	}
	return status;
}

function isReviewStatus(status: SpecStatus): boolean {
	const normalized = normalizeStatus(status);
	return normalized === "review";
}

function buildReviewAlertMessage(
	spec: Specification,
	triggerType: ReviewTransitionTrigger
): string {
	const base = `Spec "${spec.title}" is ready for review`;
	const suffix = triggerType === "auto" ? " (auto)." : ".";
	return `${base}${suffix}`;
}

function notifyReviewAlert(
	spec: Specification,
	triggerType: ReviewTransitionTrigger
): void {
	NotificationUtils.showReviewAlert(buildReviewAlertMessage(spec, triggerType));
}

function getReviewNotificationRecipients(spec: Specification): string[] {
	if (spec.watchers && spec.watchers.length > 0) {
		return Array.from(new Set(spec.watchers));
	}
	return spec.owner ? [spec.owner] : [];
}

/**
 * Initialize or retrieve spec state from persistence
 * @param specId Unique spec identifier
 * @returns Specification with current status and change requests
 */
export function getSpecState(specId: string): Specification | null {
	loadStateCache();

	if (specStateCache.has(specId)) {
		return specStateCache.get(specId) ?? null;
	}

	// If spec not in cache, attempt to create default spec for testing/initialization
	// In production, fetch from SpecExplorer's spec metadata
	// For now, return null to allow tests to set up their own specs
	return null;
}

/**
 * Update spec status and persist
 * @param specId Spec identifier
 * @param newStatus New status (current | review | reopened | archived)
 * @returns Updated Specification
 */
export function updateSpecStatus(
	specId: string,
	newStatus: SpecStatus
): Specification | null {
	loadStateCache();

	const spec = getSpecState(specId);
	if (!spec) {
		console.warn("[ReviewFlow State] Spec not found:", specId);
		return null;
	}

	const normalizedCurrent = normalizeStatus(spec.status);
	const normalizedTarget = normalizeStatus(newStatus);

	// Validate FSM transition
	if (!validateStatusTransition(normalizedCurrent, normalizedTarget)) {
		console.error(
			`[ReviewFlow State] Invalid transition: ${spec.status} → ${newStatus}`
		);
		return null;
	}

	const oldStatus = normalizedCurrent;
	spec.status = normalizedTarget;
	spec.updatedAt = new Date();

	// Set completedAt and reviewEnteredAt when first transitioning to review
	if (normalizedTarget === "review") {
		spec.completedAt = new Date();
		spec.reviewEnteredAt = spec.reviewEnteredAt ?? spec.completedAt;
	}

	if (normalizedTarget === "archived") {
		spec.archivedAt = new Date();
	}

	// Persist and update cache
	specStateCache.set(specId, spec);
	persistStateCache();
	_onReviewFlowStateChange.fire();

	// Telemetry
	logSpecStatusChange(specId, oldStatus, normalizedTarget);
	if (normalizedTarget === "review" && oldStatus === "current") {
		logSendToReviewAction({
			specId,
			pendingTasks: spec.pendingTasks ?? 0,
			pendingChecklistItems: spec.pendingChecklistItems ?? 0,
		});
	}

	// Log blocker count for all status transitions
	const totalChangeRequests = spec.changeRequests?.length ?? 0;
	const openChangeRequests =
		spec.changeRequests?.filter((cr) => cr.status !== "addressed").length ?? 0;
	const blockingChangeRequests =
		spec.changeRequests?.filter(
			(cr) => cr.archivalBlocker && cr.status !== "addressed"
		).length ?? 0;

	if (totalChangeRequests > 0) {
		logOutstandingBlockerCount({
			specId,
			status: normalizedTarget,
			totalChangeRequests,
			openChangeRequests,
			blockingChangeRequests,
		});
	}

	return spec;
}

/**
 * Add change request to spec and transition spec to reopened
 * @param specId Spec identifier
 * @param changeRequest Change request to add
 * @returns Updated Specification with reopened status
 */
export function addChangeRequest(
	specId: string,
	changeRequest: ChangeRequest
): Specification | null {
	loadStateCache();

	const spec = getSpecState(specId);
	if (!spec) {
		console.warn("[ReviewFlow State] Spec not found:", specId);
		return null;
	}

	// Append change request
	if (!spec.changeRequests) {
		spec.changeRequests = [];
	}
	spec.changeRequests.push(changeRequest);
	spec.updatedAt = new Date();

	// Transition to reopened if in review
	if (isReviewStatus(spec.status)) {
		spec.status = "reopened";
		logSpecStatusChange(specId, "review", "reopened");
		logSpecReopenedFromChangeRequest({
			specId,
			changeRequestId: changeRequest.id,
		});
	}

	// Persist
	specStateCache.set(specId, spec);
	persistStateCache();
	_onReviewFlowStateChange.fire();

	return spec;
}

/**
 * Update change request status
 * @param specId Spec identifier (for context)
 * @param changeRequestId Change request identifier
 * @param newStatus New status (open | blocked | inProgress | addressed)
 * @returns Updated ChangeRequest
 */
export function updateChangeRequestStatus(
	specId: string,
	changeRequestId: string,
	newStatus: ChangeRequestStatus
): ChangeRequest | null {
	loadStateCache();

	const spec = getSpecState(specId);
	if (!spec?.changeRequests) {
		console.warn(
			"[ReviewFlow State] Spec or change requests not found:",
			specId
		);
		return null;
	}

	const changeRequest = spec.changeRequests.find(
		(cr) => cr.id === changeRequestId
	);
	if (!changeRequest) {
		console.warn(
			"[ReviewFlow State] Change request not found:",
			changeRequestId
		);
		return null;
	}

	const oldStatus = changeRequest.status;
	changeRequest.status = newStatus;
	changeRequest.updatedAt = new Date();

	// Persist
	specStateCache.set(specId, spec);
	persistStateCache();
	_onReviewFlowStateChange.fire();

	// Telemetry
	logChangeRequestStatusChange(changeRequestId, oldStatus, newStatus);

	// Check if spec should return to review
	if (newStatus === "addressed" && shouldReturnToReview(specId)) {
		returnSpecToReview(specId);
	}

	return changeRequest;
}

/**
 * Check if all change requests on a spec are addressed and all tasks are done
 * @param specId Spec identifier
 * @returns True if spec should return to review
 */
export function shouldReturnToReview(specId: string): boolean {
	const spec = getSpecState(specId);
	if (!spec?.changeRequests || spec.changeRequests.length === 0) {
		return false;
	}

	// All change requests must be addressed
	const allAddressed = spec.changeRequests.every(
		(cr) => cr.status === "addressed"
	);
	if (!allAddressed) {
		return false;
	}

	// All tasks in all change requests must be done
	const allTasksDone = spec.changeRequests.every((cr) =>
		cr.tasks.every((task) => task.status === "done")
	);

	const pendingTasks = spec.pendingTasks ?? 0;
	const pendingChecklistItems = spec.pendingChecklistItems ?? 0;

	return allTasksDone && pendingTasks === 0 && pendingChecklistItems === 0;
}

/**
 * Return spec to Ready to Review after all change requests are addressed
 * @param specId Spec identifier
 * @returns Updated Specification with review status
 */
export function returnSpecToReview(specId: string): Specification | null {
	const spec = getSpecState(specId);
	if (!spec) {
		console.warn("[ReviewFlow State] Spec not found:", specId);
		return null;
	}

	if (normalizeStatus(spec.status) !== "reopened") {
		console.warn(
			"[ReviewFlow State] Spec not in reopened status:",
			specId,
			spec.status
		);
		return null;
	}

	return updateSpecStatus(specId, "review");
}

/**
 * TEST HELPER: Initialize a spec in the state cache for testing
 * @param spec Specification to add to cache
 */
export function __testInitSpec(spec: Specification): void {
	specStateCache.set(spec.id, spec);
}

/**
 * Update pending task/checklist counts for a spec.
 */
export function updatePendingSummary(
	specId: string,
	pendingTasks: number,
	pendingChecklistItems: number
): Specification | null {
	const spec = getSpecState(specId);
	if (!spec) {
		return null;
	}

	spec.pendingTasks = Math.max(0, pendingTasks);
	spec.pendingChecklistItems = Math.max(0, pendingChecklistItems);
	spec.updatedAt = new Date();
	specStateCache.set(specId, spec);

	if (
		isReviewStatus(spec.status) &&
		(spec.pendingTasks > 0 || spec.pendingChecklistItems > 0)
	) {
		const nextStatus = hasBlockingChangeRequests(spec) ? "reopened" : "current";
		const updated = updateSpecStatus(specId, nextStatus);
		if (updated) {
			const reason =
				spec.pendingTasks > 0 ? "pending-tasks" : "pending-checklist-items";
			logReviewExitEvent({
				specId,
				fromStatus: "review",
				toStatus: nextStatus,
				reason,
				pendingTasks: spec.pendingTasks,
				pendingChecklistItems: spec.pendingChecklistItems,
			});
			NotificationUtils.showWarning(
				`Spec "${spec.title}" returned to execution due to new blockers.`
			);
		}
		return updated;
	}

	persistStateCache();
	_onReviewFlowStateChange.fire();
	evaluateAutoReviewTransitions();
	return spec;
}

function evaluateAutoReviewTransitions(): void {
	if (!autoReviewInitialized || specStateCache.size === 0) {
		return;
	}

	const candidates = new Set<string>([
		...specStateCache.keys(),
		...autoReviewRetryQueue,
	]);

	for (const specId of candidates) {
		const result = _autoSendToReview(specId);
		if (result) {
			autoReviewRetryQueue.delete(specId);
		}
	}
}

function _autoSendToReview(specId: string): Specification | null {
	const gatingResult = canSendToReview(specId);
	if (!gatingResult.canSend) {
		autoReviewRetryQueue.delete(specId);
		return null;
	}

	const result = performReviewTransition(specId, "auto");
	if (!result) {
		autoReviewRetryQueue.add(specId);
		NotificationUtils.showError(
			"Failed to send spec to review automatically. Will retry."
		);
		return null;
	}

	return result;
}

function performReviewTransition(
	specId: string,
	triggerType: ReviewTransitionTrigger,
	initiatedBy?: string
): Specification | null {
	const result = sendToReview(specId);
	if (!result) {
		logReviewTransitionEvent({
			eventId: `${triggerType}-${specId}-${Date.now()}`,
			specId,
			triggerType,
			initiatedBy,
			occurredAt: new Date(),
			notificationRecipients: [],
			status: "failed",
			failureReason: "send-to-review-failed",
		});
		return null;
	}

	const recipients = getReviewNotificationRecipients(result);
	logReviewTransitionEvent({
		eventId: `${triggerType}-${specId}-${Date.now()}`,
		specId,
		triggerType,
		initiatedBy,
		occurredAt: new Date(),
		notificationRecipients: recipients,
		status: "succeeded",
		failureReason: null,
	});
	notifyReviewAlert(result, triggerType);
	return result;
}

export function initializeAutoReviewTransitions(): void {
	if (autoReviewInitialized) {
		return;
	}

	autoReviewInitialized = true;
	onReviewFlowStateChange(() => {
		evaluateAutoReviewTransitions();
	});
}

export function __testAutoSendToReview(
	specId: string,
	options?: { forceFailure?: boolean }
): Specification | null {
	if (options?.forceFailure) {
		logReviewTransitionEvent({
			eventId: `auto-${specId}-${Date.now()}`,
			specId,
			triggerType: "auto",
			occurredAt: new Date(),
			notificationRecipients: [],
			status: "failed",
			failureReason: "test-forced-failure",
		});
		NotificationUtils.showError(
			"Failed to send spec to review automatically. Will retry."
		);
		return null;
	}
	return _autoSendToReview(specId);
}

export function sendToReviewWithTrigger(options: {
	specId: string;
	triggerType: ReviewTransitionTrigger;
	initiatedBy?: string;
}): { result: Specification | null; blockers: string[] } {
	const gatingResult = canSendToReview(options.specId);
	if (!gatingResult.canSend) {
		return { result: null, blockers: gatingResult.blockers };
	}

	const result = performReviewTransition(
		options.specId,
		options.triggerType,
		options.initiatedBy
	);
	if (!result) {
		return {
			result: null,
			blockers: ["Send to review failed"],
		};
	}

	return { result, blockers: [] };
}

function hasBlockingChangeRequests(spec: Specification): boolean {
	return (
		spec.changeRequests?.some(
			(cr) =>
				cr.status !== "addressed" || cr.tasks.some((t) => t.status !== "done")
		) ?? false
	);
}

/**
 * Check if a spec can be archived (no pending tasks, checklist items, or blocking change requests)
 */
export function canArchive(specId: string): boolean {
	const spec = getSpecState(specId);
	if (!(spec && isReviewStatus(spec.status))) {
		return false;
	}

	const pendingTasks = spec.pendingTasks ?? 0;
	const pendingChecklistItems = spec.pendingChecklistItems ?? 0;

	return (
		pendingTasks === 0 &&
		pendingChecklistItems === 0 &&
		!hasBlockingChangeRequests(spec)
	);
}

/**
 * Archive a spec once all blockers are cleared.
 */
export function archiveSpec(specId: string): Specification | null {
	const spec = getSpecState(specId);
	if (!(spec && isReviewStatus(spec.status))) {
		return null;
	}

	if (!canArchive(specId)) {
		return null;
	}

	const updated = updateSpecStatus(specId, "archived");
	if (updated) {
		logSendToArchivedAction({
			specId,
			blockerChangeRequestIds: [],
		});
	}
	return updated;
}

/**
 * Unarchive a spec when new blockers emerge.
 */
export function unarchiveSpec(
	specId: string,
	options?: { initiatedBy?: string; reason?: string }
): Specification | null {
	const spec = getSpecState(specId);
	if (!spec || normalizeStatus(spec.status) !== "archived") {
		return null;
	}

	spec.status = "reopened";
	spec.archivedAt = null;
	spec.updatedAt = new Date();
	specStateCache.set(specId, spec);
	persistStateCache();
	_onReviewFlowStateChange.fire();

	logSpecUnarchived({
		specId,
		initiatedBy: options?.initiatedBy ?? "unknown",
		reason: options?.reason ?? "manual-unarchive",
	});
	logSpecStatusChange(specId, "archived", "reopened");
	return spec;
}

/**
 * Attach tasks to a change request and update its status to inProgress
 * @param specId Spec identifier
 * @param changeRequestId Change request identifier
 * @param tasks Array of TaskLink to attach
 * @returns Updated ChangeRequest with tasks attached
 */
export function attachTasksToChangeRequest(
	specId: string,
	changeRequestId: string,
	tasks: TaskLink[]
): ChangeRequest | null {
	loadStateCache();

	const spec = getSpecState(specId);
	if (!spec?.changeRequests) {
		console.warn(
			"[ReviewFlow State] Spec or change requests not found:",
			specId
		);
		return null;
	}

	const changeRequest = spec.changeRequests.find(
		(cr) => cr.id === changeRequestId
	);
	if (!changeRequest) {
		console.warn(
			"[ReviewFlow State] Change request not found:",
			changeRequestId
		);
		return null;
	}

	// Attach tasks
	changeRequest.tasks = tasks;
	changeRequest.sentToTasksAt = new Date();
	changeRequest.updatedAt = new Date();
	changeRequest.archivalBlocker = true;

	// Transition to inProgress
	const oldStatus = changeRequest.status;
	changeRequest.status = "inProgress";

	// Persist
	specStateCache.set(specId, spec);
	persistStateCache();
	_onReviewFlowStateChange.fire();

	// Telemetry
	logChangeRequestStatusChange(changeRequestId, oldStatus, "inProgress");

	return changeRequest;
}

/**
 * Update task status and trigger automatic state transitions
 * @param specId Spec identifier
 * @param changeRequestId Change request identifier
 * @param taskId Task identifier
 * @param newStatus New status (open | inProgress | done)
 * @returns Updated TaskLink or null if not found
 */
export function updateTaskStatus(
	specId: string,
	changeRequestId: string,
	taskId: string,
	newStatus: TaskLinkStatus
): TaskLink | null {
	loadStateCache();

	const spec = getSpecState(specId);
	if (!spec?.changeRequests) {
		return null;
	}

	const changeRequest = spec.changeRequests.find(
		(cr) => cr.id === changeRequestId
	);
	if (!changeRequest) {
		return null;
	}

	const task = changeRequest.tasks?.find((t) => t.taskId === taskId);
	if (!task) {
		return null;
	}

	task.status = newStatus;
	changeRequest.updatedAt = new Date();

	// Check if all tasks are done -> mark CR as addressed
	if (
		newStatus === "done" &&
		changeRequest.tasks.every((t) => t.status === "done")
	) {
		const oldCrStatus = changeRequest.status;
		changeRequest.status = "addressed";
		changeRequest.archivalBlocker = false;
		logChangeRequestStatusChange(changeRequestId, oldCrStatus, "addressed");
	} else if (newStatus !== "done" && changeRequest.status === "addressed") {
		// Re-open CR if a task is moved back from done
		const oldCrStatus = changeRequest.status;
		changeRequest.status = "inProgress";
		changeRequest.archivalBlocker = true;
		logChangeRequestStatusChange(changeRequestId, oldCrStatus, "inProgress");
	}

	// Persist changes
	specStateCache.set(specId, spec);
	persistStateCache();
	_onReviewFlowStateChange.fire();

	// Check if spec should return to review
	if (shouldReturnToReview(specId)) {
		returnSpecToReview(specId);
	}

	return task;
}

/**
 * Check if a spec can be sent to review (User Story 1 gating logic)
 * @param specId Spec identifier
 * @returns Object with canSend boolean and array of blocker messages
 */
export function canSendToReview(specId: string): {
	canSend: boolean;
	blockers: string[];
} {
	const spec = getSpecState(specId);
	if (!spec) {
		return { canSend: false, blockers: ["Spec not found"] };
	}

	const blockers: string[] = [];

	// Check if spec is in current or reopened status
	const normalizedStatus = normalizeStatus(spec.status);
	if (normalizedStatus === "review") {
		blockers.push("Spec already in review");
	} else if (
		normalizedStatus !== "current" &&
		normalizedStatus !== "reopened"
	) {
		blockers.push("Spec not in current status");
	}

	// Check for pending tasks
	const pendingTasks = spec.pendingTasks ?? 0;
	if (pendingTasks > 0) {
		blockers.push(
			`${pendingTasks} pending task${pendingTasks === 1 ? "" : "s"}`
		);
	}

	// Check for pending checklist items
	const pendingChecklistItems = spec.pendingChecklistItems ?? 0;
	if (pendingChecklistItems > 0) {
		blockers.push(
			`${pendingChecklistItems} pending checklist item${pendingChecklistItems === 1 ? "" : "s"}`
		);
	}

	return {
		canSend: blockers.length === 0,
		blockers,
	};
}

/**
 * Send a spec to review (User Story 1 main action)
 * Only succeeds if spec has zero pending tasks/checklist items and is in current or reopened status
 * @param specId Spec identifier
 * @returns Updated Specification with review status, or null if gating failed
 */
export function sendToReview(specId: string): Specification | null {
	const gatingResult = canSendToReview(specId);
	if (!gatingResult.canSend) {
		console.warn(
			`[ReviewFlow State] Cannot send spec to review: ${gatingResult.blockers.join(", ")}`
		);
		return null;
	}

	// Transition to review status
	return updateSpecStatus(specId, "review");
}
