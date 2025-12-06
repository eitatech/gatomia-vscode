# GatomIA Constitution

## Core Principles

### I. Kebab-Case File Naming (MANDATORY)

**Rule**: All source files MUST follow kebab-case naming convention.

**Rationale**: Ensures consistency across the codebase, prevents linting errors, and maintains compatibility with various file systems and tooling. Files in kebab-case are easier to read, predict, and locate.

**Enforcement**:

- Linter MUST fail on any file not following kebab-case
- Code reviews MUST reject PRs with non-compliant file names
- Automated checks MUST validate file naming before merge

**Examples**:

- ✅ `preview-store.ts`, `document-preview-panel.ts`, `hook-executor.ts`
- ❌ `previewStore.ts`, `DocumentPreviewPanel.ts`, `hook_executor.ts`

**Exceptions**: Configuration files that require specific naming (e.g., `package.json`, `tsconfig.json`, `README.md`)

### II. TypeScript-First Development

**Rule**: All source code MUST be written in TypeScript with strict type checking enabled.

**Rationale**: Type safety prevents runtime errors, improves code maintainability, enables better IDE support, and serves as living documentation.

**Enforcement**:

- `strict: true` in tsconfig.json is non-negotiable
- No `any` types without explicit justification in code review
- All public APIs MUST have complete type definitions

### III. Test-First Development (NON-NEGOTIABLE)

**Rule**: Tests MUST be written and approved BEFORE implementation begins.

**Rationale**: TDD ensures requirements are clear, code is testable, and functionality is verified from the start. It prevents scope creep and reduces debugging time.

**Enforcement**:

- Red-Green-Refactor cycle strictly enforced
- PRs without corresponding tests are automatically rejected
- Test coverage MUST not decrease with new changes
- Integration tests required for new features and contract changes

### IV. Observability & Instrumentation

**Rule**: All significant operations MUST include appropriate telemetry, logging, and error reporting.

**Rationale**: Enables debugging in production, monitors performance targets, and provides insights into user behavior and system health.

**Enforcement**:

- Performance-critical paths MUST include instrumentation
- Errors MUST be logged with sufficient context for debugging
- Success criteria from specifications MUST be measurable via telemetry

### V. Simplicity & YAGNI

**Rule**: Implement only what is needed now. Do not add features or abstractions for potential future use.

**Rationale**: Prevents over-engineering, reduces complexity, keeps codebase maintainable, and accelerates delivery.

**Enforcement**:

- Code reviews MUST challenge unnecessary abstractions
- Features without current use cases are rejected
- Refactoring happens when patterns emerge (Rule of Three)

## Code Quality Standards

### Formatting & Style

**Requirements**:

- Tab indentation (configured in formatter)
- Double quotes for strings
- Semicolons required
- Formatter (`npm run format`) MUST pass before commit
- Linter (`npm run lint`) MUST pass before merge

### Documentation

**Requirements**:

- Public APIs MUST include JSDoc comments
- Complex algorithms MUST include explanatory comments
- README files MUST be kept up-to-date with feature changes
- Breaking changes MUST be documented in CHANGELOG

### Error Handling

**Requirements**:

- All async operations MUST handle errors explicitly
- User-facing errors MUST be actionable and clear
- Internal errors MUST include sufficient debug context
- No silent failures

## Governance

### Amendment Process

**Procedure**:

1. Proposed change documented with rationale
2. Team discussion and approval
3. Migration plan for existing code (if needed)
4. Constitution version increment (semantic versioning)
5. Update LAST_AMENDED_DATE

### Compliance

**Requirements**:

- All PRs MUST verify compliance with constitution principles
- Violations MUST be justified and documented
- Repeated violations trigger architecture review
- Constitution supersedes conflicting practices

### Version History

**Current Version**: 1.0.0

**Ratified**: 2025-12-06

**Last Amended**: 2025-12-06

**Change Log**:

- v1.0.0 (2025-12-06): Initial constitution with kebab-case mandate, TypeScript-first, TDD, observability, and simplicity principles
