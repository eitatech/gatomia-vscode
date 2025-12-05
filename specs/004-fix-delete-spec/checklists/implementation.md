# Implementation Checklist: Fix Delete Spec for SpecKit

**Purpose**: Validate implementation completeness, code quality, and test coverage
**Created**: 2024-12-05
**Feature**: [004-fix-delete-spec](../)

## Pre-Implementation

- [ ] CHK001 - Environment setup complete: `npm run install:all` executed successfully [Setup]
- [ ] CHK002 - Branch `004-fix-delete-spec` created and checked out [Setup]
- [ ] CHK003 - All specification documents reviewed and understood [Review]
- [ ] CHK004 - Technical context confirmed: TypeScript 5.x, VS Code Extension API [Context]
- [ ] CHK005 - Existing test patterns reviewed in `spec-manager.test.ts` [Review]

## Code Implementation

### Changes to src/extension.ts

- [ ] CHK006 - Command handler updated to pass `item.specName` and `item.system` [Implementation]
- [ ] CHK007 - Tree explorer refresh added after successful deletion [Implementation]
- [ ] CHK008 - Error handling preserves existing error display behavior [Implementation]

### Changes to src/features/spec/spec-manager.ts

- [ ] CHK009 - Delete method signature updated: `delete(specName: string, system?: SpecSystemMode)` [Implementation]
- [ ] CHK010 - Imports added: `SPEC_SYSTEM_MODE`, `SPECKIT_CONFIG` from constants [Implementation]
- [ ] CHK011 - Confirmation dialog implemented using `window.showWarningMessage` with modal option [Implementation]
- [ ] CHK012 - Confirmation dialog displays spec name in message [Implementation]
- [ ] CHK013 - Return early if user cancels confirmation [Implementation]
- [ ] CHK014 - Path resolution logic handles SpecKit path correctly: `specs/<specName>` [Implementation]
- [ ] CHK015 - Path resolution logic handles OpenSpec path correctly: `openspec/specs/<specName>` [Implementation]
- [ ] CHK016 - Fallback to `this.activeSystem` when no system parameter provided [Implementation]
- [ ] CHK017 - Success notification displays correct spec name [Implementation]
- [ ] CHK018 - Error message includes filesystem error details [Implementation]
- [ ] CHK019 - Output channel logging added for debugging [Implementation]

## Testing

### Unit Test Coverage

- [ ] CHK020 - Test: Delete SpecKit spec constructs correct path [Testing]
- [ ] CHK021 - Test: Delete OpenSpec spec constructs correct path [Testing]
- [ ] CHK022 - Test: Delete without system parameter uses activeSystem [Testing]
- [ ] CHK023 - Test: User cancel prevents deletion [Testing]
- [ ] CHK024 - Test: Missing workspace shows error [Testing]
- [ ] CHK025 - Test: Filesystem error caught and displayed [Testing]
- [ ] CHK026 - Test: Success notification shown after deletion [Testing]
- [ ] CHK027 - Test: Confirmation dialog shows correct message [Testing]

### Test Execution

- [ ] CHK028 - All tests pass: `npm run test -- spec-manager.test.ts` [Validation]
- [ ] CHK029 - Test coverage includes success, error, and cancel paths [Coverage]
- [ ] CHK030 - No console errors or warnings in test output [Quality]

## Code Quality

### Linting & Formatting

- [ ] CHK031 - No lint errors: `npm run check` passes completely [Quality]
- [ ] CHK032 - All formatting correct: `npm run format` applied [Quality]
- [ ] CHK033 - Complexity limits respected (all functions <complexity threshold) [Quality]
- [ ] CHK034 - No unused imports or variables [Quality]
- [ ] CHK035 - TypeScript strict mode satisfied (no `any` casts unless justified) [Quality]

### Best Practices

- [ ] CHK036 - Cross-platform path construction uses `path.join()` [Practice]
- [ ] CHK037 - Async/await used consistently (no Promise chaining) [Practice]
- [ ] CHK038 - Error messages are user-friendly and actionable [Practice]
- [ ] CHK039 - Output channel logs include meaningful context [Practice]
- [ ] CHK040 - Command registration pattern matches existing code style [Practice]

