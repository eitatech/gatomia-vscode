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
} from "./telemetry";

// In-memory cache of spec states (synced with workspace persistence)
const specStateCache: Map<string, Specification> = new Map();
let cacheInitialized = false;

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
		review: ["reopened", "archived"],
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

	// Telemetry
	logSpecStatusChange(specId, oldStatus, normalizedTarget);
	if (normalizedTarget === "review" && oldStatus === "current") {
		logSendToReviewAction({
			specId,
			pendingTasks: spec.pendingTasks ?? 0,
			pendingChecklistItems: spec.pendingChecklistItems ?? 0,
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
	persistStateCache();
	return spec;
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
 * Archive a spec once all blockers are cleared.
 */
export function archiveSpec(specId: string): Specification | null {
	const spec = getSpecState(specId);
	if (!(spec && isReviewStatus(spec.status))) {
		return null;
	}

	const pendingTasks = spec.pendingTasks ?? 0;
	const pendingChecklistItems = spec.pendingChecklistItems ?? 0;
	if (
		pendingTasks > 0 ||
		pendingChecklistItems > 0 ||
		hasBlockingChangeRequests(spec)
	) {
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

	// Transition to inProgress
	const oldStatus = changeRequest.status;
	changeRequest.status = "inProgress";

	// Persist
	specStateCache.set(specId, spec);
	persistStateCache();

	// Telemetry
	logChangeRequestStatusChange(changeRequestId, oldStatus, "inProgress");

	return changeRequest;
}
