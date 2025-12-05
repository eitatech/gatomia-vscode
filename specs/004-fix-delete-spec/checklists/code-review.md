# Code Review Checklist: Fix Delete Spec for SpecKit

**Purpose**: Guide code reviewers in validating implementation quality and correctness
**Created**: 2024-12-05
**Feature**: [004-fix-delete-spec](../)

## Review Scope

**Files Modified**:
- `src/extension.ts` - Command handler
- `src/features/spec/spec-manager.ts` - Delete method implementation
- `src/features/spec/spec-manager.test.ts` - Unit tests

**Files Not Modified** (should be unchanged):
- `src/constants.ts`
- `src/providers/spec-explorer-provider.ts`
- `package.json`

## Architecture & Design

- [ ] CHK-R001 - Design follows specification requirements exactly [Architecture]
- [ ] CHK-R002 - No breaking changes to public APIs [Compatibility]
- [ ] CHK-R003 - Backward compatible with OpenSpec specs [Compatibility]
- [ ] CHK-R004 - Uses existing `SpecItem.system` property (no new fields added) [Design]
- [ ] CHK-R005 - Confirmation dialog is necessary and user-friendly [UX]
- [ ] CHK-R006 - Path resolution logic is correct for both systems [Logic]

## Implementation Quality

### Command Registration (extension.ts)

- [ ] CHK-R007 - `item.specName` used correctly (fallback to `item.label` if needed) [Correctness]
- [ ] CHK-R008 - `item.system` passed correctly to delete method [Correctness]
- [ ] CHK-R009 - Explorer refresh called after deletion: `specExplorer.refresh()` [Correctness]
- [ ] CHK-R010 - Error handler preserves existing behavior [Compatibility]

### Delete Method (spec-manager.ts)

- [ ] CHK-R011 - Method signature: `async delete(specName: string, system?: SpecSystemMode)` [Signature]
- [ ] CHK-R012 - Workspace folder check before proceeding [Safety]
- [ ] CHK-R013 - Confirmation modal shows spec name: `"Are you sure...${specName}...?"` [UX]
- [ ] CHK-R014 - Early return on cancel prevents deletion [Safety]
- [ ] CHK-R015 - SpecKit path: `join(..., SPECKIT_CONFIG.paths.specs, specName)` [Correctness]
- [ ] CHK-R016 - OpenSpec path: `join(..., DEFAULT_CONFIG.paths.specs, "specs", specName)` [Correctness]
- [ ] CHK-R017 - Fallback to `this.activeSystem` when system not provided [Behavior]
- [ ] CHK-R018 - Success notification with spec name shown [UX]
- [ ] CHK-R019 - Error logged to output channel [Debugging]
- [ ] CHK-R020 - Error shown to user with details [UX]
- [ ] CHK-R021 - No temporary files or side effects left behind [Cleanup]

### Type Safety

- [ ] CHK-R022 - `SpecSystemMode` type imported correctly [Types]
- [ ] CHK-R023 - Type checking passes: `system: SpecSystemMode | undefined` [Types]
- [ ] CHK-R024 - No `any` casts used inappropriately [Types]
- [ ] CHK-R025 - Return type `Promise<void>` consistent with async pattern [Types]

## Test Coverage

### Test Structure

- [ ] CHK-R026 - Tests use existing mock patterns from `spec-manager.test.ts` [Patterns]
- [ ] CHK-R027 - Tests mock `workspace.fs.delete` correctly [Mocking]
- [ ] CHK-R028 - Tests mock confirmation dialog responses [Mocking]
- [ ] CHK-R029 - Tests verify all code paths (success, error, cancel) [Coverage]

### Test Assertions

- [ ] CHK-R030 - SpecKit test verifies path contains `"specs/"` [Assertion]
- [ ] CHK-R031 - OpenSpec test verifies path contains `"openspec/specs/"` [Assertion]
- [ ] CHK-R032 - Cancel test verifies `workspace.fs.delete` NOT called [Assertion]
- [ ] CHK-R033 - Success test verifies notification shown [Assertion]
- [ ] CHK-R034 - Error test verifies error message displayed [Assertion]

### Test Independence

- [ ] CHK-R035 - Tests don't depend on execution order [Independence]
- [ ] CHK-R036 - Each test clears mocks before running [Isolation]
- [ ] CHK-R037 - Tests use specific mock return values [Clarity]

## Code Quality

### Linting & Style

