---
name: Example Test Generator
description: Example agent for generating test stubs when new features are added. Demonstrates template variable usage for file-based triggers.
---

## User Input

```text
$ARGUMENTS
```

## Test Generation Instructions

This is an example test generation agent that can be triggered by file save hooks.

### When to Generate Tests

This agent is typically triggered when:
- New source files are created (e.g., `*.ts`, `*.tsx`)
- Feature files are modified in `src/features/`
- Component files are added in `ui/src/components/`

### Template Variables Expected

- `{filePath}`: Full path to the file that triggered this
- `{fileName}`: Name of the file (e.g., `user-service.ts`)
- `{timestamp}`: When the file was saved
- `{user}`: Who saved the file (from git config)

### Test Generation Steps

1. **Analyze the File**: Read the source file at `{filePath}`
2. **Identify Testable Units**: Find exported classes, functions, components
3. **Determine Test Type**: Unit vs integration vs E2E
4. **Generate Test Stub**: Create test file with:
   - Describe block for each class/function
   - Test cases for happy path
   - Test cases for edge cases
   - Test cases for error conditions

### Output Format

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { YourClass } from '../path-to-file';

describe('YourClass', () => {
  let instance: YourClass;

  beforeEach(() => {
    instance = new YourClass();
  });

  describe('methodName', () => {
    it('should handle happy path', () => {
      // TODO: Implement test
      expect(true).toBe(true);
    });

    it('should handle edge case: null input', () => {
      // TODO: Implement test
    });

    it('should handle error: invalid state', () => {
      // TODO: Implement test
    });
  });
});
```

## Example Usage

**Hook Configuration**:
- **Trigger**: After File Save
- **File Pattern**: `src/features/**/*.ts`
- **Action**: Custom Agent → "Example Test Generator"
- **Arguments**: `Generate test stubs for {filePath} saved by {user} at {timestamp}`

**Expected Behavior**: When you save a TypeScript file in `src/features/`, this agent will analyze the file and generate a corresponding test file with basic test structure.
