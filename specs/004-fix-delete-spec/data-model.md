# Data Model: Fix Delete Spec for SpecKit

**Feature**: 004-fix-delete-spec  
**Date**: 2024-12-05

## Interface Changes

### Modified: SpecManager.delete()

**Location**: `src/features/spec/spec-manager.ts`

**Before**:
```typescript
async delete(specName: string): Promise<void>
```

**After**:
```typescript
async delete(specName: string, system?: SpecSystemMode): Promise<void>
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `specName` | `string` | Yes | Name/ID of the spec to delete |
| `system` | `SpecSystemMode` | No | Spec system type (defaults to `activeSystem`) |

**Return**: `Promise<void>` - Resolves when deletion completes or is cancelled

**Behavior**:
1. Shows confirmation dialog
2. If cancelled, returns without action
3. Constructs path based on `system` parameter or `activeSystem`
4. Deletes directory recursively
5. Shows success/error notification

### Existing: SpecItem (no changes needed)

**Location**: `src/providers/spec-explorer-provider.ts`

The `SpecItem` class already has all required properties:

```typescript
class SpecItem extends TreeItem {
    readonly specName?: string;      // Spec identifier
    readonly system?: SpecSystemMode; // 'speckit' | 'openspec' | 'auto'
    readonly filePath?: string;      // Absolute path to spec directory
}
```

### Existing: SpecSystemMode (no changes needed)

**Location**: `src/constants.ts`

```typescript
export const SPEC_SYSTEM_MODE = {
    AUTO: "auto",
    OPENSPEC: "openspec", 
    SPECKIT: "speckit",
} as const;

export type SpecSystemMode = (typeof SPEC_SYSTEM_MODE)[keyof typeof SPEC_SYSTEM_MODE];
```

## Path Resolution Logic

### OpenSpec Specs

```
Pattern: openspec/specs/<specName>/
Example: openspec/specs/my-feature/
```

### SpecKit Specs

```
Pattern: specs/<specName>/
Example: specs/001-my-feature/
```

### Path Construction

```typescript
function getSpecPath(specName: string, system: SpecSystemMode): string {
    const basePath = system === SPEC_SYSTEM_MODE.SPECKIT
        ? SPECKIT_CONFIG.paths.specs      // "specs"
        : DEFAULT_CONFIG.paths.specs;     // "openspec"
    
    // For OpenSpec, add /specs/ subdirectory
    if (system === SPEC_SYSTEM_MODE.OPENSPEC) {
        return join(workspacePath, basePath, "specs", specName);
    }
    
    // For SpecKit, direct path
    return join(workspacePath, basePath, specName);
}
```

## State Transitions

### Delete Flow

```
[User Right-Click] 
    → [Select "Delete Spec"]
    → [Confirmation Dialog]
        → [Cancel] → [No Action]
        → [Confirm] → [Delete Directory]
            → [Success] → [Show Notification] → [Refresh Tree]
            → [Error] → [Show Error Message]
```

## Validation Rules

| Rule | Description |
|------|-------------|
| Workspace Required | Must have an open workspace folder |
| Path Exists | Spec directory must exist (graceful handling if not) |
| System Valid | System must be 'speckit' or 'openspec' (fallback to activeSystem) |
| User Confirmation | User must confirm deletion before proceeding |

## Error Handling

| Scenario | Response |
|----------|----------|
| No workspace | Show error: "No workspace folder open" |
| User cancels | Silent return, no action |
| Directory not found | Show error with specific message |
| Permission denied | Show error with filesystem error |
| Other filesystem error | Show error with details |
