---
version: "1.0"
owner: "Italo A. G."
---

# Quick Start: Implementing Automatic Document Version Tracking

**Feature**: 012-spec-version-tracking  
**Date**: 2026-01-29  
**Intended Audience**: Developers implementing this feature

## Purpose

This quick start guide provides step-by-step instructions for implementing automatic document version tracking following TDD principles and the project constitution. Start here before writing any code.

---

## Prerequisites

Before you begin, ensure:
- ✅ All planning documents reviewed ([spec.md](./spec.md), [plan.md](./plan.md), [data-model.md](./data-model.md), [research.md](./research.md))
- ✅ Development environment set up (`npm run install:all` completed)
- ✅ Familiar with project constitution ([.specify/memory/constitution.md](../../.specify/memory/constitution.md))
- ✅ VS Code Extension API basics understood

---

## TDD Workflow Overview

**Remember**: Tests MUST be written BEFORE implementation (Constitution Rule III)

```
1. Write failing test (RED)
   ├─ Define test case based on spec requirement
   ├─ Write assertions for expected behavior
   └─ Run test → verify it fails

2. Implement minimal code (GREEN)
   ├─ Write simplest code to make test pass
   ├─ Run test → verify it passes
   └─ Ensure no other tests broken

3. Refactor (REFACTOR)
   ├─ Extract duplicated code
   ├─ Improve naming and structure
   ├─ Run tests → ensure still passing
   └─ Check linter (`npm run check`)

4. Repeat for next requirement
```

---

## Implementation Order

Follow this sequence to build features incrementally:

### Phase 1: Core Version Logic (Day 1)

**Goal**: Implement pure version increment logic with no I/O dependencies

**Files to Create** (in kebab-case):
- `src/features/documents/version-tracking/version-incrementer.ts`
- `tests/unit/features/documents/version-tracking/version-incrementer.test.ts`

**TDD Steps**:

1. **Write test**: Version increment 1.0 → 1.1
   ```typescript
   // tests/unit/.../version-incrementer.test.ts
   import { describe, it, expect } from 'vitest';
   import { VersionIncrementer } from '@/features/documents/version-tracking/version-incrementer';
   
   describe('VersionIncrementer', () => {
     it('increments minor version', () => {
       const incrementer = new VersionIncrementer();
       expect(incrementer.increment('1.0')).toBe('1.1');
     });
   });
   ```

