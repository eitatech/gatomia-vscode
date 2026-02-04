---
version: "1.0"
owner: "Italo <182202+italoag@users.noreply.github.com>"
---

# Feature Specification: Automatic Document Version and Author Tracking

**Feature Branch**: `012-spec-version-tracking`  
**Created**: 2026-01-29  
**Status**: Draft  
**Input**: User description: "Adicionar versionamento automático e informação de autor aos documentos de especificação (spec, plan, tasks). Sistema de versionamento {major}.{minor} (1.0 a 1.9, depois 2.0) e autor obtido do Git. Implementar via pós-processamento para não modificar templates do SpecKit diretamente."

## Clarifications

### Session 2026-01-29

- Q: Quais modificações devem acionar incremento de versão? → A: Incrementa apenas se o conteúdo do corpo (após frontmatter) for modificado
- Q: Como o comando de reset de versão será acessado? → A: Ambos Command Palette e Context Menu, com diálogo de confirmação obrigatório
- Q: Como o sistema deve se comportar em múltiplos saves rápidos? → A: Debounce de 30 segundos (versão incrementa apenas se passou >=30s desde último incremento)
- Q: Quantas entradas de histórico devem ser mantidas? → A: Últimas 50 entradas por documento com rotação automática (FIFO)
- Q: Qual a semântica do campo OWNER? → A: Representa último editor (atualiza automaticamente com Git user de cada save)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Automatic Version Initialization on Document Creation (Priority: P1)

When a user creates a new specification document (spec.md, plan.md, or tasks.md) through the extension, the system automatically initializes the VERSION field in the frontmatter to "1.0" and populates the OWNER field with the Git user's name and email.

**Why this priority**: This is the foundation for the entire feature. Without automatic initialization, all subsequent versioning is meaningless. This delivers immediate value by ensuring every new document starts with proper metadata.

**Independent Test**: Create a new spec via `/speckit.specify` command and verify the generated spec.md file contains `version: "1.0"` and `owner: "[Git User Name] <[email]>"` in the frontmatter.

**Acceptance Scenarios**:

1. **Given** a user with Git configured (name and email set), **When** they create a new spec using `/speckit.specify`, **Then** the spec.md file contains `version: "1.0"` and `owner: "John Doe <john@example.com>"`
2. **Given** a user without Git user.name configured, **When** they create a new spec, **Then** the system defaults owner to system username with a placeholder email
3. **Given** an existing spec file being regenerated, **When** the system processes it, **Then** the VERSION and OWNER fields are preserved if already present, only filled if empty

---

### User Story 2 - Automatic Version Increment on Document Update (Priority: P2)

When a user modifies an existing specification document, the system detects the change and automatically increments the version number according to the versioning scheme (1.0 → 1.1 → ... → 1.9 → 2.0).

**Why this priority**: This provides automatic tracking of document evolution. Users don't need to remember to manually update version numbers, reducing human error and ensuring consistent version history.

**Independent Test**: Edit an existing spec.md file (version 1.0), save it, and verify the version automatically updates to 1.1. Make 9 more edits and verify it transitions from 1.9 to 2.0.

**Acceptance Scenarios**:

1. **Given** a spec.md file with `version: "1.0"`, **When** the user saves changes to the file, **Then** the version updates to `version: "1.1"`
2. **Given** a spec.md file with `version: "1.9"`, **When** the user saves changes to the file, **Then** the version updates to `version: "2.0"`
3. **Given** a spec.md file with `version: "2.5"`, **When** the user saves changes to the file, **Then** the version updates to `version: "2.6"`
4. **Given** a file with invalid version format (e.g., "1.10"), **When** processing the file, **Then** the system corrects it to the next valid version (2.0)

---

### User Story 3 - Post-Processing of SpecKit Template Files (Priority: P1)

When SpecKit templates are instantiated (after installation or update), the extension runs a post-processor that injects VERSION and OWNER metadata logic without modifying the original template files, ensuring template updates don't overwrite custom behavior.

**Why this priority**: This is the architectural foundation that ensures the solution is sustainable. Without this, template updates would break the versioning system, requiring constant maintenance.

**Independent Test**: Update SpecKit templates, run extension activation, and verify that newly created specs still have proper VERSION and OWNER fields without modifying the template source files in `.specify/templates/`.

**Acceptance Scenarios**:

1. **Given** SpecKit templates exist in `.specify/templates/`, **When** the extension activates, **Then** the post-processor registers hooks for document creation/modification without altering template files
2. **Given** a SpecKit template update that changes the template structure, **When** the extension processes new documents, **Then** VERSION and OWNER fields are still correctly injected
3. **Given** a user manually updates the OWNER field in a document, **When** the document is saved, **Then** the manual OWNER value is preserved (not overwritten)

