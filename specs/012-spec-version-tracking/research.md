---
version: "1.0"
owner: "Italo A. G."
---

# Research: Automatic Document Version and Author Tracking

**Feature**: 012-spec-version-tracking  
**Date**: 2026-01-29  
**Status**: ✅ Complete

## Purpose

This document consolidates all technology research and architectural decisions for implementing automatic version tracking in SpecKit documents. All decisions have been finalized during the planning phase.

## Technology Stack Decisions

### 1. YAML Frontmatter Parsing Library

**Decision**: gray-matter 4.x

**Rationale**: 
- De facto standard for YAML frontmatter parsing in Node.js ecosystem
- Used by major static site generators (Gatsby, Jekyll, Hugo) - battle-tested
- Excellent TypeScript support with comprehensive type definitions
- Handles edge cases: missing frontmatter, malformed YAML, multiline strings, escaped characters
- Active maintenance and large community

**Alternatives Considered**:
- **front-matter**: Less actively maintained, limited TypeScript support, smaller community
- **remark-frontmatter**: Tightly coupled to remark parser ecosystem, overkill for simple YAML extraction
- **Custom regex parsing**: Error-prone, doesn't handle YAML edge cases properly, reinventing the wheel

**API Example**:
```typescript
import matter from 'gray-matter';

const fileContent = await fs.readFile(path, 'utf-8');
const parsed = matter(fileContent);
// parsed.data = { version: "1.0", owner: "..." }
// parsed.content = body content after frontmatter

parsed.data.version = "1.1";
const updated = matter.stringify(parsed.content, parsed.data);
await fs.writeFile(path, updated);
```

---

### 2. File Watching Mechanism

**Decision**: VS Code API `workspace.onDidSaveTextDocument` + `vscode.workspace.createFileSystemWatcher`

**Rationale**:
- Built into VS Code Extension API - zero external dependencies
- Automatically filters for workspace files only
- Handles remote environments (SSH, WSL, Codespaces) transparently
- Provides document URI + content directly - no additional file I/O needed
- Respects VS Code's file exclude patterns (.gitignore, files.exclude settings)
- Built-in debouncing of file system events

**Alternatives Considered**:
- **chokidar**: External dependency, redundant with VS Code built-in watchers, doesn't work in remote environments
- **Node.js fs.watch**: Lower-level API, doesn't handle remote environments, no VS Code integration
- **Polling (fs.stat interval)**: Inefficient, high resource usage for large workspaces, delayed detection

**API Example**:
```typescript
// In activate()
const saveDisposable = workspace.onDidSaveTextDocument(async (document) => {
  if (document.uri.fsPath.endsWith('.md') && isSpecKitDocument(document.uri)) {
    await documentVersionService.processDocumentSave(document);
  }
});

context.subscriptions.push(saveDisposable);
```

---

### 3. Git User Information Extraction

**Decision**: Node.js `child_process.execSync` with `git config user.name` and `git config user.email`

**Rationale**:
- Lightweight approach - no external dependencies beyond Node.js stdlib
- Standard Git CLI interface - works everywhere Git is installed
- Synchronous execution acceptable (called infrequently, <50ms typical)
- Handles global and local config precedence automatically
- Works in all environments (local, SSH, WSL, Codespaces)

**Alternatives Considered**:
- **simple-git library**: External dependency (npm package), overkill for two simple config reads, adds bundle size
- **VS Code Git extension API**: Coupling to another extension, availability not guaranteed, API may change
- **Environment variables ($GIT_AUTHOR_NAME)**: Not universally set, less reliable, doesn't respect local .git/config

**Implementation Pattern**:
```typescript
function getGitUserInfo(): GitUserInfo {
  try {
    const name = execSync('git config user.name', { encoding: 'utf-8' }).trim();
    const email = execSync('git config user.email', { encoding: 'utf-8' }).trim();
    return { name, email };
  } catch (error) {
    // Fallback: system username + placeholder email
    console.warn('Git user.name/email not configured, using fallback');
    return { name: os.userInfo().username, email: `${os.userInfo().username}@localhost` };
  }
}
```

