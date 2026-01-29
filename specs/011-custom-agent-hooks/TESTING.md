# Manual Testing Guide: Custom Agent Hooks UI

## Feature Overview

The Custom Agent Hooks UI now includes:
- **ArgumentTemplateEditor** component with variable picker
- **Template syntax**: `$variableName` (migrated from `{variableName}`)
- **8 new template variables** for richer context

## How to Test

### 1. Launch Extension Development Host

```bash
# From VS Code
Press F5
```

This opens a new VS Code window with the extension loaded.

### 2. Open Hooks Configuration

In the Extension Development Host window:
1. Open Command Palette: `Cmd+Shift+P` (Mac) or `Ctrl+Shift+P` (Windows/Linux)
2. Type: `GatomIA: Configure Hooks`
3. Press Enter

### 3. Create a Custom Action Hook

#### Test Scenario 1: Basic Custom Action
1. Click **"Add Hook"** button
2. Select trigger: **"specify"** (or any trigger type)
3. Select action type: **"custom"**
4. Select agent: **"code-reviewer"** (or any available agent)
5. In the **Arguments** field, you should see:
   - Text input field
   - **Variable picker** button (dropdown icon)
6. Click the variable picker
7. Verify you see variables like:
   - `$timestamp`
   - `$triggerType`
   - `$specId`
   - `$repoOwner` (NEW)
   - `$workspacePath` (NEW)
   - etc.
8. Click a variable (e.g., `$specId`)
9. Verify it inserts into the arguments field: `$specId`
10. Complete the argument: `--spec $specId --author $changeAuthor`
11. Click **"Save Hook"**

#### Test Scenario 2: Agent Action with Templates
1. Create new hook with trigger: **"clarify"**
2. Select action type: **"agent"**
3. In the **Command** field:
   - Click variable picker
   - Select multiple variables: `$specId`, `$newStatus`, `$changeAuthor`
   - Build command: `/speckit.clarify --spec $specId --status $newStatus --author $changeAuthor`
4. Save hook

#### Test Scenario 3: Verify Agent Selection Persistence
1. Create new hook
2. Select action type: **"custom"**
3. Select agent: **"test-agent"**
4. Click variable picker (should work)
5. Change arguments
6. Verify agent selection **remains** "test-agent" (bug fix verification)

### 4. Verify Template Expansion (Runtime)

1. After saving hooks, check the Output panel:
   - View → Output
   - Select **"GatomIA"** from dropdown
2. Trigger a hook by performing the corresponding operation
3. Check logs for template expansion:
   ```
   [HookExecutor] Expanded template: "/speckit.clarify --spec 011-custom-agent-hooks --status review --author john-doe"
   ```

### 5. Test New Template Variables

Create hooks using the 8 new variables:

#### Spec Artifacts
- `$useCaseId` - Example: `--use-case $useCaseId`
- `$taskId` - Example: `--task $taskId`
- `$requirementId` - Example: `--requirement $requirementId`

#### Repository
- `$repoOwner` - Example: `--org $repoOwner`
- `$repoName` - Example: `--repo $repoName`
- `$workspacePath` - Example: `--path $workspacePath`

#### Agent Metadata
- `$agentId` - Example: `--agent $agentId`
- `$agentType` - Example: `--type $agentType`

### 6. Test Edge Cases

#### Empty Variables
- Try arguments with lone `$`: `Price: $100`
- Should show validation error: "Empty variable name"

#### Invalid Variable Names
- Try: `$123invalid`
- Should show error: "Invalid variable name"

#### Valid Edge Cases
- `$var_with_underscores` ✅
- `$var123` ✅
- `$_privateVar` ✅
- Literal currency: `Price is $100` ✅ (not a variable)

## Expected Results

### UI Behavior
- ✅ Variable picker visible for custom and agent actions
- ✅ Clicking variables inserts them with `$` prefix
- ✅ Agent selection persists when editing arguments
- ✅ Real-time validation shows errors for invalid syntax
- ✅ Variables organized by category (standard, spec, git, user)

### Runtime Behavior
- ✅ Templates expand correctly in logs
- ✅ Missing variables replaced with empty string (graceful)
- ✅ All 18 variables available (10 existing + 8 new)
- ✅ No errors in extension logs during expansion

## Build Verification

Before testing, ensure build is clean:

```bash
npm run build        # Should complete without errors
npm run check        # Should pass linting
npm test            # 509/523 tests should pass
```

## Known Issues (Pre-existing)

**14 test failures unrelated to template work:**
- 10 failures in `edge-cases.test.ts` (agent file discovery)
- 4 failures in `hook-executor.test.ts` (agent routing)

These failures existed before template variable work began and do NOT affect the UI or template functionality.

## Troubleshooting

### Extension Not Loading
- Check "Extension Host" logs in Output panel
- Rebuild: `npm run build:ext`

### Webview Not Rendering
- Check browser console (Cmd+Shift+I in webview)
- Rebuild: `npm run build:webview`

### Variables Not Appearing
- Check `argument-template-editor.tsx` is properly imported
- Verify `ALL_VARIABLES` includes new variables
- Check console for React errors

## Success Criteria

✅ **UI**: Variable picker visible and functional  
✅ **Insertion**: Variables insert with `$variableName` syntax  
✅ **Validation**: Invalid syntax shows errors  
✅ **Persistence**: Agent selection doesn't reset  
✅ **Runtime**: Templates expand correctly in logs  
✅ **New Variables**: All 8 new variables available and resolve correctly  

## Next Steps After Manual Testing

1. If all tests pass → **Ready to merge**
2. If bugs found → Fix and re-test
3. Optional: Address 14 pre-existing test failures
4. Optional: Update user documentation with new variables
