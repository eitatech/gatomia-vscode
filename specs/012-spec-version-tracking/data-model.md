---
version: "1.0"
owner: "Italo A. G."
---

# Data Model: Automatic Document Version and Author Tracking

**Feature**: 012-spec-version-tracking  
**Date**: 2026-01-29  
**Status**: Design Complete

## Overview

This document defines all data entities, relationships, validation rules, and state transitions for the automatic document version tracking system. All entities are designed to be JSON-serializable for workspace state persistence.

---

## Core Entities

### 1. DocumentMetadata

**Purpose**: Represents version and ownership information for a single SpecKit document

**Storage**: YAML frontmatter in document + workspace state cache

```typescript
interface DocumentMetadata {
  /**
   * Version number in {major}.{minor} format
   * Examples: "1.0", "1.9", "2.0", "2.5"
   * Constraints: major >= 1, minor 0-9 (auto-increment to next major when >9)
   */
  version: string;
  
  /**
   * Owner/author in format "[Name] <[email]>"
   * Examples: "Italo <182202+italoag@users.noreply.github.com>"
   * Represents LAST EDITOR (updated automatically on each version increment)
   * Source: Git user.name + user.email or fallback to system username
   */
  owner: string;
  
  /**
   * ISO 8601 timestamp of last version increment
   * Examples: "2026-01-29T19:45:23.123Z"
   * Used for: Audit trail, debounce calculation
   */
  lastModified?: string;
  
  /**
   * Original document author (immutable after first save)
   * Format: "[Name] <[email]>"
   * Stored: Workspace state only (not in frontmatter)
   * Purpose: Preserve historical attribution even as OWNER changes
   */
  createdBy?: string;
}
```

**Validation Rules**:
```typescript
const VERSION_PATTERN = /^\d+\.\d$/; // {major}.{minor} where minor is single digit

function validateVersion(version: string): boolean {
  if (!VERSION_PATTERN.test(version)) {
    return false;
  }
  
  const [major, minor] = version.split('.').map(Number);
  return major >= 1 && minor >= 0 && minor <= 9;
}

function normalizeVersion(version: string): string {
  // Handle malformed versions
  if (version === '1.10') return '2.0'; // Overflow
  if (version.startsWith('v')) return version.slice(1); // Remove 'v' prefix
  if (!/^\d+\.\d+$/.test(version)) return '1.0'; // Invalid format
  
  const [major, minor] = version.split('.').map(Number);
  if (minor > 9) {
    return `${major + 1}.0`; // Normalize overflow
  }
  if (minor < 0) {
    return `${major}.0`; // Fix negative minor
  }
  
  return `${major}.${minor}`;
}

function validateOwner(owner: string): boolean {
  // Accepts "[Name] <[email]>" or fallback formats
  return owner.length > 0 && owner.includes('<') && owner.includes('>');
}
```

**Relationships**:
- One DocumentMetadata per SpecKit document (1:1)
- Referenced by VersionHistoryEntry.documentPath (1:N)

---

### 2. VersionHistoryEntry

**Purpose**: Represents a point-in-time snapshot of a version change (maximum 50 entries per document with FIFO rotation)

**Storage**: Workspace state only

```typescript
interface VersionHistoryEntry {
  /**
   * Absolute path to the document
   * Example: "/Users/user/project/specs/012-spec-version-tracking/spec.md"
   * Purpose: Primary key for history lookup
   */
  documentPath: string;
  
  /**
   * Version before the change
   * Examples: "1.0" → "1.1", "1.9" → "2.0"
   */
  previousVersion: string;
  
  /**
   * Version after the change
   */
  newVersion: string;
  
  /**
   * ISO 8601 timestamp of the change
   * Example: "2026-01-29T19:45:23.123Z"
   * Timezone: UTC (consistent across all entries)
   */
  timestamp: string;
  
  /**
   * User who made the change
   * Format: "[Name] <[email]>"
   * Source: Git user.name + user.email (same as DocumentMetadata.owner)
   */
  author: string;
  
  /**
   * Type of change for audit purposes
   * - auto-increment: Triggered by save event (most common)
   * - manual-set: User manually edited version field in frontmatter
   * - initialization: First time version tracking enabled for document
   * - normalization: System corrected malformed version
   * - reset: User executed "Reset Document Version" command
   */
  changeType: 'auto-increment' | 'manual-set' | 'initialization' | 'normalization' | 'reset';
}
```

