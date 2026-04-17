# Data Model: Dynamic Extension Document Display in Spec Explorer

**Feature**: 017-extension-docs-tree
**Date**: 2026-04-13

## Entities

### ExtraFileEntry (Conceptual)

Represents a single extra file or directory discovered in a spec directory that is not part of the known document set. This is a **conceptual entity for documentation purposes only**. The implementation does not define a dedicated TypeScript interface; instead, extra entries are represented as additional keys in the existing `Record<string, string>` returned by `getSpecKitFeatureFiles()`, using prefix conventions:

- `extra:<filename>` for extra markdown files (value: absolute path)
- `extra-folder:<dirname>` for extension subfolders (value: absolute path)

**Conceptual fields** (for understanding, not code):

| Field | Representation | Description |
|-------|---------------|-------------|
| `name` | Key suffix after `extra:` or `extra-folder:` prefix | Filename or directory name (e.g., `retrospective.md`, `v-model`) |
| `absolutePath` | Record value | Full filesystem path |
| `type` | Key prefix (`extra:` = file, `extra-folder:` = directory) | Whether this entry is a markdown file or a subdirectory |
| `children` | Resolved at render time by tree provider | Nested entries loaded recursively on tree expansion |

### Known File/Folder Constants

Files and folders already handled by existing logic that must be excluded from extra file discovery.

| Constant | Value | Purpose |
|----------|-------|---------|
| `KNOWN_SPEC_FILES` | `Set<string>` containing `spec.md`, `plan.md`, `research.md`, `data-model.md`, `quickstart.md`, `tasks.md` | Files with dedicated rendering |
| `KNOWN_SPEC_FOLDERS` | `Set<string>` containing `checklists`, `contracts` | Folders with specialized tree nodes |

### SpecItem Extensions (Tree Node)

Existing `SpecItem` class in `spec-explorer-provider.ts` will use two new `contextValue` values:

| contextValue | Collapsible | Icon | Description |
|-------------|-------------|------|-------------|
| `"extension-document"` | None | `extensions` ThemeIcon | Extra `.md` file leaf node |
| `"extension-folder"` | Collapsed | `folder-library` ThemeIcon | Unknown subfolder node |

## State Transitions

No state machines. All data is derived from the filesystem at render time. The tree is stateless with respect to extension documents.

## Relationships

```text
SpecKit Feature Directory (1)
  ├── Known Documents (0..N) -- handled by existing fileMap logic
  ├── Known Folders (0..N) -- checklists, contracts with specialized rendering
  └── Extra Entries (0..N)
       ├── Extra Documents (ExtraFileEntry, type=file)
       └── Extension Folders (ExtraFileEntry, type=directory)
            └── Nested Extra Entries (0..N, recursive)
```

## Data Flow

1. `getSpecKitFeatureFiles()` scans feature directory
2. Known files/folders processed first (existing logic, unchanged)
3. Remaining entries collected as `Record<string, string>` with keys prefixed by `extra:` for files and `extra-folder:` for directories
4. Tree provider checks prefix to decide rendering: `extra:` entries become `extension-document` nodes, `extra-folder:` entries become `extension-folder` nodes
5. For `extension-folder` nodes, children are loaded recursively on expand
