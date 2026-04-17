# Research: Dynamic Extension Document Display in Spec Explorer

**Feature**: 017-extension-docs-tree
**Date**: 2026-04-13

## Research Areas

### 1. Current File Discovery Pattern in `getSpecKitFeatureFiles`

**Decision**: Extend the existing `getSpecKitFeatureFiles` method to also collect unknown files and subdirectories after processing known types.

**Rationale**: The method already uses `existsSync` to check for known files one by one. After the known-file pass, a single `readdirSync` of the feature directory can identify remaining `.md` files and subdirectories not already accounted for. This keeps changes minimal and co-located.

**Alternatives considered**:
- **Separate discovery service**: Would add an unnecessary abstraction layer (violates YAGNI). The adapter already owns file discovery.
- **Reading `extension.yml` manifests**: Would couple the tree to extension metadata. Clarification confirmed pure filesystem scanning.

### 2. Recursive Directory Traversal Strategy

**Decision**: Implement a simple recursive helper function that scans a directory and returns a nested structure of files and subdirectories, filtering to `.md` files only.

**Rationale**: Clarification confirmed fully recursive display. A recursive function is the simplest approach. Practically, extension output directories are shallow (1-3 levels), so stack depth is not a concern.

**Alternatives considered**:
- **Iterative with queue**: More complex without benefit at these depths.
- **Lazy loading (on-expand only)**: Would require the tree provider to do filesystem reads on each expand. The current pattern pre-loads all files in `getSpecKitFeatureFiles`. Lazy loading could be added later if performance requires it.

### 3. Tree Node Types and Icons

**Decision**: Add two new `contextValue` types:
- `"extension-document"`: For extra `.md` files (icon: `extensions` ThemeIcon)
- `"extension-folder"`: For unknown subdirectories (icon: `folder-library` ThemeIcon)

**Rationale**: Clarification confirmed distinct icons. `extensions` is a standard VS Code ThemeIcon that communicates "provided by an extension/plugin". `folder-library` distinguishes extension folders from the generic `folder` icon used for group headers.

**Alternatives considered**:
- `puzzle-piece` icon: Not available in the VS Code ThemeIcon set.
- `file` icon: Would not provide visual distinction (rejected per clarification).

### 4. Known Files/Folders Exclusion Set

**Decision**: Maintain a constant set of known filenames and folder names to exclude from the "extra" scan:
- Known files: `spec.md`, `plan.md`, `research.md`, `data-model.md`, `quickstart.md`, `tasks.md`
- Known folders: `checklists`, `contracts`

**Rationale**: This set matches the existing `getSpecKitFeatureFiles` logic exactly. Any file or folder not in this set is treated as extension-generated content.

**Alternatives considered**:
- Dynamic detection from the existing `fileMap` in the provider: Would create coupling between adapter and provider layers.

### 5. File System Watcher for Dynamic Refresh

**Decision**: Use `workspace.createFileSystemWatcher` with a glob pattern matching `specs/**/*.md` and `specs/**/*/`. Debounce refresh calls at 2 seconds.

**Rationale**: VS Code's built-in file watcher is efficient and already used throughout the codebase. The 2-second debounce prevents excessive refreshes during batch file generation by extensions (confirmed in clarification).

**Alternatives considered**:
- `chokidar` or other Node.js watchers: Unnecessary external dependency when VS Code API provides this natively.
- No watcher (manual refresh only): Viable but rejected as P3 user story explicitly requests automatic refresh.

### 6. Label Formatting

**Decision**: Reuse the existing pattern from the checklists/contracts rendering: strip `.md` extension, capitalize first letter, replace hyphens with spaces.

**Rationale**: Consistent with existing tree node label formatting. Confirmed in clarification that labels derive from filesystem names only.

**Alternatives considered**:
- Title-case every word: Would produce "Acceptance Test Plan" from `acceptance-test-plan.md` which is better, but inconsistent with the existing pattern that only capitalizes the first letter. To maintain consistency, follow the existing approach.
