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

## Error Handling

Providers must gracefully handle malformed data. If a task cannot be parsed completely, it should either be omitted or included with minimal viable data and an "unsupported" flag, depending on the error severity.