- [ ] CHK-R038 - `npm run check` passes without warnings [Lint]
- [ ] CHK-R039 - Code formatted consistently: tabs, double quotes [Style]
- [ ] CHK-R040 - No unused imports [Cleanup]
- [ ] CHK-R041 - No console statements left in code [Cleanup]
- [ ] CHK-R042 - Complexity below repository thresholds [Complexity]

### Best Practices

- [ ] CHK-R043 - Uses `workspace.fs.delete()` for cross-platform compatibility [Platform]
- [ ] CHK-R044 - Uses `path.join()` for path construction [Platform]
- [ ] CHK-R045 - Error messages are specific and actionable [UX]
- [ ] CHK-R046 - Logging includes `[SpecManager]` prefix for context [Logging]
- [ ] CHK-R047 - No hardcoded paths (uses constants) [Maintainability]

## Security & Edge Cases

- [ ] CHK-R048 - Path traversal not possible (uses normalized paths) [Security]
- [ ] CHK-R049 - Confirmation required before any deletion [Safety]
- [ ] CHK-R050 - Handles missing workspace gracefully [Robustness]
- [ ] CHK-R051 - Handles non-existent spec directory gracefully [Robustness]
- [ ] CHK-R052 - Handles permission errors and displays them to user [Robustness]
- [ ] CHK-R053 - Read-only files handled appropriately [Robustness]

## Specification Compliance

- [ ] CHK-R054 - FR-001: Correctly identifies spec system ✓ [Spec Req]
- [ ] CHK-R055 - FR-002: SpecKit path correct ✓ [Spec Req]
- [ ] CHK-R056 - FR-003: OpenSpec path correct ✓ [Spec Req]
- [ ] CHK-R057 - FR-004: Uses system property from SpecItem ✓ [Spec Req]
- [ ] CHK-R058 - FR-005: Success notification displayed ✓ [Spec Req]
- [ ] CHK-R059 - FR-006: Error message shown on failure ✓ [Spec Req]
- [ ] CHK-R060 - FR-007: Tree view refreshed ✓ [Spec Req]
- [ ] CHK-R061 - FR-008: Confirmation dialog shown ✓ [Spec Req]
- [ ] CHK-R062 - FR-009: No deletion on cancel ✓ [Spec Req]

## Constitution Compliance

- [ ] CHK-R063 - Code passes Biome checks: `npm run check` [Constitution I]
- [ ] CHK-R064 - No hook agent changes needed [Constitution II]
- [ ] CHK-R065 - Modal dialog uses native VS Code API [Constitution III]
- [ ] CHK-R066 - Comprehensive test coverage included [Constitution IV]
- [ ] CHK-R067 - Code is simple and maintainable [Constitution V]

## Documentation Alignment

- [ ] CHK-R068 - Implementation matches `quickstart.md` code samples [Docs]
- [ ] CHK-R069 - Actual paths match those in `data-model.md` [Docs]
- [ ] CHK-R070 - Error handling matches `research.md` analysis [Docs]
- [ ] CHK-R071 - Test cases match `quickstart.md` guide [Docs]

## Regression Testing

- [ ] CHK-R072 - OpenSpec deletion still works [Regression]
- [ ] CHK-R073 - Confirmation dialog doesn't appear for other operations [Regression]
- [ ] CHK-R074 - Tree refresh doesn't break other tree operations [Regression]
- [ ] CHK-R075 - No errors in existing test suite [Regression]

## Performance & Stability

- [ ] CHK-R076 - No new circular dependencies introduced [Stability]
- [ ] CHK-R077 - Memory usage doesn't increase significantly [Performance]
- [ ] CHK-R078 - No blocking operations on UI thread [Performance]
- [ ] CHK-R079 - Deletion completes in <2 seconds (typical case) [Performance]
- [ ] CHK-R080 - No resource leaks (file handles, event listeners) [Stability]

## Final Review Decision

### Questions for Author

- [ ] Is there any scenario where the system parameter might not be available?
- [ ] Have you tested with mixed SpecKit/OpenSpec workspaces?
- [ ] What happens if a spec file is open during deletion?

### Approval Criteria

**Approve if ALL of the following are true**:
- ✅ All implementation items checked (CHK-R001 through CHK-R080)
- ✅ No security or safety concerns identified
- ✅ Tests provide adequate coverage
- ✅ Code meets repository standards
- ✅ Specification requirements fully satisfied

**Request Changes if ANY of the following are true**:
- ❌ Test coverage insufficient
- ❌ Security/safety concern identified
- ❌ Non-compliance with Constitution
- ❌ Breaking change introduced

**Recommendations**:
- [ ] Request changes (specify reason)
- [ ] Request for minor revisions
- [ ] Approve with minor comments
- [ ] Approve