**Validation Rules**:
```typescript
function validateHistoryEntry(entry: VersionHistoryEntry): boolean {
  return (
    entry.documentPath.length > 0 &&
    validateVersion(entry.previousVersion) &&
    validateVersion(entry.newVersion) &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(entry.timestamp) &&
    entry.author.length > 0 &&
    ['auto-increment', 'manual-set', 'initialization', 'normalization', 'reset'].includes(entry.changeType)
  );
}
```

**FIFO Rotation**:
```typescript
function addHistoryEntry(documentPath: string, entry: VersionHistoryEntry): VersionHistoryEntry[] {
  const history = getHistory(documentPath);
  history.push(entry);
  
  // Enforce 50-entry limit with FIFO rotation
  if (history.length > 50) {
    history.shift(); // Remove oldest entry
    console.info(`Rotated version history for ${documentPath} (removed oldest entry)`);
  }
  
  return history;
}
```

**Relationships**:
- Many VersionHistoryEntry per DocumentMetadata (N:1)
- Keyed by documentPath (foreign key to DocumentMetadata)

---

### 3. WorkspaceVersionState

**Purpose**: Top-level container for all version tracking state in workspace

**Storage**: VS Code Workspace State API (`context.workspaceState`)

```typescript
interface WorkspaceVersionState {
  /**
   * Schema version for future migrations
   * Current version: "1.0"
   * Format: Semantic versioning string
   */
  schemaVersion: string;
  
  /**
   * Map of document paths to their version state
   * Key: Absolute file path
   * Value: DocumentState object
   */
  documents: {
    [documentPath: string]: DocumentState;
  };
}

interface DocumentState {
  /**
   * Current version (cached from frontmatter)
   * Synchronized on every save event
   */
  currentVersion: string;
  
  /**
   * Current owner (cached from frontmatter)
   * Updated on every version increment
   */
  owner: string;
  
  /**
   * Original creator (immutable)
   * Set on first version tracking initialization
   */
  createdBy: string;
  
  /**
   * Version change history (max 50 entries, FIFO)
   * Ordered chronologically (oldest first)
   */
  history: VersionHistoryEntry[];
  
  /**
   * Timestamp of last save event processed
   * Used for debounce calculation (30-second window)
   */
  lastIncrementTimestamp?: number; // Unix timestamp (milliseconds)
}
```

**Validation Rules**:
```typescript
function validateWorkspaceState(state: WorkspaceVersionState): boolean {
  if (state.schemaVersion !== '1.0') {
    console.warn(`Unsupported schema version: ${state.schemaVersion}`);
    return false;
  }
  
  for (const [path, docState] of Object.entries(state.documents)) {
    if (!validateVersion(docState.currentVersion)) {
      console.warn(`Invalid version in workspace state for ${path}: ${docState.currentVersion}`);
      return false;
    }
    
    if (docState.history.length > 50) {
      console.warn(`History overflow for ${path}: ${docState.history.length} entries (max 50)`);
      return false;
    }
  }
  
  return true;
}
```

**Migration Strategy** (for future schema changes):
```typescript
async function migrateWorkspaceState(state: any): Promise<WorkspaceVersionState> {
  if (!state.schemaVersion) {
    // Migrate from v0 (no schema version field) to v1.0
    console.info('Migrating workspace state from v0 to v1.0');
    return {
      schemaVersion: '1.0',
      documents: state.documents || {}
    };
  }
  
  if (state.schemaVersion === '1.0') {
    // Current version, no migration needed
    return state;
  }
  
  // Future versions: add migration logic here
  throw new Error(`Unsupported schema version: ${state.schemaVersion}`);
}
```

---

### 4. GitUserInfo

**Purpose**: Represents Git user configuration for author attribution

**Storage**: Transient (fetched on-demand from Git CLI)

```typescript
interface GitUserInfo {
  /**
   * Git user.name from config
   * Example: "Italo"
   * Fallback: os.userInfo().username if Git not configured
   */
  name: string;
  
  /**
   * Git user.email from config
   * Example: "182202+italoag@users.noreply.github.com"
   * Fallback: "[username]@localhost" if Git not configured
   */
  email: string;
}
```

