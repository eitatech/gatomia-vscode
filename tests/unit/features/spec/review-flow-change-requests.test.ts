/**
 * Unit tests for Spec Explorer change request creation and reopening logic.
 * Covers duplicate detection and reopen transition for User Story 2.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
	__testInitSpec,
	getSpecState,
} from "../../../../src/features/spec/review-flow/state";
import type { Specification } from "../../../../src/features/spec/review-flow/types";
import {
	createChangeRequest,
	DuplicateChangeRequestError,
} from "../../../../src/features/spec/review-flow/change-requests-service";

describe("Spec Review Flow - Change Requests", () => {
	let spec: Specification;

	beforeEach(() => {
		spec = {
			id: "spec-cr-001",
			title: "API Auth",
			owner: "alice@example.com",
			status: "readyToReview",
			completedAt: new Date("2025-12-07T10:00:00Z"),
			updatedAt: new Date("2025-12-07T10:00:00Z"),
			links: { specPath: "specs/api-auth/spec.md" },
			changeRequests: [],
		};

		__testInitSpec(spec);
	});

	it("creates a change request and reopens the spec", () => {
		const { changeRequest, spec: updatedSpec } = createChangeRequest(spec.id, {
			title: "Add error handling",
			description: "Cover missing error states",
			severity: "high",
			submitter: "reviewer@example.com",
		});

		expect(changeRequest.title).toBe("Add error handling");
		expect(changeRequest.status).toBe("open");
		expect(changeRequest.specId).toBe(spec.id);
		expect(updatedSpec.status).toBe("reopened");
		expect(updatedSpec.changeRequests?.length).toBe(1);
		expect(updatedSpec.changeRequests?.[0].submitter).toBe(
			"reviewer@example.com"
		);
	});

	it("rejects duplicate change requests by normalized title for the same spec", () => {
		createChangeRequest(spec.id, {
			title: "  Login validation  ",
			description: "Missing validation rules",
			severity: "medium",
			submitter: "reviewer@example.com",
		});

		expect(() =>
			createChangeRequest(spec.id, {
				title: "login   validation",
				description: "Duplicate should be blocked",
				severity: "medium",
				submitter: "reviewer@example.com",
			})
		).toThrow(DuplicateChangeRequestError);
	});

	it("allows a new change request when previous one is addressed", () => {
		createChangeRequest(spec.id, {
			title: "Improve diagrams",
			description: "Add sequence diagrams",
			severity: "low",
			submitter: "reviewer@example.com",
		});

		const cachedSpec = getSpecState(spec.id);
		if (cachedSpec?.changeRequests?.[0]) {
			cachedSpec.changeRequests[0].status = "addressed";
		}

		const result = createChangeRequest(spec.id, {
			title: "Improve diagrams",
			description: "Second iteration allowed after addressed",
			severity: "high",
			submitter: "reviewer@example.com",
		});

		expect(result.changeRequest.title).toBe("Improve diagrams");
		expect(result.spec.changeRequests?.length).toBe(2);
		const addressedCount = result.spec.changeRequests?.filter(
			(cr) => cr.status === "addressed"
		).length;
		expect(addressedCount).toBe(1);
	});

	it("keeps completedAt unchanged when reopening from readyToReview", () => {
		const before = spec.completedAt?.getTime();

		createChangeRequest(spec.id, {
			title: "Tighten auth policies",
			description: "Update policy text",
			severity: "medium",
			submitter: "reviewer@example.com",
		});

		const updatedSpec = getSpecState(spec.id);
		expect(updatedSpec?.status).toBe("reopened");
		expect(updatedSpec?.completedAt?.getTime()).toBe(before);
	});
});