---

### User Story 4 - Visual Indication of Document Version in Explorer (Priority: P3)

In the Spec Explorer tree view, each document displays its current version number as a visual badge or suffix, allowing users to quickly see which documents have been updated frequently.

**Why this priority**: This provides visibility into document maturity and change frequency, helping teams prioritize review efforts and identify stable vs. volatile specifications.

**Independent Test**: Open the Spec Explorer and verify that spec items show version numbers (e.g., "User Authentication (v2.3)").

**Acceptance Scenarios**:

1. **Given** a spec with `version: "1.5"`, **When** the user opens the Spec Explorer, **Then** the spec displays as "Feature Name (v1.5)"
2. **Given** multiple specs with different versions, **When** sorting by version, **Then** specs are ordered from lowest to highest version number
3. **Given** a document without a version field, **When** displayed in the explorer, **Then** it shows as "Feature Name (v?.?)" with a warning icon

**UI Acceptance Criteria** (detailed specification for FR-015):

- **Display Format**: Version displayed as suffix in TreeItem.description field: `"Feature Name (v2.3)"`
- **Visual Style**: Version text styled in muted gray color to avoid distracting from document title
- **Tooltip Content** (on hover):
  - Full version history (last 5 entries with timestamps)
  - Last modified timestamp (human-readable: "2 hours ago")
  - Current author/owner: `"Italo <182202+italoag@users.noreply.github.com>"`
  - Created by (original author, immutable)
- **Refresh Behavior**: Tree view automatically refreshes within 1 second of document save event (fire `onDidChangeTreeData`)
- **Visual Hierarchy**: Title (bold, default color) > Version (muted gray) > Status badge (if applicable)
- **Performance**: No performance degradation with 100+ specs in workspace (lazy loading if needed)
- **Accessibility**: Tooltip content accessible via screen readers

---

### Edge Cases

- What happens when a document has a malformed version (e.g., "v1.0", "1", "abc")?
  - System normalizes to nearest valid version or defaults to "1.0" with a warning log
- How does the system handle version conflicts if multiple users edit the same document simultaneously?
  - Each save increments from the version at save time; conflicts are handled by Git merge, version may need manual reconciliation
- What happens when Git user.name or user.email is not configured?
  - System falls back to system username and generates a placeholder email (e.g., "username@localhost"), logs a warning recommending Git configuration
- How does the system handle documents created outside the extension (manually)?
  - Post-processor detects missing or invalid VERSION/OWNER on file open and prompts to initialize/correct
- What happens when a user manually sets version to "3.5" after it was "1.2"?
  - System respects manual version changes; next auto-increment uses the manually set version as base (3.5 → 3.6)
- How does the system handle version rollback (e.g., via Git revert)?
  - Version field reflects whatever is in the file after revert; system doesn't auto-decrement versions (versions only increment)
- What happens when only frontmatter formatting or non-content fields are changed?
  - Version is not incremented; only changes to body content (after frontmatter) trigger version increments
- What happens when a user saves multiple times within 30 seconds?
  - Only the first save within a 30-second window increments the version; subsequent saves within that window do not increment version unless debounce period expires
- What happens when a different user (different Git config) edits and saves a document?
  - OWNER field updates to reflect the new user's Git information on the save that triggers version increment, maintaining accurate attribution of the last editor

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST automatically initialize VERSION field to "1.0" in frontmatter when creating new spec, plan, or tasks documents
- **FR-002**: System MUST automatically populate OWNER field with Git user.name and user.email in format "[Name] <[email]>" when creating new documents, and update OWNER field with current Git user on each subsequent save that triggers version increment
- **FR-003**: System MUST increment version numbers following the {major}.{minor} pattern (1.0 → 1.1 → ... → 1.9 → 2.0 → 2.1)
- **FR-004**: System MUST detect document modifications to body content (after frontmatter) and trigger version increment on save; changes only to frontmatter formatting or whitespace do not trigger version increment
- **FR-005**: System MUST implement a 30-second debounce period for version increments; version increments only if at least 30 seconds have passed since the last version increment, preventing version inflation during active editing sessions
- **FR-006**: System MUST update OWNER field automatically with current Git user information whenever a version increment occurs
- **FR-007**: System MUST respect manually edited VERSION fields and use them as the base for subsequent auto-increments
- **FR-008**: System MUST implement version/owner injection via post-processing hooks rather than modifying SpecKit template files
- **FR-009**: System MUST handle missing or malformed VERSION/OWNER fields by initializing/normalizing them
- **FR-010**: System MUST log all version changes to the extension output channel for auditing purposes (see Log Format Specification in data-model.md for structured format requirements)
- **FR-011**: System MUST fall back to system username when Git user configuration is unavailable
- **FR-012**: System MUST process all three document types (spec.md, plan.md, tasks.md) consistently with the same logic
- **FR-013**: System MUST persist version history metadata in workspace state for tracking purposes, maintaining the last 50 version history entries per document with automatic FIFO rotation when limit is exceeded
- **FR-014**: System MUST provide a command to manually reset version to 1.0 accessible via both Command Palette ("SpecKit: Reset Document Version") and Context Menu (right-click in Spec Explorer), with mandatory confirmation dialog before executing reset
- **FR-015**: System MUST normalize invalid version formats (e.g., "1.10", "v1.0", "abc") to valid format on save (see normalization rules in data-model.md)
- **FR-016**: System MUST display document version in Spec Explorer tree view with detailed UI specifications (see US4 UI Acceptance Criteria)

