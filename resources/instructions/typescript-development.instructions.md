# TypeScript Development Instructions

## Language Version
- **TypeScript 5.3+** with `strict: true` in tsconfig.json
- Target: ES2022
- Module: ESNext or NodeNext

## Core Principles

### Type Safety
- No `any` types without explicit justification in comments
- Use strict null checks
- Prefer `unknown` over `any` when type is truly unknown
- Use type guards for runtime type checking

### Code Organization
- One class/interface per file
- Use kebab-case for file names (e.g., `user-service.ts`)
- Export only what's needed (prefer private by default)
- Group related functionality in feature directories

### Naming Conventions
- PascalCase for classes, interfaces, types, enums
- camelCase for variables, functions, properties
- UPPER_SNAKE_CASE for constants
- Prefix interfaces with `I` only when necessary for disambiguation

### Error Handling
- Always handle errors explicitly
- Use custom error classes for domain errors
- Provide context in error messages
- Don't swallow errors silently

### Testing
- Co-locate tests with source files or in `__tests__` directory
- Name test files with `.test.ts` or `.spec.ts` suffix
- Use descriptive test names that explain behavior
- Follow Arrange-Act-Assert pattern

## Code Style

### Functions
```typescript
// Prefer arrow functions for simple operations
const add = (a: number, b: number): number => a + b;

// Use function declarations for complex logic
function processUser(user: User): ProcessedUser {
  // Complex logic here
}
```

### Async/Await
```typescript
// Always use async/await over promises
async function fetchUser(id: string): Promise<User> {
  try {
    const response = await fetch(`/api/users/${id}`);
    return await response.json();
  } catch (error) {
    throw new UserFetchError(`Failed to fetch user ${id}`, { cause: error });
  }
}
```

### Null Safety
```typescript
// Use optional chaining and nullish coalescing
const userName = user?.name ?? 'Anonymous';

// Check for null/undefined explicitly when side effects matter
if (user !== null && user !== undefined) {
  updateDatabase(user);
}
```

### Type Guards
```typescript
function isError(value: unknown): value is Error {
  return value instanceof Error;
}

function processResult(result: unknown): string {
  if (isError(result)) {
    return result.message;
  }
  return String(result);
}
```

## VS Code Extension Specific

### Import Patterns
```typescript
// Use named imports from vscode
import { window, workspace, Uri } from 'vscode';

// Don't use namespace imports (prevents tree-shaking)
// ❌ import * as vscode from 'vscode';
```

### Readonly Properties
```typescript
// Mark properties readonly when never reassigned
class MyService {
  readonly outputChannel: OutputChannel;
  readonly cache: Map<string, string> = new Map();
}
```

### Disposal
```typescript
// Always implement Disposable for resources
class MyWatcher implements Disposable {
  private watcher: FileSystemWatcher;

  dispose(): void {
    this.watcher.dispose();
  }
}
```

## Performance

- Use `Map` over object literals for dynamic keys
- Avoid repeated file system operations
- Cache expensive computations
- Use generators for large datasets
- Profile hot paths with performance measurements

## Security

- Validate all user inputs
- Sanitize file paths (prevent traversal)
- Don't log sensitive information
- Use workspace.fs for file operations (sandboxed)
- Escape output for webviews

Apply these guidelines to all TypeScript code in this project.
