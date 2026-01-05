import type {
	ChangeRequest,
	SpecLinks,
	Specification,
	TaskLink,
} from "./types";

export interface PersistedTaskLink {
	taskId: string;
	source: TaskLink["source"];
	status: TaskLink["status"];
	createdAt: string;
}

export interface PersistedChangeRequest {
	id: string;
	specId: string;
	title: string;
	description: string;
	severity: ChangeRequest["severity"];
	status: ChangeRequest["status"];
	tasks: PersistedTaskLink[];
	submitter: string;
	createdAt: string;
	updatedAt: string;
	sentToTasksAt: string | null;
	notes?: string;
	archivalBlocker?: boolean;
}

export interface PersistedSpecification {
	id: string;
	title: string;
	owner: string;
	status: Specification["status"];
	completedAt: string | null;
	reviewEnteredAt?: string | null;
	archivedAt?: string | null;
	updatedAt: string;
	links: SpecLinks;
	pendingTasks?: number;
	pendingChecklistItems?: number;
	changeRequests?: PersistedChangeRequest[];
	watchers?: string[];
}

function coerceOptionalCount(value: unknown): number | undefined {
	if (value === undefined) {
		return;
	}

	let numeric: number;
	if (typeof value === "number") {
		numeric = value;
	} else if (typeof value === "string") {
		numeric = Number(value);
	} else {
		numeric = Number.NaN;
	}

	if (!Number.isFinite(numeric)) {
		return;
	}

	return Math.max(0, Math.trunc(numeric));
}

/**
 * Convert a Specification into a JSON-serializable payload.
 */
export function serializeSpecification(
	spec: Specification
): PersistedSpecification {
	return {
		id: spec.id,
		title: spec.title,
		owner: spec.owner,
		status: spec.status,
		completedAt: spec.completedAt ? spec.completedAt.toISOString() : null,
		reviewEnteredAt: spec.reviewEnteredAt
			? spec.reviewEnteredAt.toISOString()
			: null,
		archivedAt: spec.archivedAt ? spec.archivedAt.toISOString() : null,
		updatedAt: spec.updatedAt.toISOString(),
		links: spec.links,
		pendingTasks: spec.pendingTasks,
		pendingChecklistItems: spec.pendingChecklistItems,
		changeRequests: spec.changeRequests?.map(serializeChangeRequest),
		watchers: spec.watchers,
	};
}

/**
 * Convert a JSON payload back into a Specification object.
 */
export function deserializeSpecification(
	data: PersistedSpecification
): Specification {
	return {
		id: data.id,
		title: data.title,
		owner: data.owner,
		status: data.status,
		completedAt: data.completedAt ? new Date(data.completedAt) : null,
		reviewEnteredAt: data.reviewEnteredAt
			? new Date(data.reviewEnteredAt)
			: null,
		archivedAt: data.archivedAt ? new Date(data.archivedAt) : null,
		updatedAt: new Date(data.updatedAt),
		links: data.links,
		pendingTasks: coerceOptionalCount(data.pendingTasks),
		pendingChecklistItems: coerceOptionalCount(data.pendingChecklistItems),
		changeRequests: data.changeRequests?.map(deserializeChangeRequest),
		watchers: data.watchers,
	};
}

function serializeChangeRequest(
	changeRequest: ChangeRequest
): PersistedChangeRequest {
	return {
		id: changeRequest.id,
		specId: changeRequest.specId,
		title: changeRequest.title,
		description: changeRequest.description,
		severity: changeRequest.severity,
		status: changeRequest.status,
		tasks: changeRequest.tasks.map(serializeTaskLink),
		submitter: changeRequest.submitter,
		createdAt: changeRequest.createdAt.toISOString(),
		updatedAt: changeRequest.updatedAt.toISOString(),
		sentToTasksAt: changeRequest.sentToTasksAt
			? changeRequest.sentToTasksAt.toISOString()
			: null,
		notes: changeRequest.notes,
		archivalBlocker: changeRequest.archivalBlocker,
	};
}

function deserializeChangeRequest(data: PersistedChangeRequest): ChangeRequest {
	return {
		id: data.id,
		specId: data.specId,
		title: data.title,
		description: data.description,
		severity: data.severity,
		status: data.status,
		tasks: data.tasks.map(deserializeTaskLink),
		submitter: data.submitter,
		createdAt: new Date(data.createdAt),
		updatedAt: new Date(data.updatedAt),
		sentToTasksAt: data.sentToTasksAt ? new Date(data.sentToTasksAt) : null,
		notes: data.notes,
		archivalBlocker: data.archivalBlocker,
	};
}

function serializeTaskLink(task: TaskLink): PersistedTaskLink {
	return {
		taskId: task.taskId,
		source: task.source,
		status: task.status,
		createdAt: task.createdAt.toISOString(),
	};
}

function deserializeTaskLink(data: PersistedTaskLink): TaskLink {
	return {
		taskId: data.taskId,
		source: data.source,
		status: data.status,
		createdAt: new Date(data.createdAt),
	};
}