### Key Entities

- **Document Metadata**: Represents version and ownership information for spec documents
  - version: String in format "{major}.{minor}" (e.g., "1.0", "2.5")
  - owner: String in format "[Name] <[email]>" representing the last editor (updated automatically on each version increment)
  - lastModified: Timestamp of last version increment
  - createdBy: Original document author (immutable after first save, stored in workspace state for historical record)

- **Version History Entry**: Represents a point-in-time snapshot of version changes (maximum 50 entries per document with FIFO rotation)
  - documentPath: Absolute path to the document
  - previousVersion: Version before the change
  - newVersion: Version after the change
  - timestamp: ISO 8601 timestamp
  - author: User who made the change
  - changeType: "auto-increment" | "manual-set" | "initialization" | "normalization"

- **Post-Processor Hook**: Extension mechanism that intercepts document operations
  - hookType: "pre-create" | "post-create" | "pre-save" | "post-save"
  - documentType: "spec" | "plan" | "tasks"
  - handler: Function that performs version/owner injection

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of newly created spec documents contain valid VERSION (format {major}.{minor}) and OWNER fields in frontmatter
- **SC-002**: Version numbers increment correctly according to the defined scheme in 100% of document save operations
- **SC-003**: SpecKit template updates do not break version tracking functionality (verified through update simulation tests)
- **SC-004**: Users can trace document evolution history through version numbers and workspace state logs
- **SC-005**: System handles edge cases (missing Git config, malformed versions, manual edits) gracefully without errors or data loss
- **SC-006**: Post-processing adds less than 100ms latency to document save operations (negligible user impact)
- **SC-007**: Version information is visible in Spec Explorer for all spec documents within 1 second of file changes

## Assumptions

- Git is installed and available in the system PATH (standard for VS Code development)
- SpecKit template structure includes frontmatter with VERSION and OWNER placeholders (current implementation)
- Users expect semantic versioning-like behavior where minor changes increment minor version, major milestones increment major version
- Frontmatter is YAML format and located at the beginning of markdown files
- File system watchers are available for detecting document changes (VS Code API provides this)
- Workspace state persistence is available for storing version history metadata

## Out of Scope

- Displaying full version history UI within the extension (version history is logged, but not visualized beyond current version)
- Integration with external version control systems beyond Git (e.g., Mercurial, SVN)
- Automatic major version increments based on semantic change detection (users control major version manually if needed via version reset command)
- Multi-user conflict resolution UI (handled by standard Git merge workflows)
- Version comparison or diff visualization between document versions
- Exporting version history to external formats (JSON, CSV, etc.)
- Rollback functionality to restore previous document versions (handled by Git)
- Custom versioning schemes beyond {major}.{minor} format

## Dependencies

- VS Code Extension API (workspace state, file system watchers, document save events)
- Git CLI for reading user.name and user.email configuration
- YAML parsing library for reading/writing frontmatter metadata (gray-matter or similar)
- SpecKit templates and directory structure (`.specify/templates/`)
- Workspace storage for persisting version history metadata

## Technical Constraints

- Post-processor must not modify original SpecKit template files to ensure updateability
- Version increments must be atomic to prevent race conditions on rapid saves
- System must handle large workspaces (100+ specs) without performance degradation
- Metadata updates must not trigger infinite save loops (watch for save → update → save cycle)
- Solution must work in both local and remote (SSH, WSL) development environments
- Version history storage must implement FIFO rotation at 50 entries per document to prevent unbounded workspace state growth
