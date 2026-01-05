# Data Model: Steering Instructions & Rules

## Entities

### InstructionDocument

Represents a steering instruction rule file discoverable from the Steering view.

**Fields**
- `id: string`
  - Stable identifier (e.g., full path or `scope:name`).
- `name: string`
  - Human-friendly name (derived from filename, without suffix).
- `scope: "project" | "user"`
- `uri: string`
  - File URI string.
- `fileName: string`
  - `<name>.instructions.md`.

**Derived properties**
- `title: string`
  - Display label (e.g., `typescript.instructions.md`).

**Validation rules**
- Only files ending in `.instructions.md` qualify.
- `name` is normalized to lowercase kebab-case at creation time.

### InstructionRuleName

User-provided instruction name prior to normalization.

**Constraints**
- Must be non-empty after trimming.
- Must normalize to a non-empty kebab-case string.

### ConstitutionRequest

Represents a user request that triggers the `speckit.constitution` agent.

**Fields**
- `description: string` (required, non-empty after trimming)

## Behaviors / State

- Instruction documents are discovered from the filesystem; no persistence layer is introduced.
- Creation is “no overwrite by default”. If the target file exists, creation fails with an actionable message.
- Constitution requests are fire-and-forget: the extension sends the chat prompt and performs no additional post-processing.