**Error Handling**:
- Git not installed → Catch exception, use fallback (system username)
- Git config not set → Catch exception, use fallback
- Command timeout (>5s) → Catch exception, use fallback
- Always log warnings when fallback is used

---

### 4. Version History Persistence

**Decision**: VS Code Workspace State API (`context.workspaceState.update/get`)

**Rationale**:
- Built-in persistent storage per workspace - no file I/O needed
- Survives extension reloads and VS Code restarts
- Automatic JSON serialization/deserialization
- Atomic updates (no race conditions)
- Per-workspace isolation (multi-root workspaces supported)
- No conflicts with Git or user files

**Alternatives Considered**:
- **Separate JSON file in `.vscode/`**: Manual file I/O overhead, potential conflicts with Git, not atomic, requires error handling for file permissions
- **Git notes**: Complex API, not intended for application metadata, requires Git knowledge, doesn't work in all environments
- **In-memory only**: Lost on extension reload, defeats audit trail purpose, can't survive VS Code restart

**Storage Schema**:
```typescript
interface WorkspaceVersionState {
  schemaVersion: string; // For future migrations
  documents: {
    [documentPath: string]: {
      currentVersion: string;
      owner: string;
      createdBy: string;
      history: VersionHistoryEntry[]; // Max 50 entries (FIFO)
    };
  };
}

interface VersionHistoryEntry {
  previousVersion: string;
  newVersion: string;
  timestamp: string; // ISO 8601
  author: string;
  changeType: 'auto-increment' | 'manual-set' | 'initialization' | 'normalization' | 'reset';
}
```

**Storage Limits**:
- VS Code has no documented hard limit per extension
- Recommendation: Keep under 1MB per extension (current design: ~10KB per document × 100 docs = 1MB max)
- FIFO rotation at 50 entries prevents unbounded growth

**API Example**:
```typescript
const state = context.workspaceState.get<WorkspaceVersionState>('versionHistory', { schemaVersion: '1.0', documents: {} });
state.documents[documentPath] = { currentVersion: '1.1', owner: 'Italo', history: [...] };
await context.workspaceState.update('versionHistory', state);
```

---

### 5. Debounce Implementation

**Decision**: Custom debounce tracker with `Map<documentPath, lastIncrementTimestamp>`

**Rationale**:
- Simple, efficient, zero external dependencies
- Easy to test with fake timers (Vitest `vi.useFakeTimers()`)
- Integrates naturally with file watcher events (event-driven architecture)
- Per-document tracking (independent debounce for each spec)
- Minimal memory overhead (single timestamp per tracked document)

**Alternatives Considered**:
- **lodash.debounce**: External dependency for simple time tracking, over-engineered for single feature, harder to test
- **RxJS throttle/debounce**: Heavy dependency (entire RxJS library), overkill for simple time-based gating
- **No debounce**: Version inflation on rapid saves (rejected per spec clarification)

**Implementation**:
```typescript
class DebounceTracker {
  private readonly DEBOUNCE_MS = 30_000; // 30 seconds
  private lastIncrements = new Map<string, number>(); // documentPath → timestamp
  
  shouldIncrement(documentPath: string): boolean {
    const now = Date.now();
    const last = this.lastIncrements.get(documentPath);
    
    if (!last || (now - last) >= this.DEBOUNCE_MS) {
      this.lastIncrements.set(documentPath, now);
      return true;
    }
    return false;
  }
  
  clear(documentPath: string): void {
    this.lastIncrements.delete(documentPath);
  }
}
```

