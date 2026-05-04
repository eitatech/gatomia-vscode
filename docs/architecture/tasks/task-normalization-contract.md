---
type: reference
title: Task Normalization Contract
created: 2026-05-04
tags:
  - tasks
  - api-contract
related:
  - '[[Pluggable-Task-Source-Model]]'
---

# Task Normalization Contract

This contract defines how proprietary specification sources integrate into the normalized GatomIA task layer.

## NormalizedTask

A `NormalizedTask` represents a unit of work.

```typescript
export interface NormalizedTask {
  id: string;           // Global or spec-scoped unique ID
  title: string;        // Short description
  status: TaskStatus;   // "completed" | "in-progress" | "not-started" | "failed" | "blocked" | "skipped"
  source: {
    system: string;     // e.g., "SpecKit", "OpenSpec"
    filePath: string;   // Absolute path to the source file
    line?: number;      // Original line number for navigation
  };
  metadata: {
    phase?: string;     // Phase or grouping
    priority?: string;
    complexity?: string;
  };
  execution?: TaskExecutionMetadata; // See [[Autonomous-Execution-States]]
}
```

## TaskProvider Interface

Any new specification format must implement:

```typescript
export interface TaskProvider {
  /**
   * Unique identifier for the provider (e.g., 'speckit', 'openspec').
   */
  readonly name: string;

  /**
   * Read and normalize tasks from a given spec source.
   */
  getTasks(specId: string, filePath: string): Promise<NormalizedTask[]>;

  /**
   * Determine if this provider handles the specified file.
   */
  canHandle(filePath: string): boolean;
}
```

## Error Handling & Parsing Expectations

Providers must gracefully handle malformed data. If a task cannot be parsed completely, it should either be omitted or included with minimal viable data and a skipped/failed state.

- **Markdown lists:** Parsers should extract standard Markdown task lists (`- [ ]`, `- [x]`).
- **Hierarchy:** Nested tasks should either be flattened with context or preserved via phase metadata.
- **Failures:** Provide clear debug logs when skipping malformed task blocks.

## Compatibility Rules

1. **Idempotency:** Re-parsing the same file must yield `NormalizedTask` items with identical `id` fields. Do not rely on random UUIDs for parsed items unless tied to a deterministic hash.
2. **Path safety:** The `source.filePath` must be an absolute path or strictly relative to the VS Code workspace root.
3. **Execution context:** If the provider doesn't support autonomous execution, omit the `execution` block to default to manual/unsupported states.