## Functional Verification

### Manual Testing - SpecKit

- [ ] CHK041 - Create test SpecKit spec: `mkdir -p specs/999-test && touch specs/999-test/spec.md` [Manual]
- [ ] CHK042 - Right-click spec in explorer shows "Delete Spec" option [Manual]
- [ ] CHK043 - Click delete shows confirmation dialog with spec name [Manual]
- [ ] CHK044 - Cancel dialog prevents deletion [Manual]
- [ ] CHK045 - Confirm deletion shows success notification [Manual]
- [ ] CHK046 - Spec removed from tree view immediately [Manual]
- [ ] CHK047 - Directory deleted from filesystem [Manual]

### Manual Testing - OpenSpec (Regression)

- [ ] CHK048 - Create test OpenSpec spec in `openspec/specs/test-spec/` [Manual]
- [ ] CHK049 - Delete works via same UI flow [Manual]
- [ ] CHK050 - Correct path deleted: `openspec/specs/test-spec/` [Manual]
- [ ] CHK051 - Success notification displays [Manual]

### Manual Testing - Error Cases

- [ ] CHK052 - Delete read-only spec shows appropriate error [Manual]
- [ ] CHK053 - Delete nonexistent spec shows error message [Manual]
- [ ] CHK054 - Delete spec with open file in editor shows warning/error [Manual]

## Documentation

- [ ] CHK055 - `plan.md` updated with post-implementation notes [Documentation]
- [ ] CHK056 - `research.md` remains accurate with actual implementation [Documentation]
- [ ] CHK057 - `data-model.md` reflects actual interface changes [Documentation]
- [ ] CHK058 - `quickstart.md` step-by-step guide matches implementation [Documentation]

## Git & PR Preparation

- [ ] CHK059 - All changes committed with clear, imperative commit messages [Git]
- [ ] CHK060 - Commits follow pattern: "Fix delete spec for SpecKit" [Git]
- [ ] CHK061 - No debug `console.log()` statements left in code [Git]
- [ ] CHK062 - Branch is up to date with `main` (no conflicts) [Git]
- [ ] CHK063 - PR title: "Fix: Delete Spec button now works for SpecKit specs" [Git]
- [ ] CHK064 - PR description links to feature spec [Git]
- [ ] CHK065 - PR lists all files changed [Git]

## Final Verification

- [ ] CHK066 - Extension compiles without errors: `npm run compile` [Build]
- [ ] CHK067 - Full test suite passes: `npm run test` [Build]
- [ ] CHK068 - Build artifacts created successfully [Build]
- [ ] CHK069 - No lint warnings in final state [Build]
- [ ] CHK070 - Feature works as specified in user scenarios [Acceptance]

## Post-Implementation

- [ ] CHK071 - Specification marked as "Implemented" [Closure]
- [ ] CHK072 - Branch merged to main [Closure]
- [ ] CHK073 - Release notes updated if applicable [Closure]
- [ ] CHK074 - Feature removed from active development queue [Closure]

---

## Notes

**Risk Areas to Monitor**:
- Path resolution with mixed SpecKit/OpenSpec workspaces
- File system permissions on different platforms
- Tree view refresh timing with rapid deletions

**Known Limitations**:
- Confirmation dialog text is English-only (no i18n)
- No undo functionality (deleted specs cannot be recovered)

**Success Criteria Mapping**:
- SC-001: SpecKit specs deletable → CHK020, CHK045, CHK046, CHK047
- SC-002: OpenSpec backward compat → CHK048, CHK049, CHK050, CHK051
- SC-003: Confirmation dialog → CHK011, CHK012, CHK043, CHK044
- SC-004: Performance <2s → Implied by CHK045 (manual timing)
- SC-005: Error messages clear → CHK018, CHK052, CHK053, CHK054
- SC-006: Tree refresh immediate → CHK046