**Testing Strategy**:
```typescript
describe('DebounceTracker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  
  it('allows increment after 30 seconds', () => {
    const tracker = new DebounceTracker();
    expect(tracker.shouldIncrement('doc.md')).toBe(true); // First call
    expect(tracker.shouldIncrement('doc.md')).toBe(false); // Within 30s
    vi.advanceTimersByTime(30_000);
    expect(tracker.shouldIncrement('doc.md')).toBe(true); // After 30s
  });
});
```

---

## Architectural Patterns

### 1. Post-Processing Hook Pattern

**Pattern**: Event-driven architecture using VS Code file watchers + document save events

**Why this pattern**:
- Non-invasive: Doesn't modify SpecKit template files directly (FR-007 compliance)
- Automatic: Triggered on every document save without user intervention
- Extensible: Easy to add new document types or processing steps
- Testable: Can simulate save events in tests without real file I/O

**Implementation Flow**:
```
User saves document
    ↓
VS Code fires onDidSaveTextDocument event
    ↓
DocumentVersionService.processDocumentSave()
    ↓
Check if SpecKit document (spec.md, plan.md, tasks.md)
    ↓
Check debounce (30s since last increment?)
    ↓
Check if body content changed (exclude frontmatter)
    ↓
Increment version + update owner
    ↓
Write back to file (triggers no new save event - dirty flag prevents loop)
    ↓
Update workspace state (version history)
    ↓
Refresh Spec Explorer tree view
```

**Infinite Loop Prevention**:
```typescript
class DocumentVersionService {
  private processingDocuments = new Set<string>(); // Dirty flag
  
  async processDocumentSave(document: TextDocument): Promise<void> {
    const path = document.uri.fsPath;
    
    // Prevent recursive processing
    if (this.processingDocuments.has(path)) {
      return;
    }
    
    try {
      this.processingDocuments.add(path);
      // ... perform version update ...
    } finally {
      this.processingDocuments.delete(path);
    }
  }
}
```

---

### 2. Service Layer Pattern

**Pattern**: `DocumentVersionService` as facade coordinating specialized components

**Why this pattern**:
- **Single Responsibility Principle**: Each component has one focused responsibility
- **Testability**: Can mock dependencies individually for unit tests
- **Maintainability**: Changes to one component (e.g., version logic) don't affect others
- **Explicit workflow**: Service method makes the workflow clear and auditable

**Component Breakdown**:

```typescript
// Facade (orchestration)
class DocumentVersionService {
  constructor(
    private versionIncrementer: VersionIncrementer,
    private frontmatterProcessor: FrontmatterProcessor,
    private historyManager: VersionHistoryManager,
    private debounceTracker: DebounceTracker,
    private gitUserInfo: GitUserInfoProvider
  ) {}
  
  async processDocumentSave(document: TextDocument): Promise<void> {
    // Orchestrate workflow using injected dependencies
  }
}

// Pure logic (no I/O)
class VersionIncrementer {
  increment(currentVersion: string): string {
    // 1.0 → 1.1, 1.9 → 2.0, etc.
  }
}

// I/O abstraction
class FrontmatterProcessor {
  async extract(documentPath: string): Promise<DocumentMetadata>;
  async update(documentPath: string, metadata: Partial<DocumentMetadata>): Promise<void>;
}

// Persistence abstraction
class VersionHistoryManager {
  async getHistory(documentPath: string): Promise<VersionHistoryEntry[]>;
  async addEntry(documentPath: string, entry: VersionHistoryEntry): Promise<void>;
}

// Time-based logic
class DebounceTracker {
  shouldIncrement(documentPath: string): boolean;
}

// External dependency
class GitUserInfoProvider {
  getUserInfo(): GitUserInfo;
}
```

**Dependency Injection Benefits**:
- Unit tests can mock each dependency independently
- Integration tests can use real implementations
- Easy to swap implementations (e.g., different storage backends)

---

### 3. Error Recovery Strategy

**Pattern**: Graceful degradation with comprehensive logging

**Philosophy**: Version tracking failures should NEVER block document saves or user workflows

**Error Scenarios & Recovery**:

