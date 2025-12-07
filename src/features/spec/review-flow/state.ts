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
import { join } from "path";
import { logSpecStatusChange, logChangeRequestStatusChange } from "./telemetry";

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
		const fileUri = workspace.workspaceFolders?.[0]?.uri;
		if (!fileUri?.path) {
			cacheInitialized = true;
			return;
		}

		const stateUri = fileUri.with({
			path: join(fileUri.path, ".vscode", "gatomia", "spec-review-state.json"),
		});

		// TODO: Read from workspace file system (requires vscode.workspace.fs or extension storage)
		// For now, initialize as empty; will be populated on first state change
	} catch (error) {
		console.error("[ReviewFlow State] Failed to load state cache:", error);
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

	// TODO: Persist specStateCache to workspace file system
	// Structure: { specStates: { [specId]: Specification } }
}

/**
 * Validate status transition according to FSM rules
 */
function validateStatusTransition(
	currentStatus: SpecStatus,
	newStatus: SpecStatus
): boolean {
	const validTransitions: Record<SpecStatus, SpecStatus[]> = {
		current: ["readyToReview"],
		readyToReview: ["reopened"],
		reopened: ["readyToReview"],
	};

	return validTransitions[currentStatus]?.includes(newStatus) ?? false;
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
 * @param newStatus New status (current | readyToReview | reopened)
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

	// Validate FSM transition
	if (!validateStatusTransition(spec.status, newStatus)) {
		console.error(
			`[ReviewFlow State] Invalid transition: ${spec.status} → ${newStatus}`
		);
		return null;
	}

	const oldStatus = spec.status;
	spec.status = newStatus;
	spec.updatedAt = new Date();

	// Set completedAt when first transitioning to readyToReview
	if (newStatus === "readyToReview" && !spec.completedAt) {
		spec.completedAt = new Date();
	}

	// Persist and update cache
	specStateCache.set(specId, spec);
	persistStateCache();

	// Telemetry
	logSpecStatusChange(specId, oldStatus, newStatus);

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

	// Transition to reopened if in readyToReview
	if (spec.status === "readyToReview") {
		spec.status = "reopened";
		logSpecStatusChange(specId, "readyToReview", "reopened");
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

	// Check if spec should return to readyToReview
	if (newStatus === "addressed" && shouldReturnToReadyToReview(specId)) {
		returnSpecToReadyToReview(specId);
	}

	return changeRequest;
}

/**
 * Check if all change requests on a spec are addressed and all tasks are done
 * @param specId Spec identifier
 * @returns True if spec should return to readyToReview
 */
export function shouldReturnToReadyToReview(specId: string): boolean {
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

	return allTasksDone;
}

/**
 * Return spec to Ready to Review after all change requests are addressed
 * @param specId Spec identifier
 * @returns Updated Specification with readyToReview status
 */
export function returnSpecToReadyToReview(
	specId: string
): Specification | null {
	const spec = getSpecState(specId);
	if (!spec) {
		console.warn("[ReviewFlow State] Spec not found:", specId);
		return null;
	}

	if (spec.status !== "reopened") {
		console.warn(
			"[ReviewFlow State] Spec not in reopened status:",
			specId,
			spec.status
		);
		return null;
	}

	return updateSpecStatus(specId, "readyToReview");
}

/**
 * TEST HELPER: Initialize a spec in the state cache for testing
 * @param spec Specification to add to cache
 */
export function __testInitSpec(spec: Specification): void {
	specStateCache.set(spec.id, spec);
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
