# Research: Steering Instructions & Rules

## Decision 1: Instruction discovery lives in the Steering tree provider

**Decision:** Extend the Steering tree provider to enumerate instruction rule files in:
- Project scope: `.github/instructions/*.instructions.md`
- User scope: `$HOME/.github/instructions/*.instructions.md`

**Rationale:**
- Listing is a view concern (tree rendering), and the existing `SteeringExplorerProvider` already computes “what appears in the tree”.
- Keeping discovery close to the provider avoids adding unnecessary “registry” abstractions (Simplicity/YAGNI).

**Alternatives considered:**
- Add a separate `InstructionRulesService` and have the provider call it.
  - Rejected for now: introduces new abstraction without enough reuse yet.

## Decision 2: Use VS Code filesystem APIs for cross-platform behavior

**Decision:** Use `workspace.fs` + `Uri.joinPath` to read directories, create folders, and write files.

**Rationale:**
- Ensures the feature works in remote workspaces and virtualized environments.
- Matches existing code patterns in the repo for file creation/opening.

**Alternatives considered:**
- Node `fs` directly.
  - Rejected: less compatible with remote environments.

## Decision 3: Name normalization and validation

**Decision:** Normalize user input to lowercase kebab-case and validate non-empty.

**Rationale:**
- Aligns with the feature spec clarifications.
- Avoids surprising filename characters and reduces collisions.

**Alternatives considered:**
- Strict “reject if not kebab-case”.
  - Rejected: increases friction; auto-normalization is friendlier.

## Decision 4: Default content uses a standard instruction template

**Decision:** New rule files are created with a minimal, standard instruction template:
- Frontmatter: `description`, `applyTo`
- Body: heading matching the rule name

**Rationale:**
- Provides consistent structure across rules.
- Matches the clarified behavior from the feature spec.

**Alternatives considered:**
- Create empty files.
  - Rejected: reduces usability and consistency.

## Decision 5: Create Constitution action reuses existing chat integration

**Decision:** Implement/adjust the `Create Constitution` action to prompt for a short description and send `/speckit.constitution <description>` via the existing chat prompt runner.

**Rationale:**
- The extension already has a `sendPromptToChat()` integration and an existing constitution flow.
- The spec explicitly requires no post-processing after the agent responds.

**Alternatives considered:**
- Post-process the response or auto-open modified files.
  - Rejected: violates FR-010a.

## NEEDS CLARIFICATION

None remaining for planning. Implementation details will follow existing patterns in `SteeringExplorerProvider`, `SteeringManager`, and `sendPromptToChat()`.