| Scenario | Recovery Action | User Impact | Logging |
|----------|----------------|-------------|---------|
| Git not configured | Use system username + placeholder email | Owner field shows fallback format | WARN: "Git user.name/email not configured, using fallback" |
| Malformed version | Normalize to 1.0 or next valid version | Version corrected automatically | WARN: "Normalized malformed version '1.10' to '2.0'" |
| YAML parsing error | Skip version update for this save | Version not incremented this time | ERROR: "Failed to parse YAML frontmatter in doc.md: [details]" |
| Workspace state full (>50 entries) | Rotate oldest entries (FIFO) | History truncated (50 most recent kept) | INFO: "Rotated version history for doc.md (removed oldest entry)" |
| Infinite save loop detected | Break processing after 3 consecutive saves | Version update skipped | ERROR: "Infinite save loop detected for doc.md, aborting version tracking" |
| File write permission denied | Skip version update, log error | Version not incremented | ERROR: "Permission denied writing to doc.md: [details]" |

**Logging Levels**:
- **INFO**: Normal operations (version incremented, reset command executed)
- **WARN**: Recoverable issues (Git fallback, version normalization)
- **ERROR**: Failed operations (YAML parsing, file I/O errors)

**User Communication**:
- Errors logged to "GatomIA" output channel (visible in Output panel)
- No modal dialogs or notifications (non-intrusive)
- Status bar shows extension status (optional future enhancement)

---

## Implementation Risks & Mitigations

### Risk 1: Infinite Save Loop

**Description**: Save event triggers version update → file write → triggers another save event → infinite loop

**Impact**: High (extension hangs, VS Code may become unresponsive, potential data loss)

**Likelihood**: Medium (easy to introduce if not careful with event handling)

**Mitigation Strategy**:
1. **Dirty flag tracking**: Maintain `Set<string>` of documents currently being processed
2. **Content comparison**: Only update if content actually changed (exclude formatting-only changes)
3. **Recursion depth limit**: Maximum 3 consecutive saves for same document
4. **Event debouncing**: Use VS Code's built-in debouncing + our 30s debounce
5. **Testing**: Integration test simulates rapid saves, verifies no loop

**Code Pattern**:
```typescript
private processingDocuments = new Set<string>();

async processDocumentSave(document: TextDocument): Promise<void> {
  if (this.processingDocuments.has(document.uri.fsPath)) {
    return; // Already processing, skip
  }
  
  this.processingDocuments.add(document.uri.fsPath);
  try {
    // ... process ...
  } finally {
    this.processingDocuments.delete(document.uri.fsPath);
  }
}
```

---

### Risk 2: Race Condition on Rapid Saves

**Description**: User saves document multiple times in quick succession → version increments race → incorrect final version

**Impact**: Medium (version may skip numbers or increment incorrectly)

**Likelihood**: Low (user must save extremely rapidly, <30ms between saves)

**Mitigation Strategy**:
1. **30-second debounce**: Only increment if ≥30s since last increment (per spec)
2. **Atomic workspace state updates**: Use VS Code API (inherently atomic)
3. **Sequential processing**: Process save events sequentially (no parallel processing)
4. **Optimistic locking**: Check current version before writing, retry if changed

**Testing**:
```typescript
it('handles rapid saves correctly', async () => {
  await service.processDocumentSave(doc); // version → 1.1
  await service.processDocumentSave(doc); // skipped (within 30s)
  await service.processDocumentSave(doc); // skipped (within 30s)
  
  expect(await getVersion(doc)).toBe('1.1'); // Only one increment
});
```

---

### Risk 3: Large Workspace Performance Degradation

**Description**: Extension watches 100+ spec documents → high CPU/memory usage → VS Code slows down

**Impact**: Medium (user experience degraded, extension activation slow)

**Likelihood**: Low (most workspaces have <50 specs)

