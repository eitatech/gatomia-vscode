# Quickstart: Fix Delete Spec for SpecKit

**Feature**: 004-fix-delete-spec  
**Date**: 2024-12-05

## Prerequisites

- Node.js 18+ installed
- VS Code 1.80+ installed
- Repository cloned and dependencies installed (`npm run install:all`)

## Quick Implementation Guide

### Step 1: Update Command Registration

**File**: `src/extension.ts` (line ~506)

Update the delete command to pass both `specName` and `system`:

```typescript
commands.registerCommand("gatomia.spec.delete", async (item: any) => {
    await specManager.delete(item.specName || item.label, item.system);
    specExplorer.refresh();
});
```

### Step 2: Update Delete Method

**File**: `src/features/spec/spec-manager.ts`

Add the `system` parameter and confirmation dialog:

```typescript
import { SPEC_SYSTEM_MODE, SPECKIT_CONFIG, DEFAULT_CONFIG } from "../../constants";

async delete(specName: string, system?: SpecSystemMode): Promise<void> {
    const workspaceFolder = workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        window.showErrorMessage("No workspace folder open");
        return;
    }

    // Show confirmation dialog
    const confirm = await window.showWarningMessage(
        `Are you sure you want to delete "${specName}"? This action cannot be undone.`,
        { modal: true },
        "Delete"
    );

    if (confirm !== "Delete") {
        return;
    }

    // Use provided system or fall back to active system
    const targetSystem = system || this.activeSystem;

    // Construct path based on system
    let specPath: string;
    if (targetSystem === SPEC_SYSTEM_MODE.SPECKIT) {
        specPath = join(
            workspaceFolder.uri.fsPath,
            SPECKIT_CONFIG.paths.specs,
            specName
        );
    } else {
        specPath = join(
            workspaceFolder.uri.fsPath,
            DEFAULT_CONFIG.paths.specs,
            "specs",
            specName
        );
    }

    try {
        await workspace.fs.delete(Uri.file(specPath), {
            recursive: true,
        });
        await NotificationUtils.showAutoDismissNotification(
            `Spec "${specName}" deleted successfully`
        );
    } catch (error) {
        this.outputChannel.appendLine(
            `[SpecManager] Failed to delete spec: ${error}`
        );
        window.showErrorMessage(`Failed to delete spec: ${error}`);
    }
}
```

### Step 3: Add Unit Tests

**File**: `src/features/spec/spec-manager.test.ts`

Add tests for the new functionality:

```typescript
describe("delete", () => {
    it("should delete SpecKit spec from correct path", async () => {
        vi.mocked(window.showWarningMessage).mockResolvedValue("Delete");
        vi.mocked(workspace.fs.delete).mockResolvedValue();

        await specManager.delete("001-feature", "speckit");

        expect(workspace.fs.delete).toHaveBeenCalledWith(
            expect.objectContaining({
                path: expect.stringContaining("specs/001-feature")
            }),
            { recursive: true }
        );
    });

    it("should delete OpenSpec spec from correct path", async () => {
        vi.mocked(window.showWarningMessage).mockResolvedValue("Delete");
        vi.mocked(workspace.fs.delete).mockResolvedValue();

        await specManager.delete("my-feature", "openspec");

        expect(workspace.fs.delete).toHaveBeenCalledWith(
            expect.objectContaining({
                path: expect.stringContaining("openspec/specs/my-feature")
            }),
            { recursive: true }
        );
    });

    it("should not delete when user cancels confirmation", async () => {
        vi.mocked(window.showWarningMessage).mockResolvedValue(undefined);

        await specManager.delete("001-feature", "speckit");

        expect(workspace.fs.delete).not.toHaveBeenCalled();
    });
});
```

## Verification

### Manual Testing

1. Create a test SpecKit spec: `mkdir -p specs/999-test-spec && touch specs/999-test-spec/spec.md`
2. Open VS Code and navigate to Spec Explorer
3. Right-click on "999-test-spec" and select "Delete Spec"
4. Verify confirmation dialog appears
5. Click "Delete" and verify:
   - Success notification appears
   - Spec disappears from tree view
   - Directory is removed from filesystem

### Automated Testing

```bash
# Run all tests
npm run test

# Run specific test file
npm run test -- src/features/spec/spec-manager.test.ts

# Run with coverage
npm run test:coverage
```

### Lint Check

```bash
npm run check
```

## Common Issues

| Issue | Solution |
|-------|----------|
| "Cannot find module" | Run `npm run install:all` |
| Tests fail with mock errors | Ensure VS Code mock is imported first |
| Lint errors | Run `npm run fix` to auto-fix |
