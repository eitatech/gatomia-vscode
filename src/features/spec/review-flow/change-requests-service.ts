/**
 * Change request creation service for Spec Explorer review flow.
 * Handles duplicate prevention, persistence, and reopen transition.
 */

import { randomUUID } from "crypto";
import type { ChangeRequest, Specification } from "./types";
import { validateUniqueChangeRequest } from "./duplicate-guard";
import { addChangeRequest, getSpecState } from "./state";
import { logChangeRequestCreated } from "./telemetry";

export class DuplicateChangeRequestError extends Error {
	duplicate?: ChangeRequest;

	constructor(message: string, duplicate?: ChangeRequest) {
		super(message);
		this.name = "DuplicateChangeRequestError";
		this.duplicate = duplicate;
	}
}

export interface ChangeRequestInput {
	title: string;
	description: string;
	severity: ChangeRequest["severity"];
	submitter: string;
	notes?: string;
}

export function createChangeRequest(
	specId: string,
	input: ChangeRequestInput
): { spec: Specification; changeRequest: ChangeRequest } {
	const spec = getSpecState(specId);
	if (!spec) {
		throw new Error(`Spec not found: ${specId}`);
	}

	const existingChangeRequests = spec.changeRequests ?? [];
	const { isValid, duplicate } = validateUniqueChangeRequest(
		specId,
		input.title,
		existingChangeRequests
	);

	if (!isValid) {
		throw new DuplicateChangeRequestError(
			"Duplicate change request title",
			duplicate
		);
	}

	const now = new Date();
	const changeRequest: ChangeRequest = {
		id: randomUUID(),
		specId,
		title: input.title.trim(),
		description: input.description.trim(),
		severity: input.severity,
		status: "open",
		tasks: [],
		submitter: input.submitter,
		createdAt: now,
		updatedAt: now,
		sentToTasksAt: null,
		notes: input.notes?.trim() || undefined,
	};

	const updatedSpec = addChangeRequest(specId, changeRequest);
	if (!updatedSpec) {
		throw new Error(`Failed to add change request to spec: ${specId}`);
	}

	logChangeRequestCreated({
		specId,
		changeRequestId: changeRequest.id,
		severity: changeRequest.severity,
		title: changeRequest.title,
		submitter: changeRequest.submitter,
	});

	return { spec: updatedSpec, changeRequest };
}