**Extraction Logic**:
```typescript
function getGitUserInfo(): GitUserInfo {
  try {
    const name = execSync('git config user.name', { 
      encoding: 'utf-8', 
      timeout: 5000, 
      stdio: ['pipe', 'pipe', 'ignore'] // Suppress stderr
    }).trim();
    
    const email = execSync('git config user.email', { 
      encoding: 'utf-8', 
      timeout: 5000, 
      stdio: ['pipe', 'pipe', 'ignore']
    }).trim();
    
    if (!name || !email) {
      throw new Error('Git user.name or user.email not configured');
    }
    
    return { name, email };
  } catch (error) {
    console.warn('Git user configuration not available, using fallback');
    const username = os.userInfo().username;
    return {
      name: username,
      email: `${username}@localhost`
    };
  }
}

function formatOwner(gitInfo: GitUserInfo): string {
  return `${gitInfo.name} <${gitInfo.email}>`;
}
```

**Validation Rules**:
```typescript
function validateGitUserInfo(info: GitUserInfo): boolean {
  return (
    info.name.length > 0 &&
    info.email.length > 0 &&
    info.email.includes('@') // Basic email validation
  );
}
```

---

## State Transitions

### Version Increment State Machine

```
┌─────────────┐
│ 1.0 (init)  │  ← Document created, version initialized
└──────┬──────┘
       │ save (body content changed)
       ▼
┌─────────────┐
│ 1.1         │  ← Auto-increment (debounce passed)
└──────┬──────┘
       │ save (body content changed)
       ▼
┌─────────────┐
│ 1.2         │  ← Auto-increment
└──────┬──────┘
       │ ... (more saves)
       ▼
┌─────────────┐
│ 1.9         │  ← Minor version = 9 (max)
└──────┬──────┘
       │ save (body content changed)
       ▼
┌─────────────┐
│ 2.0         │  ← Major version increment (minor overflow)
└──────┬──────┘
       │ save (body content changed)
       ▼
┌─────────────┐
│ 2.1         │  ← Continue in major version 2
└──────┬──────┘
       │ manual edit (user sets version to 5.7)
       ▼
┌─────────────┐
│ 5.7         │  ← Manual version set respected
└──────┬──────┘
       │ save (body content changed)
       ▼
┌─────────────┐
│ 5.8         │  ← Auto-increment continues from manual base
└──────┬──────┘
       │ reset command
       ▼
┌─────────────┐
│ 1.0         │  ← Reset to initial version
└─────────────┘
```

**Transition Triggers**:
- **Automatic increment**: Document save + body content changed + debounce passed (≥30s since last increment)
- **Manual set**: User directly edits version field in frontmatter
- **Normalization**: System detects malformed version (e.g., "1.10") and corrects it
- **Reset**: User executes "SpecKit: Reset Document Version" command

**Blocked Transitions**:
- Version does NOT increment if:
  - Only frontmatter formatting changed (whitespace, field order)
  - Save occurred <30 seconds since last increment (debounce)
  - Document is currently being processed (dirty flag prevents recursion)
  - YAML parsing failed (error logged, skip this save)

---

### Owner Field State Machine

```
┌─────────────────────────────┐
│ Empty (new document)        │  ← Document created
└──────────┬──────────────────┘
           │ first save
           ▼
┌─────────────────────────────┐
│ "Italo <email>" (Git user)  │  ← Populated from Git config
└──────────┬──────────────────┘
           │ version increment by same user
           ▼
┌─────────────────────────────┐
│ "Italo <email>" (unchanged) │  ← Owner persists if same user
└──────────┬──────────────────┘
           │ version increment by different user (different Git config)
           ▼
┌─────────────────────────────┐
│ "Alice <alice@example.com>" │  ← Owner updated to reflect new editor
└─────────────────────────────┘
```

**Update Rules**:
- Owner field is ALWAYS updated on version increment (FR-005)
- Owner reflects the Git user.name + user.email of the person who triggered the save
- If Git not configured, fallback to system username + placeholder email
- Owner update is atomic with version update (same file write operation)

---

### Debounce State Machine

```
┌──────────────────┐
│ Ready            │  ← No recent increment for this document
└────────┬─────────┘
         │ save (version incremented)
         ▼
┌──────────────────┐
│ Locked (30s)     │  ← Debounce window active
└────────┬─────────┘
         │ save within 30s (blocked)
         │
         │ ... (time passes, < 30s)
         │
         │ save within 30s (blocked)
         │
         ▼
┌──────────────────┐
│ Locked (30s)     │  ← Still locked (timer NOT reset by blocked saves)
└────────┬─────────┘
         │ ≥30s elapsed since ORIGINAL increment
         ▼
┌──────────────────┐
│ Ready            │  ← Debounce window expired, next save will increment
└──────────────────┘
```

