/**
 * Duplicate change request detection and prevention.
 * Enforces (specId, normalized title) uniqueness for open change requests.
 */

import type { ChangeRequest } from "./types";

/**
 * Normalize change request title for duplicate comparison
 * @param title Raw change request title
 * @returns Normalized (lowercase, trimmed, extra spaces collapsed) title
 */
export function normalizeTitle(title: string): string {
	return title.toLowerCase().trim().replace(/\s+/g, " ");
}

/**
 * Check if a change request with the same title already exists for a spec
 * @param specId Spec identifier
 * @param newTitle Title of the proposed change request
 * @param existingChangeRequests All change requests for the spec
 * @returns Existing ChangeRequest if duplicate found; null otherwise
 */
export function findDuplicateChangeRequest(
	specId: string,
	newTitle: string,
	existingChangeRequests: ChangeRequest[]
): ChangeRequest | null {
	const normalizedNewTitle = normalizeTitle(newTitle);

	// Find open/blocked/inProgress change requests with matching normalized title
	const duplicate = existingChangeRequests.find((cr) => {
		// Only consider open/addressed change requests for duplicate check
		// (addressed are past, so new request is allowed)
		if (cr.status === "addressed") {
			return false;
		}

		const normalizedExistingTitle = normalizeTitle(cr.title);
		return normalizedExistingTitle === normalizedNewTitle;
	});

	return duplicate || null;
}

/**
 * Validate that a new change request does not violate uniqueness
 * @param specId Spec identifier
 * @param title Proposed change request title
 * @param existingChangeRequests All change requests for the spec
 * @returns { isValid: true } or { isValid: false, duplicate: ChangeRequest }
 */
export function validateUniqueChangeRequest(
	specId: string,
	title: string,
	existingChangeRequests: ChangeRequest[]
): { isValid: boolean; duplicate?: ChangeRequest } {
	const duplicate = findDuplicateChangeRequest(
		specId,
		title,
		existingChangeRequests
	);

	if (duplicate) {
		return { isValid: false, duplicate };
	}

	return { isValid: true };
}
