# Research: Fix Delete Spec for SpecKit

**Feature**: 004-fix-delete-spec  
**Date**: 2024-12-05

## Root Cause Analysis

### Problem Statement

The delete spec functionality does not work for SpecKit specs. When a user right-clicks on a SpecKit spec in the Spec Explorer and selects "Delete Spec", the deletion fails silently or with an error.

### Investigation Findings

#### 1. Current Delete Implementation

**Location**: [src/features/spec/spec-manager.ts#L215](../../src/features/spec/spec-manager.ts#L215)

```typescript
async delete(specName: string): Promise<void> {
    const workspaceFolder = workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        window.showErrorMessage("No workspace folder open");
        return;
    }

    const specPath = join(
        workspaceFolder.uri.fsPath,
        this.getSpecBasePath(),  // Returns "openspec" for OpenSpec
        specName
    );
    // ... deletion logic
}
```

**Issue**: The method uses `getSpecBasePath()` which returns `"openspec"` from `DEFAULT_PATHS.specs`. This path is incorrect for SpecKit specs which are stored in `"specs/"`.

#### 2. Path Configuration

**Location**: [src/constants.ts](../../src/constants.ts)

```typescript
// OpenSpec configuration
export const DEFAULT_CONFIG = {
    paths: {
        specs: "openspec",  // OpenSpec uses openspec/specs/<name>
    },
};

// SpecKit configuration  
export const SPECKIT_CONFIG = {
    paths: {
        specs: "specs",     // SpecKit uses specs/<name>
    },
};
```

**Issue**: The delete method doesn't use `SPECKIT_CONFIG` when deleting SpecKit specs.

#### 3. Command Registration

**Location**: [src/extension.ts#L506](../../src/extension.ts#L506)

```typescript
commands.registerCommand("gatomia.spec.delete", async (item: any) => {
    await specManager.delete(item.label);
});
```

**Issue**: The command only passes `item.label` (the spec name) but not `item.system` (the spec system type). The `SpecItem` has a `system` property that is populated correctly but not used.

#### 4. SpecItem Class

**Location**: [src/providers/spec-explorer-provider.ts#L398](../../src/providers/spec-explorer-provider.ts#L398)

```typescript
class SpecItem extends TreeItem {
    readonly specName?: string;
    readonly system?: SpecSystemMode;  // Already has system property!
    // ...
}
```

The `SpecItem` is created with the correct `system` property when specs are listed:

```typescript
new SpecItem(
    spec.name,
    TreeItemCollapsibleState.Collapsed,
    "spec",
    this.context,
    spec.id,
    undefined,
    undefined,
    spec.path,
    undefined,
    spec.system  // ✅ System is passed correctly
)
```

### Root Cause Summary

| Component | Issue |
|-----------|-------|
| `extension.ts` | Delete command passes only `item.label`, ignoring `item.system` |
| `spec-manager.ts` | `delete()` method doesn't accept system parameter |
| `spec-manager.ts` | Path construction always uses OpenSpec path structure |

## Solution Design

### Decision: Modify delete method signature

**Rationale**: Minimal change, maintains backward compatibility, uses existing `system` property.

**Alternatives Considered**:

1. **Use SpecSystemAdapter.getSpec()**: Would require async lookup before deletion. Rejected because SpecItem already has the system property available.

2. **Use filePath from SpecItem**: Could use the absolute path stored in SpecItem. Rejected because it would require significant refactoring and the path may not always be the spec directory root.

3. **Detect system from specName pattern**: Could infer from numbered naming (e.g., `001-feature`). Rejected because it's fragile and OpenSpec could also use numbered names.

### Implementation Approach

1. **Modify command registration** to pass both `specName` and `system`
2. **Update delete method signature** to accept optional `system` parameter
3. **Add path resolution logic** based on system type
4. **Add confirmation dialog** before deletion
5. **Ensure tree refresh** after successful deletion

## Best Practices Applied

### VS Code Extension Development

- Use `window.showWarningMessage` with modal options for confirmation dialogs
- Use `workspace.fs.delete` for cross-platform file system operations
- Fire `onDidChangeTreeData` event to refresh tree view after changes

### Testing

- Mock `workspace.fs.delete` for unit tests
- Test both SpecKit and OpenSpec deletion paths
- Test confirmation dialog cancel behavior
- Test error handling scenarios

## References

- [VS Code API - workspace.fs](https://code.visualstudio.com/api/references/vscode-api#workspace.fs)
- [VS Code API - window.showWarningMessage](https://code.visualstudio.com/api/references/vscode-api#window.showWarningMessage)
- [Existing spec-manager tests](../../src/features/spec/spec-manager.test.ts)