**Key Behavior**:
- Debounce timer starts on SUCCESSFUL version increment
- Blocked saves do NOT reset the timer (prevents indefinite deferral)
- Timer is per-document (independent debounce for each spec)
- Timer persists across extension reloads (stored in workspace state)

**Implementation**:
```typescript
class DebounceTracker {
  private readonly DEBOUNCE_MS = 30_000; // 30 seconds
  
  shouldIncrement(documentPath: string, lastIncrementTimestamp: number | undefined): boolean {
    const now = Date.now();
    
    if (!lastIncrementTimestamp) {
      return true; // No previous increment
    }
    
    const elapsed = now - lastIncrementTimestamp;
    return elapsed >= this.DEBOUNCE_MS;
  }
}
```

---

## Validation Rules Summary

| Entity | Field | Validation Rule | Error Handling |
|--------|-------|-----------------|----------------|
| DocumentMetadata | version | Matches `/^\d+\.\d$/` (e.g., "1.0", "2.5") | Normalize to 1.0 or next valid version |
| DocumentMetadata | owner | Non-empty, contains `<` and `>` | Use fallback "[username]@localhost" |
| VersionHistoryEntry | previousVersion | Valid version format | Log error, skip history entry |
| VersionHistoryEntry | newVersion | Valid version format | Log error, skip history entry |
| VersionHistoryEntry | timestamp | ISO 8601 format (`YYYY-MM-DDTHH:mm:ss.sssZ`) | Use current timestamp as fallback |
| VersionHistoryEntry | changeType | One of 5 enum values | Default to "auto-increment" |
| WorkspaceVersionState | schemaVersion | Equals "1.0" | Attempt migration or reject |
| DocumentState | history.length | ≤50 entries | FIFO rotation (remove oldest) |
| GitUserInfo | name | Non-empty string | Use `os.userInfo().username` |
| GitUserInfo | email | Contains `@` | Use `${username}@localhost` |

---

## Entity Relationships Diagram

```
┌─────────────────────────────────────────┐
│ WorkspaceVersionState                   │
│ ┌─────────────────────────────────────┐ │
│ │ schemaVersion: "1.0"                │ │
│ │ documents: {                        │ │
│ │   [documentPath]: DocumentState     │ │
│ │ }                                   │ │
│ └─────────────────┬───────────────────┘ │
└───────────────────┼─────────────────────┘
                    │
                    │ 1:N
                    ▼
┌─────────────────────────────────────────┐
│ DocumentState                           │
│ ┌─────────────────────────────────────┐ │
│ │ currentVersion: "1.5"               │ │
│ │ owner: "Italo <email>"              │ │
│ │ createdBy: "Italo <email>"          │ │
│ │ history: VersionHistoryEntry[]      │ │◄───────┐
│ │ lastIncrementTimestamp: 1738191923  │ │        │
│ └─────────────────────────────────────┘ │        │
└─────────────────────────────────────────┘        │
                                                   │
                    ┌──────────────────────────────┘
                    │ 1:N (max 50, FIFO)
                    │
                    ▼
┌─────────────────────────────────────────┐
│ VersionHistoryEntry                     │
│ ┌─────────────────────────────────────┐ │
│ │ documentPath: "/path/to/spec.md"    │ │
│ │ previousVersion: "1.4"              │ │
│ │ newVersion: "1.5"                   │ │
│ │ timestamp: "2026-01-29T19:45:23Z"   │ │
│ │ author: "Italo <email>"             │ │
│ │ changeType: "auto-increment"        │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
                    │
                    │ uses (transient)
                    ▼
┌─────────────────────────────────────────┐
│ GitUserInfo                             │
│ ┌─────────────────────────────────────┐ │
│ │ name: "Italo"                       │ │
│ │ email: "182202+italoag@..."         │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

---

## Storage Strategy

### Frontmatter (in document files)

**Location**: YAML frontmatter at top of `.md` files

**Stored Fields**:
- `version`: Current version string
- `owner`: Current owner/last editor

**Not Stored in Frontmatter**:
- `lastModified`: Workspace state only (avoid frontmatter bloat)
- `createdBy`: Workspace state only (immutable historical record)
- Version history: Workspace state only (too large for frontmatter)

**Example Frontmatter**:
```yaml
---
version: "1.5"
owner: "Italo <182202+italoag@users.noreply.github.com>"
title: "Automatic Document Version Tracking"
status: "draft"
---
```

### Workspace State (persistent cache)

**Location**: VS Code Workspace State API

**Key**: `"documentVersionTracking"`

**Stored Structure**: Full `WorkspaceVersionState` object

**Benefits**:
- Survives extension reloads
- Atomic updates (no race conditions)
- Per-workspace isolation
- No file I/O overhead

### In-Memory Cache (ephemeral)

**Location**: DocumentVersionService class properties

**Cached Data**:
- `processingDocuments: Set<string>` (dirty flag for infinite loop prevention)
- Parsed frontmatter (invalidated on save)

**Invalidation**:
- On document save (re-parse frontmatter)
- On workspace state update (refresh cache)

---

## Testing Strategy

### Unit Tests (data validation)

```typescript
describe('DocumentMetadata validation', () => {
  it('validates correct version formats', () => {
    expect(validateVersion('1.0')).toBe(true);
    expect(validateVersion('2.9')).toBe(true);
  });
  
  it('rejects invalid version formats', () => {
    expect(validateVersion('1.10')).toBe(false); // Overflow
    expect(validateVersion('v1.0')).toBe(false); // Prefix
    expect(validateVersion('abc')).toBe(false); // Non-numeric
  });
  
  it('normalizes malformed versions', () => {
    expect(normalizeVersion('1.10')).toBe('2.0'); // Overflow
    expect(normalizeVersion('v1.0')).toBe('1.0'); // Remove prefix
    expect(normalizeVersion('abc')).toBe('1.0'); // Invalid → default
  });
});