**Mitigation Strategy**:
1. **Targeted file watchers**: Only watch `.specify/` and `specs/` directories (not entire workspace)
2. **Lazy initialization**: Load version history on-demand (not all upfront)
3. **Caching**: Cache parsed frontmatter in memory (invalidate on save)
4. **Throttling**: VS Code's built-in event throttling + our debounce
5. **Performance monitoring**: Log timing for processDocumentSave() calls

**Performance Targets**:
- Extension activation: <500ms (acceptable per VS Code guidelines)
- Save event processing: <100ms overhead (imperceptible)
- Spec Explorer refresh: <1s (acceptable for UI update)

**Load Testing**:
- Test with 100 spec documents × 50 version history entries each
- Measure memory usage (<50MB acceptable)
- Measure CPU usage (<5% idle, <20% during save spike)

---

### Risk 4: SpecKit Template Structure Changes

**Description**: SpecKit updates change template structure (e.g., remove frontmatter) → feature breaks

**Impact**: Low (feature stops working but doesn't cause data loss)

**Likelihood**: Low (templates are stable, backwards compatibility expected)

**Mitigation Strategy**:
1. **Defensive programming**: Handle missing frontmatter gracefully (create if absent)
2. **Fallback behavior**: If no frontmatter, inject at document top
3. **Validation**: Detect corrupted documents (missing title, status fields)
4. **Integration tests**: Simulate template structure changes (remove frontmatter, change field names)
5. **Documentation**: Document required frontmatter structure for SpecKit compatibility

**Error Handling**:
```typescript
if (!parsed.data || !parsed.data.version) {
  // Frontmatter missing or incomplete
  console.warn(`Document ${path} missing frontmatter, initializing version tracking`);
  parsed.data = {
    ...parsed.data, // Preserve any existing fields
    version: '1.0',
    owner: getGitUserInfo()
  };
}
```

---

### Risk 5: Git Not Available in Environment

**Description**: Git CLI not installed or not in PATH → owner field cannot be populated

**Impact**: Low (feature degrades gracefully, uses fallback)

**Likelihood**: Medium (some users may not have Git in Docker containers, CI environments)

**Mitigation Strategy**:
1. **Fallback chain**:
   - Try `git config user.name` / `git config user.email`
   - Fallback to system username (`os.userInfo().username`)
   - Fallback to placeholder email (`username@localhost`)
2. **Clear logging**: WARN level message explaining fallback
3. **Documentation**: Recommend configuring Git for best experience
4. **Validation**: Owner field still populated (just not with Git info)

**Fallback Implementation**:
```typescript
function getGitUserInfo(): GitUserInfo {
  try {
    return {
      name: execSync('git config user.name', { encoding: 'utf-8', timeout: 5000 }).trim(),
      email: execSync('git config user.email', { encoding: 'utf-8', timeout: 5000 }).trim()
    };
  } catch (error) {
    const username = os.userInfo().username;
    console.warn('Git not available, using system username as fallback');
    return { name: username, email: `${username}@localhost` };
  }
}
```

---

## Best Practices Research

### VS Code Extension File Watchers

**Pattern**: Create watchers in `activate()`, dispose in `deactivate()`

```typescript
export function activate(context: ExtensionContext) {
  // Create file watcher
  const watcher = workspace.createFileSystemWatcher('**/*.md');
  
  // Register event handlers
  watcher.onDidChange((uri) => { /* ... */ });
  watcher.onDidCreate((uri) => { /* ... */ });
  watcher.onDidDelete((uri) => { /* ... */ });
  
  // Ensure proper cleanup
  context.subscriptions.push(watcher);
}

export function deactivate() {
  // VS Code automatically disposes subscriptions
}
```

**Glob Patterns**:
- Use specific patterns to reduce event noise: `specs/**/*.md` instead of `**/*.md`
- Combine with programmatic filtering (check if SpecKit document)
- Respect VS Code's file exclude patterns (VS Code handles automatically)

**Performance**:
- VS Code debounces file system events (typically 300ms)
- Add additional debouncing if needed (our 30s debounce)
- Use `workspace.onDidSaveTextDocument` instead of watcher for save events (more efficient)

**Remote Environments**:
- File watchers work transparently in SSH, WSL, Codespaces
- No special handling needed (VS Code abstracts the details)

---

### Workspace State Management

**Storage Limits**:
- No documented hard limit per extension
- Recommendation: Keep under 1MB per extension
- Current design: ~10KB per document × 100 documents = 1MB maximum

**Serialization**:
- Only JSON-serializable types (strings, numbers, booleans, arrays, plain objects)
- No functions, Date objects (use ISO 8601 strings), circular references, undefined values
- Use TypeScript interfaces to enforce serialization constraints

**Schema Versioning**:
```typescript
interface WorkspaceVersionState {
  schemaVersion: string; // "1.0"
  documents: { [path: string]: DocumentState };
}

// Future migration example
async function migrateState(state: any): Promise<WorkspaceVersionState> {
  if (!state.schemaVersion) {
    // Migrate from v0 (no schema version) to v1
    return { schemaVersion: '1.0', documents: state };
  }
  if (state.schemaVersion === '1.0') {
    // Already current version
    return state;
  }
  throw new Error(`Unsupported schema version: ${state.schemaVersion}`);
}
```

**Cleanup Strategy**:
- FIFO rotation at 50 entries per document (prevents unbounded growth)
- Consider pruning deleted documents (no longer exist on disk)
- Add workspace command to clear all version history (for debugging)

---

### YAML Frontmatter Best Practices

**Parsing**:
```typescript
import matter from 'gray-matter';

try {
  const parsed = matter(fileContent, {
    // Strict mode: fail on malformed YAML
    engines: {
      yaml: {
        parse: (str) => yaml.load(str, { json: true })
      }
    }
  });
} catch (error) {
  console.error('Failed to parse YAML frontmatter:', error);
  // Fallback: create new frontmatter
}
```

**Writing**:
```typescript
const updated = matter.stringify(parsed.content, parsed.data, {
  // Preserve original formatting
  excerpt: true,
  excerpt_separator: '---',
  // Custom delimiter if needed
  delimiters: ['---', '---']
});
```

**Validation**:
```typescript
function validateFrontmatter(data: any): boolean {
  // Check required fields
  if (!data.title || !data.status) {
    console.warn('Missing required frontmatter fields');
    return false;
  }
  
  // Validate version format
  if (data.version && !VERSION_PATTERN.test(data.version)) {
    console.warn(`Invalid version format: ${data.version}`);
    return false;
  }
  
  return true;
}
```

**Edge Cases**:
- **Empty frontmatter**: `matter()` returns `{ data: {}, content: '' }`
- **Missing delimiters**: Treat entire file as content (no frontmatter)
- **Unicode characters**: gray-matter handles UTF-8 correctly
- **Multiline strings**: Use YAML block scalars (`|` or `>`)

---

## Conclusion

All technology research is complete. Key decisions:
- **YAML parsing**: gray-matter (battle-tested, TypeScript support)
- **File watching**: VS Code API (built-in, handles remote environments)
- **Git integration**: execSync CLI (simple, zero dependencies)
- **Persistence**: Workspace State API (atomic, per-workspace)
- **Debounce**: Custom Map-based tracker (simple, testable)

All architectural patterns defined:
- **Post-processing hooks**: Event-driven, non-invasive
- **Service layer**: Facade + specialized components (SRP, testability)
- **Error recovery**: Graceful degradation, comprehensive logging

All implementation risks identified and mitigated:
- Infinite save loop → dirty flag tracking
- Race conditions → debounce + atomic updates
- Performance → targeted watchers + lazy loading
- Template changes → defensive programming
- Git unavailable → fallback chain

Ready to proceed to Phase 1: Design & Contracts.
