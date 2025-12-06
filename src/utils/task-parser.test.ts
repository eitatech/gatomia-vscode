import { describe, expect, it } from "vitest";
import {
	parseTasksContent,
	getTaskStatusIcon,
	getTaskStatusTooltip,
	type TaskStatus,
} from "./task-parser";

describe("task-parser", () => {
	describe("parseTasksContent", () => {
		it("should parse tasks from markdown content", () => {
			const content = `
# Implementation Tasks

## Phase 1: Foundation (P1)

### T1.1: Create Type Definitions
**Priority**: P1
**Complexity**: S (3 hours)

**Acceptance Criteria**:
- [X] All entity types match data model spec
- [X] Type guards validate structure correctly
- [ ] Constants exported and documented

---

### T1.2: Implement TriggerRegistry
**Priority**: P1
**Complexity**: S (3 hours)

**Acceptance Criteria**:
- [X] Events fire correctly
- [X] Invalid events rejected

---

## Phase 2: Execution Engine (P1)

### T2.1: Implement AgentAction Executor
**Priority**: P1
**Complexity**: S (3 hours)

**Acceptance Criteria**:
- [ ] Executes commands via sendPromptToChat()
- [ ] Validates command format
`;

			const groups = parseTasksContent(content);

			expect(groups).toHaveLength(2);

			// First group - Phase 1
			expect(groups[0].name).toBe("Foundation");
			expect(groups[0].tasks).toHaveLength(2);

			// Task T1.1 - in progress (2/3 completed)
			expect(groups[0].tasks[0].id).toBe("T1.1");
			expect(groups[0].tasks[0].title).toBe("Create Type Definitions");
			expect(groups[0].tasks[0].status).toBe("in-progress");
			expect(groups[0].tasks[0].priority).toBe("P1");
			expect(groups[0].tasks[0].complexity).toBe("S");

			// Task T1.2 - completed (2/2 completed)
			expect(groups[0].tasks[1].id).toBe("T1.2");
			expect(groups[0].tasks[1].title).toBe("Implement TriggerRegistry");
			expect(groups[0].tasks[1].status).toBe("completed");

			// Second group - Phase 2
			expect(groups[1].name).toBe("Execution Engine");
			expect(groups[1].tasks).toHaveLength(1);

			// Task T2.1 - not started (0/2 completed)
			expect(groups[1].tasks[0].id).toBe("T2.1");
			expect(groups[1].tasks[0].title).toBe("Implement AgentAction Executor");
			expect(groups[1].tasks[0].status).toBe("not-started");
		});

		it("should handle STATUS markers", () => {
			const content = `
## Phase 1: Test

### T1.1: Task with status
**Priority**: P1

**STATUS**: ✅ **COMPLETE**

**Acceptance Criteria**:
- [ ] Some item
`;

			const groups = parseTasksContent(content);

			expect(groups[0].tasks[0].status).toBe("completed");
		});

		it("should return empty array for content without tasks", () => {
			const content = `
# Just a regular document

Some text without task definitions.
`;

			const groups = parseTasksContent(content);
			expect(groups).toHaveLength(0);
		});

		it("should handle tasks without acceptance criteria", () => {
			const content = `
## Phase 1: Test

### T1.1: Task without criteria
**Priority**: P1
**Complexity**: XS

This task has no acceptance criteria section.

---

### T1.2: Another task
`;

			const groups = parseTasksContent(content);

			expect(groups[0].tasks).toHaveLength(2);
			expect(groups[0].tasks[0].status).toBe("not-started");
			expect(groups[0].tasks[1].status).toBe("not-started");
		});

		it("should track line numbers correctly", () => {
			const content = `Line 1
Line 2
## Phase 1: Test
Line 4
### T1.1: First Task
Line 6`;

			const groups = parseTasksContent(content);

			expect(groups[0].tasks[0].line).toBe(5);
		});

		it("should parse inline checkbox task format", () => {
			const content = `
# Tasks: MongoDB Support

## Phase 1: Setup (Shared Infrastructure)

- [X] T001 Add mongodb crate v3.4.1 and bson v2.13 to Cargo.toml dependencies
- [X] T002 [P] Add serde derives to Cargo.toml features for BSON serialization
- [ ] T003 [P] Create feature flags in Cargo.toml

## Phase 2: Foundational

- [X] T006 Update Database trait in src/db/mod.rs
- [ ] T007 [P] Create DatabaseError enum with thiserror
`;

			const groups = parseTasksContent(content);

			expect(groups).toHaveLength(2);

			// First group - Phase 1
			expect(groups[0].name).toBe("Setup (Shared Infrastructure)");
			expect(groups[0].tasks).toHaveLength(3);

			expect(groups[0].tasks[0].id).toBe("T001");
			expect(groups[0].tasks[0].title).toBe(
				"Add mongodb crate v3.4.1 and bson v2.13 to Cargo.toml dependencies"
			);
			expect(groups[0].tasks[0].status).toBe("completed");

			expect(groups[0].tasks[1].id).toBe("T002");
			expect(groups[0].tasks[1].title).toBe(
				"Add serde derives to Cargo.toml features for BSON serialization"
			);
			expect(groups[0].tasks[1].status).toBe("completed");

			expect(groups[0].tasks[2].id).toBe("T003");
			expect(groups[0].tasks[2].title).toBe(
				"Create feature flags in Cargo.toml"
			);
			expect(groups[0].tasks[2].status).toBe("not-started");

			// Second group - Phase 2
			expect(groups[1].name).toBe("Foundational");
			expect(groups[1].tasks).toHaveLength(2);

			expect(groups[1].tasks[0].id).toBe("T006");
			expect(groups[1].tasks[0].status).toBe("completed");

			expect(groups[1].tasks[1].id).toBe("T007");
			expect(groups[1].tasks[1].status).toBe("not-started");
		});

		it("should parse inline tasks with user story tags", () => {
			const content = `
## Phase 3: User Story 1 - MongoDB Configuration

- [x] T014 [P] [US1] Create CompanyDocument struct in src/models/company_document.rs
- [ ] T015 [P] [US1] Create PartnerEmbedded struct in src/models/company_document.rs
- [X] T016 [US1] Create MongoDatabase struct in src/db/mongodb.rs
`;

			const groups = parseTasksContent(content);

			expect(groups).toHaveLength(1);
			expect(groups[0].name).toBe("User Story 1 - MongoDB Configuration");
			expect(groups[0].tasks).toHaveLength(3);

			expect(groups[0].tasks[0].id).toBe("T014");
			expect(groups[0].tasks[0].title).toBe(
				"Create CompanyDocument struct in src/models/company_document.rs"
			);
			expect(groups[0].tasks[0].status).toBe("completed");

			expect(groups[0].tasks[1].id).toBe("T015");
			expect(groups[0].tasks[1].status).toBe("not-started");

			expect(groups[0].tasks[2].id).toBe("T016");
			expect(groups[0].tasks[2].status).toBe("completed");
		});

		it("should ignore non-task sections like Dependencies and Notes", () => {
			const content = `
## Phase 1: Setup

- [X] T001 First task
- [ ] T002 Second task

## Dependencies & Execution Order

Some text about dependencies.

## Parallel Example: User Story 1

\`\`\`bash
Task T014: "Create CompanyDocument struct"
\`\`\`

## Notes

Some notes here.

## Implementation Strategy

Strategy details.
`;

			const groups = parseTasksContent(content);

			expect(groups).toHaveLength(1);
			expect(groups[0].name).toBe("Setup");
			expect(groups[0].tasks).toHaveLength(2);
		});

		it("should handle mixed formats in same file", () => {
			const content = `
## Phase 1: Inline Format

- [X] T001 Inline task completed
- [ ] T002 Inline task not started

## Phase 2: Header Format

### T2.1: Header Style Task
**Priority**: P1

**Acceptance Criteria**:
- [X] All items done
`;

			const groups = parseTasksContent(content);

			expect(groups).toHaveLength(2);

			// Inline format group
			expect(groups[0].tasks).toHaveLength(2);
			expect(groups[0].tasks[0].id).toBe("T001");
			expect(groups[0].tasks[0].status).toBe("completed");

			// Header format group
			expect(groups[1].tasks).toHaveLength(1);
			expect(groups[1].tasks[0].id).toBe("T2.1");
			expect(groups[1].tasks[0].status).toBe("completed");
		});
	});

	describe("getTaskStatusIcon", () => {
		it("should return correct icon for completed status", () => {
			expect(getTaskStatusIcon("completed")).toBe("pass");
		});

		it("should return correct icon for in-progress status", () => {
			expect(getTaskStatusIcon("in-progress")).toBe("sync~spin");
		});

		it("should return correct icon for not-started status", () => {
			expect(getTaskStatusIcon("not-started")).toBe("record");
		});

		it("should return default icon for unknown status", () => {
			expect(getTaskStatusIcon("unknown" as TaskStatus)).toBe("record");
		});
	});

	describe("getTaskStatusTooltip", () => {
		it("should return correct tooltip for completed status", () => {
			expect(getTaskStatusTooltip("completed")).toBe("Completed");
		});

		it("should return correct tooltip for in-progress status", () => {
			expect(getTaskStatusTooltip("in-progress")).toBe("In Progress");
		});

		it("should return correct tooltip for not-started status", () => {
			expect(getTaskStatusTooltip("not-started")).toBe("Not Started");
		});

		it("should return Unknown for undefined status", () => {
			expect(getTaskStatusTooltip("unknown" as TaskStatus)).toBe("Unknown");
		});
	});
});