describe('Version increment logic', () => {
  it('increments minor version', () => {
    expect(incrementVersion('1.0')).toBe('1.1');
    expect(incrementVersion('1.5')).toBe('1.6');
  });
  
  it('increments major version on minor overflow', () => {
    expect(incrementVersion('1.9')).toBe('2.0');
    expect(incrementVersion('5.9')).toBe('6.0');
  });
});

describe('FIFO rotation', () => {
  it('removes oldest entry when limit exceeded', () => {
    const history = Array.from({ length: 50 }, (_, i) => createEntry(i));
    const newEntry = createEntry(50);
    
    const updated = addHistoryEntry('doc.md', newEntry, history);
    
    expect(updated.length).toBe(50); // Still at limit
    expect(updated[0].newVersion).toBe('1.1'); // Oldest (0) removed
    expect(updated[49].newVersion).toBe('1.50'); // Newest added
  });
});
```

### Integration Tests (state transitions)

```typescript
describe('Version increment state machine', () => {
  it('transitions from 1.0 to 1.1 on first save', async () => {
    // Setup: Create document with version 1.0
    const doc = await createTestDocument({ version: '1.0' });
    
    // Action: Save document
    await service.processDocumentSave(doc);
    
    // Assert: Version incremented
    const metadata = await getMetadata(doc.uri.fsPath);
    expect(metadata.version).toBe('1.1');
  });
  
  it('respects manual version changes', async () => {
    const doc = await createTestDocument({ version: '1.2' });
    
    // Manually edit version to 5.7
    await updateDocument(doc, { version: '5.7' });
    await service.processDocumentSave(doc);
    
    // Next save should increment from 5.7
    await updateDocument(doc, { content: 'changed' });
    await service.processDocumentSave(doc);
    
    const metadata = await getMetadata(doc.uri.fsPath);
    expect(metadata.version).toBe('5.8');
  });
});
```

---

## Conclusion

Data model design is complete and ready for implementation:
- **4 core entities**: DocumentMetadata, VersionHistoryEntry, WorkspaceVersionState, GitUserInfo
- **Clear validation rules** for all fields with error handling strategies
- **State machines** for version increments, owner updates, and debounce logic
- **FIFO rotation** for history (50-entry limit)
- **Storage strategy**: Frontmatter (version/owner) + Workspace State (history/metadata)
- **Testing approach**: Unit tests (validation) + Integration tests (state transitions)

All entities are JSON-serializable and compatible with VS Code Workspace State API.