2. **Run test**: `npm test -- version-incrementer.test.ts` → Should FAIL (file doesn't exist)

3. **Implement minimal code**:
   ```typescript
   // src/features/documents/version-tracking/version-incrementer.ts
   export class VersionIncrementer {
     increment(version: string): string {
       const [major, minor] = version.split('.').map(Number);
       return `${major}.${minor + 1}`;
     }
   }
   ```

4. **Run test**: Should PASS

5. **Add more tests** (TDD cycle continues):
   - Minor overflow: 1.9 → 2.0
   - Multiple increments: 2.5 → 2.6
   - Invalid version normalization: "1.10" → "2.0", "v1.0" → "1.0"

6. **Refactor**: Extract constants, add validation

**Constitution Check**:
- ✅ Kebab-case filenames
- ✅ TypeScript strict mode
- ✅ Tests written first
- ✅ No `any` types

---

### Phase 2: Git User Info Extraction (Day 1-2)

**Goal**: Fetch Git user.name and user.email with fallback

**Files to Create**:
- `src/utils/git-user-info.ts`
- `tests/unit/utils/git-user-info.test.ts`

**TDD Steps**:

1. **Write test**: Get Git user info (use mock execSync)
   ```typescript
   import { vi, describe, it, expect, beforeEach } from 'vitest';
   import { getGitUserInfo } from '@/utils/git-user-info';
   import * as child_process from 'node:child_process';
   
   // Mock at top level (Constitution: regex as constants)
   vi.mock('node:child_process');
   
   describe('getGitUserInfo', () => {
     beforeEach(() => {
       vi.resetAllMocks();
     });
     
     it('returns Git user.name and user.email', () => {
       vi.mocked(child_process.execSync)
         .mockReturnValueOnce(Buffer.from('Italo\n'))
         .mockReturnValueOnce(Buffer.from('182202+italoag@users.noreply.github.com\n'));
       
       const info = getGitUserInfo();
       expect(info.name).toBe('Italo');
       expect(info.email).toBe('182202+italoag@users.noreply.github.com');
     });
   });
   ```

2. **Run test**: Should FAIL

3. **Implement**:
   ```typescript
   import { execSync } from 'node:child_process';
   import * as os from 'node:os';
   
   export interface GitUserInfo {
     name: string;
     email: string;
   }
   
   export function getGitUserInfo(): GitUserInfo {
     try {
       const name = execSync('git config user.name', { encoding: 'utf-8' }).trim();
       const email = execSync('git config user.email', { encoding: 'utf-8' }).trim();
       return { name, email };
     } catch (error) {
       const username = os.userInfo().username;
       console.warn('Git not configured, using fallback');
       return { name: username, email: `${username}@localhost` };
     }
   }
   ```

4. **Run test**: Should PASS

5. **Add more tests**:
   - Git not configured → fallback
   - Git command timeout → fallback
   - Format owner string: "Italo <email>"

**Constitution Check**:
- ✅ Error handling with logging
- ✅ Graceful degradation (fallback)

---

### Phase 3: Frontmatter Processing (Day 2-3)

**Goal**: Parse YAML frontmatter, extract metadata, update fields

**Files to Create**:
- `src/features/documents/version-tracking/frontmatter-processor.ts`
- `tests/unit/features/documents/version-tracking/frontmatter-processor.test.ts`

**Dependencies**: Install `gray-matter` (already in package.json)

**TDD Steps**:

1. **Write test**: Extract version from frontmatter
   ```typescript
   import { describe, it, expect } from 'vitest';
   import { FrontmatterProcessor } from '@/features/documents/version-tracking/frontmatter-processor';
   import * as fs from 'node:fs/promises';
   import * as path from 'node:path';
   
   describe('FrontmatterProcessor', () => {
     it('extracts version from document', async () => {
       const testFile = path.join(__dirname, 'fixtures', 'test-spec.md');
       await fs.writeFile(testFile, '---\nversion: "1.5"\nowner: "Test"\n---\nBody content');
       
       const processor = new FrontmatterProcessor();
       const metadata = await processor.extract(testFile);
       
       expect(metadata.version).toBe('1.5');
       expect(metadata.owner).toBe('Test');
     });
   });
   ```

2. **Run test**: Should FAIL

3. **Implement using gray-matter**:
   ```typescript
   import matter from 'gray-matter';
   import * as fs from 'node:fs/promises';
   
   export class FrontmatterProcessor {
     async extract(documentPath: string): Promise<DocumentMetadata> {
       const content = await fs.readFile(documentPath, 'utf-8');
       const parsed = matter(content);
       
       return {
         version: parsed.data.version || '1.0',
         owner: parsed.data.owner || ''
       };
     }
   }
   ```

4. **Run test**: Should PASS

5. **Add more tests**:
   - Update frontmatter fields
   - Missing frontmatter → defaults
   - Malformed YAML → error handling
   - Extract body content (for change detection)

**Constitution Check**:
- ✅ Observability (error logging for YAML failures)

---

### Phase 4: Version History Manager (Day 3-4)

**Goal**: Persist version history to workspace state with FIFO rotation

**Files to Create**:
- `src/features/documents/version-tracking/version-history-manager.ts`
- `tests/unit/features/documents/version-tracking/version-history-manager.test.ts`

**TDD Steps**:

1. **Write test**: Add history entry
   ```typescript
   import { describe, it, expect, beforeEach } from 'vitest';
   import { VersionHistoryManager } from '@/features/documents/version-tracking/version-history-manager';
   
   describe('VersionHistoryManager', () => {
     let manager: VersionHistoryManager;
     let mockContext: any;
     
     beforeEach(() => {
       mockContext = {
         workspaceState: {
           get: vi.fn(() => ({ schemaVersion: '1.0', documents: {} })),
           update: vi.fn()
         }
       };
       manager = new VersionHistoryManager(mockContext);
     });
     
     it('adds history entry to workspace state', async () => {
       const entry = {
         documentPath: '/path/to/spec.md',
         previousVersion: '1.0',
         newVersion: '1.1',
         timestamp: new Date().toISOString(),
         author: 'Test',
         changeType: 'auto-increment' as const
       };
       
       await manager.addEntry('/path/to/spec.md', entry);
       
       expect(mockContext.workspaceState.update).toHaveBeenCalled();
     });
   });
   ```

2. **Run test**: Should FAIL

3. **Implement**:
   ```typescript
   export class VersionHistoryManager {
     constructor(private context: ExtensionContext) {}
     
     async addEntry(documentPath: string, entry: VersionHistoryEntry): Promise<void> {
       const state = await this.getWorkspaceState();
       if (!state.documents[documentPath]) {
         state.documents[documentPath] = { history: [], currentVersion: entry.newVersion, owner: entry.author, createdBy: entry.author };
       }
       
       state.documents[documentPath].history.push(entry);
       
       // FIFO rotation
       if (state.documents[documentPath].history.length > 50) {
         state.documents[documentPath].history.shift();
       }
       
       await this.context.workspaceState.update('documentVersionTracking', state);
     }
   }
   ```

4. **Run test**: Should PASS

5. **Add more tests**:
   - FIFO rotation at 50 entries
   - Get history for document
   - Update document state
   - Clear history

---

### Phase 5: Debounce Tracker (Day 4)

**Goal**: Track last increment timestamp, enforce 30-second debounce

**Files to Create**:
- `src/features/documents/version-tracking/debounce-tracker.ts`
- `tests/unit/features/documents/version-tracking/debounce-tracker.test.ts`

**TDD Steps**:

1. **Write test with fake timers**:
   ```typescript
   import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
   import { DebounceTracker } from '@/features/documents/version-tracking/debounce-tracker';
   
   describe('DebounceTracker', () => {
     beforeEach(() => {
       vi.useFakeTimers();
     });
     
     afterEach(() => {
       vi.useRealTimers();
     });
     
     it('allows increment after 30 seconds', async () => {
       const tracker = new DebounceTracker(mockHistoryManager);
       
       expect(await tracker.shouldIncrement('/path/to/spec.md')).toBe(true); // First call
       await tracker.recordIncrement('/path/to/spec.md');
       
       expect(await tracker.shouldIncrement('/path/to/spec.md')).toBe(false); // Within 30s
       
       vi.advanceTimersByTime(30_000); // Fast-forward 30 seconds
       
       expect(await tracker.shouldIncrement('/path/to/spec.md')).toBe(true); // After 30s
     });
   });
   ```

2. **Run test**: Should FAIL

3. **Implement**:
   ```typescript
   const DEBOUNCE_MS = 30_000;
   
   export class DebounceTracker {
     constructor(private historyManager: IVersionHistoryManager) {}
     
     async shouldIncrement(documentPath: string): Promise<boolean> {
       const state = await this.historyManager.getDocumentState(documentPath);
       if (!state?.lastIncrementTimestamp) {
         return true;
       }
       
       const elapsed = Date.now() - state.lastIncrementTimestamp;
       return elapsed >= DEBOUNCE_MS;
     }
     
     async recordIncrement(documentPath: string): Promise<void> {
       await this.historyManager.updateDocumentState(documentPath, {
         lastIncrementTimestamp: Date.now()
       });
     }
   }
   ```

4. **Run test**: Should PASS

---

### Phase 6: Document Version Service (Day 5-6)

**Goal**: Orchestrate all components, handle save events

**Files to Create**:
- `src/features/documents/version-tracking/document-version-service.ts`
- `tests/integration/document-version-tracking.test.ts`

**TDD Steps**:

1. **Write integration test**:
   ```typescript
   import { describe, it, expect } from 'vitest';
   import { DocumentVersionService } from '@/features/documents/version-tracking/document-version-service';
   
   describe('DocumentVersionService (integration)', () => {
     it('increments version on document save', async () => {
       const service = createTestService();
       const document = await createTestDocument({ version: '1.0' });
       
       await service.processDocumentSave(document);
       
       const metadata = await service.getDocumentMetadata(document.uri.fsPath);
       expect(metadata?.version).toBe('1.1');
     });
   });
   ```

2. **Run test**: Should FAIL

3. **Implement service orchestration**:
   ```typescript
   export class DocumentVersionService implements IDocumentVersionService {
     private processingDocuments = new Set<string>(); // Infinite loop prevention
     
     constructor(
       private versionIncrementer: IVersionIncrementer,
       private frontmatterProcessor: IFrontmatterProcessor,
       private historyManager: IVersionHistoryManager,
       private debounceTracker: IDebounceTracker,
       private gitUserInfo: IGitUserInfoProvider
     ) {}
     
     async processDocumentSave(document: TextDocument): Promise<void> {
       const path = document.uri.fsPath;
       
       // Prevent infinite loop
       if (this.processingDocuments.has(path)) {
         return;
       }
       
       try {
         this.processingDocuments.add(path);
         
         // Check if SpecKit document
         if (!this.isSpecKitDocument(path)) {
           return;
         }
         
         // Check debounce
         if (!(await this.debounceTracker.shouldIncrement(path))) {
           return;
         }
         
         // Extract current metadata
         const metadata = await this.frontmatterProcessor.extract(path);
         
         // Increment version
         const newVersion = this.versionIncrementer.increment(metadata.version);
         const gitInfo = this.gitUserInfo.getUserInfo();
         const newOwner = this.gitUserInfo.formatOwner(gitInfo);
         
         // Update frontmatter
         await this.frontmatterProcessor.update(path, {
           version: newVersion,
           owner: newOwner
         });
         
         // Record in history
         await this.historyManager.addEntry(path, {
           documentPath: path,
           previousVersion: metadata.version,
           newVersion,
           timestamp: new Date().toISOString(),
           author: newOwner,
           changeType: 'auto-increment'
         });
         
         // Record debounce timestamp
         await this.debounceTracker.recordIncrement(path);
         
         console.log(`Version incremented: ${metadata.version} → ${newVersion} for ${path}`);
       } finally {
         this.processingDocuments.delete(path);
       }
     }
     
     private isSpecKitDocument(path: string): boolean {
       return path.endsWith('spec.md') || path.endsWith('plan.md') || path.endsWith('tasks.md');
     }
   }
   ```

4. **Run test**: Should PASS

5. **Add more integration tests**:
   - Debounce prevents rapid increments
   - Body content change detection
   - Infinite loop prevention
   - Error recovery

---

### Phase 7: Extension Integration (Day 6-7)

**Goal**: Register file watchers, commands, tree view updates

**Files to Modify**:
- `src/extension.ts` (register save event handler)
- `src/providers/spec-explorer-provider.ts` (add version display)
- `src/commands/reset-document-version-command.ts` (new command)

**Steps**:

1. **Register save event handler** (in `extension.ts`):
   ```typescript
   export function activate(context: ExtensionContext) {
     const versionService = createDocumentVersionService(context);
     
     const saveDisposable = workspace.onDidSaveTextDocument(async (document) => {
       await versionService.processDocumentSave(document);
     });
     
     context.subscriptions.push(saveDisposable);
   }
   ```

2. **Add version display to Spec Explorer**:
   ```typescript
   // In spec-explorer-provider.ts
   getTreeItem(element: SpecItem): TreeItem {
     const treeItem = new TreeItem(element.label);
     
     // Add version suffix
     const metadata = await versionService.getDocumentMetadata(element.specPath);
     if (metadata) {
       treeItem.description = `v${metadata.version}`;
     }
     
     return treeItem;
   }
   ```

3. **Create reset command**:
   ```typescript
   // src/commands/reset-document-version-command.ts
   export async function resetDocumentVersion(uri: Uri): Promise<void> {
     const response = await window.showWarningMessage(
       'Reset document version to 1.0? This action cannot be undone.',
       { modal: true },
       'Reset'
     );
     
     if (response === 'Reset') {
       await versionService.resetDocumentVersion(uri.fsPath);
       window.showInformationMessage('Document version reset to 1.0');
     }
   }
   ```

4. **Register command in package.json**:
   ```json
   {
     "commands": [
       {
         "command": "gatomia.resetDocumentVersion",
         "title": "GatomIA: Reset Document Version",
         "category": "SpecKit"
       }
     ],
     "menus": {
       "view/item/context": [
         {
           "command": "gatomia.resetDocumentVersion",
           "when": "view == specExplorer && viewItem == specItem",
           "group": "navigation"
         }
       ]
     }
   }
   ```

---

## Testing Checklist

Before marking feature complete, verify:

### Unit Tests
- ✅ All components have >90% code coverage
- ✅ Version increment logic (all scenarios)
- ✅ Git user info extraction (with fallbacks)
- ✅ Frontmatter parsing (valid/invalid YAML)
- ✅ History FIFO rotation (exactly 50 entries)
- ✅ Debounce timing (with fake timers)

### Integration Tests
- ✅ End-to-end: create document → save → version increments
- ✅ Rapid saves handled correctly (debounce)
- ✅ Manual version changes respected
- ✅ Reset command works
- ✅ Infinite loop prevention

### Manual Tests
- ✅ Create new spec via `/speckit.specify` → has version "1.0"
- ✅ Edit and save spec → version increments
- ✅ Save 9 times → version goes 1.0 → 1.9 → 2.0
- ✅ Spec Explorer shows version badges
- ✅ Reset command accessible via Command Palette and Context Menu

---

## Pre-Commit Checklist

Before committing:
- ✅ `npm test` passes (all tests green)
- ✅ `npm run check` passes (linting + formatting)
- ✅ No `console.log` statements (use proper logging)
- ✅ No regex patterns inside functions (move to top-level constants)
- ✅ All files use kebab-case naming
- ✅ No `any` types without justification
- ✅ All public APIs have TypeScript types + JSDoc comments

---

## Common Pitfalls

### Infinite Save Loop
**Problem**: Save event triggers update → file write → triggers another save → infinite loop

**Solution**: Use dirty flag (`Set<string>`) to track documents being processed

### Debounce Not Working
**Problem**: Timer resets on every blocked save, never expires

**Solution**: Timer starts on SUCCESSFUL increment, not on blocked attempts

### Version Normalization Edge Cases
**Problem**: "1.10" incorrectly normalized to "1.0" instead of "2.0"

**Solution**: Check minor > 9 → increment major, reset minor to 0

### Workspace State Not Persisting
**Problem**: History lost on extension reload

**Solution**: Use `context.workspaceState.update()` (async), not in-memory only

### Git Not Available in Tests
**Problem**: Tests fail in CI environment without Git

**Solution**: Mock `child_process.execSync` in tests

---

## Next Steps After Implementation

1. **Generate tasks**: Run `/speckit.tasks` to create task breakdown
2. **Implementation**: Follow tasks in order, TDD cycle for each
3. **Code review**: Self-review against constitution checklist
4. **Documentation**: Update README, CHANGELOG, agent context
5. **PR**: Create pull request with tests + implementation

---

## Support & References

- **Specification**: [spec.md](./spec.md)
- **Technical Plan**: [plan.md](./plan.md)
- **Data Model**: [data-model.md](./data-model.md)
- **API Contracts**: [contracts/document-version-service.api.ts](./contracts/document-version-service.api.ts)
- **Research**: [research.md](./research.md)
- **Constitution**: [.specify/memory/constitution.md](../../.specify/memory/constitution.md)

---

**Remember**: Tests first, implementation second, refactor third. No exceptions.

---

*Last Updated*: 2026-01-29
