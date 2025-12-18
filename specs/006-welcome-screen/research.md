# Research: Extension Welcome Screen

**Date**: December 16, 2025  
**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

## Purpose

Resolve all technical unknowns before design phase. Document decisions, rationales, and rejected alternatives for each research area.

## Research Areas

### 0. CLI Detection Protocol

**Decision**: Execute version commands with timeouts and parse output using regex patterns. Cache results for 60 seconds.

**CLI Detection Specifications**:

**SpecKit Detection**:
- Command: `specify --version`
- Expected output formats:
  - `SpecKit v1.2.3` (preferred)
  - `specify version 1.2.3`
  - `1.2.3` (plain version)
- Version parsing: Extract first semantic version match using regex `(\d+\.\d+\.\d+)`
- Timeout: 5 seconds
- Error handling:
  - Exit code ≠ 0: Not installed
  - Timeout: Log warning, treat as not installed
  - STDERR output: Ignore unless exit code ≠ 0
  - Invalid version format: Log warning, mark as installed with version "unknown"

**OpenSpec Detection**:
- Command: `openspec --version`
- Expected output formats:
  - `{"version": "1.2.3"}` (JSON format, preferred)
  - `OpenSpec 1.2.3`
  - `1.2.3` (plain version)
- Version parsing:
  - Try JSON parse first, extract `version` field
  - Fallback to regex `(\d+\.\d+\.\d+)` for plain text
- Timeout: 5 seconds
- Error handling: Same as SpecKit

**GitHub Copilot Chat Detection**:
- Method: `vscode.extensions.getExtension('github.copilot-chat')`
- No command execution needed
- Version: Read from extension manifest `extension.packageJSON.version`
- Active check: `extension.isActive` property
- No timeout needed (synchronous API)

**Cache Strategy**:
- Cache key: `{dependency}-{timestamp}`
- TTL: 60 seconds
- Invalidation triggers (see data-model.md):
  - User clicks refresh button
  - Extension restart/reload
  - Workspace folder change
  - Manual install action completed

**Implementation Notes**:
```typescript
async function detectCLI(command: string): Promise<{ installed: boolean; version: string | null }> {
  const timeout = 5000;
  try {
    const { stdout, exitCode } = await execWithTimeout(command, timeout);
    if (exitCode !== 0) return { installed: false, version: null };
    
    // Try JSON parse first (OpenSpec)
    try {
      const json = JSON.parse(stdout);
      if (json.version) return { installed: true, version: json.version };
    } catch {}
    
    // Fallback to regex
    const match = stdout.match(/(\d+\.\d+\.\d+)/);
    return { installed: true, version: match ? match[1] : 'unknown' };
  } catch (error) {
    return { installed: false, version: null };
  }
}
```

---

### 1. Webview Architecture Pattern

**Decision**: Adopt existing DocumentPreviewPanel/HookViewProvider pattern with dedicated WelcomeScreenPanel and WelcomeScreenProvider classes.

**Rationale**:
- Proven pattern in codebase for complex interactive webviews
- DocumentPreviewPanel demonstrates successful message-based lifecycle management
- HookViewProvider shows effective state synchronization between extension and webview
- Separation of concerns: Panel handles webview lifecycle, Provider handles business logic
- Consistent with project architecture conventions

**Alternatives Considered**:
- **Single provider class**: Rejected - violates single responsibility, harder to test
- **Reuse existing panel**: Rejected - welcome screen has distinct lifecycle and state requirements
- **Custom architecture**: Rejected - creates inconsistency, duplicates working patterns

**Implementation Notes**:
- `WelcomeScreenPanel`: Manages webview creation, disposal, message routing
- `WelcomeScreenProvider`: Handles data fetching, state management, command execution
- Message-based communication with ready/postMessage pattern from DocumentPreviewPanel
- Pending message queue for race condition handling

### 2. First-Time Tracking Mechanism

**Decision**: Use VS Code `workspaceState.get/update` API with key `gatomia.welcomeScreen.hasShown` stored per workspace.

**Rationale**:
- Per-workspace tracking allows welcome screen to appear for each new project
- VS Code workspaceState API is designed for this exact use case
- No external storage required, automatically managed by VS Code
- Respects user's "Don't show on startup" preference via separate key
- Clean separation from global extension state

**Alternatives Considered**:
- **globalState**: Rejected - would only show once ever, not appropriate for multi-project usage
- **File-based tracking**: Rejected - adds complexity, filesystem access overhead, cross-platform issues
- **Config file detection**: Rejected - doesn't account for workspaces without config yet, false positives

**Implementation Notes**:
```typescript
// Check first-time status
const hasShown = context.workspaceState.get<boolean>('gatomia.welcomeScreen.hasShown', false);
// Mark as shown
await context.workspaceState.update('gatomia.welcomeScreen.hasShown', true);
// Check user preference
const dontShowAgain = context.workspaceState.get<boolean>('gatomia.welcomeScreen.dontShow', false);
```

### 3. Configuration Editing in Webview

**Decision**: Use VS Code configuration API with webview message passing. Webview sends update requests, extension validates and persists via `workspace.getConfiguration().update()`.

**Rationale**:
- Maintains VS Code's configuration system as source of truth
- Extension host has proper permissions for configuration writes
- Validation and error handling centralized in extension
- Webview remains presentation-focused with no direct VS Code API access
- Follows security best practices for webview interactions

**Alternatives Considered**:
- **Direct config API in webview**: Rejected - webviews don't have access to VS Code configuration API
- **Settings UI redirect**: Rejected - breaks inline editing requirement (FR-007)
- **Custom storage**: Rejected - bypasses VS Code settings, causes sync issues

**Implementation Notes**:
- Webview sends: `{ type: 'welcome/update-setting', payload: { key: 'gatomia.specSystem', value: 'speckit' } }`
- Extension validates allowed settings (spec system, paths)
- Extension calls: `workspace.getConfiguration('gatomia').update(key, value, ConfigurationTarget.Workspace)`
- Extension broadcasts updated config back to webview for UI refresh

### 4. Dependency Detection Strategy

**Decision**: Multi-layered detection using VS Code Extension API + command execution for CLI tools.

**Rationale**:
- VS Code extensions API provides reliable extension detection
- CLI detection via command execution is standard practice
- Caching results prevents repeated expensive checks
- Graceful degradation when detection fails
- Actionable results for each dependency type

**Alternatives Considered**:
- **File system scanning**: Rejected - unreliable, platform-dependent paths, permission issues
- **Network API calls**: Rejected - adds latency, requires connectivity, privacy concerns
- **Manual user input**: Rejected - poor UX, error-prone, doesn't meet auto-detection requirement

**Implementation Notes**:

**GitHub Copilot Chat Detection**:
```typescript
const copilotExtension = vscode.extensions.getExtension('GitHub.copilot-chat');
const isInstalled = copilotExtension !== undefined;
const isActive = copilotExtension?.isActive ?? false;
```

**SpecKit CLI Detection**:
```typescript
// Execute: specify --version
// Success + version output = installed
// Error = not installed
const result = await exec('specify --version');
```

**OpenSpec CLI Detection**:
```typescript
// Execute: openspec --version
// Parse version from output
const result = await exec('openspec --version');
```

**Caching Strategy**:
- Cache results for 60 seconds to avoid repeated subprocess spawns
- Invalidate cache on install button clicks
- Refresh on welcome screen activation

### 5. Error/Warning Display

**Decision**: Implement diagnostic collector service that monitors OutputChannel writes and stores last 5 errors with timestamps. Query on welcome screen load.

**Rationale**:
- 24-hour window + 5-error limit balances usefulness with UI space
- Timestamp-based filtering automatically cleans old entries
- OutputChannel is already used throughout extension for logging
- No new logging infrastructure needed
- Diagnostic data structured for actionable display

**Alternatives Considered**:
- **VS Code diagnostic API**: Rejected - designed for document problems, not extension errors
- **Unlimited history**: Rejected - memory overhead, overwhelming UI
- **Session-only errors**: Rejected - misses issues from previous sessions that might recur
- **Manual error reporting**: Rejected - requires code changes throughout codebase

**Implementation Notes**:
```typescript
interface DiagnosticEntry {
  timestamp: number;
  severity: 'error' | 'warning';
  message: string;
  source: string;
  suggestedAction?: string;
}

class SystemDiagnostics {
  private entries: DiagnosticEntry[] = [];
  
  recordError(message: string, source: string, action?: string): void {
    this.entries.push({
      timestamp: Date.now(),
      severity: 'error',
      message,
      source,
      suggestedAction: action
    });
    this.cleanup();
  }
  
  getRecentDiagnostics(): DiagnosticEntry[] {
    const cutoff = Date.now() - (24 * 60 * 60 * 1000); // 24 hours
    return this.entries
      .filter(e => e.timestamp > cutoff)
      .slice(-5); // Last 5
  }
  
  private cleanup(): void {
    const cutoff = Date.now() - (24 * 60 * 60 * 1000);
    this.entries = this.entries.filter(e => e.timestamp > cutoff);
  }
}
```

### 6. Section Layout & Styling

**Decision**: Vertical scrolling layout with collapsible sections, CSS Grid for internal layouts, VS Code theme variables for colors.

**Rationale**:
- Vertical scroll is standard for long-form content in VS Code
- Collapsible sections allow users to focus on relevant content
- CSS Grid provides flexible, responsive layouts without complex frameworks
- VS Code theme variables ensure automatic light/dark mode support
- Matches VS Code's native UX patterns for consistency

**Alternatives Considered**:
- **Tab-based navigation**: Rejected - requires extra click to access content, hides information
- **Horizontal scroll**: Rejected - poor UX on smaller screens, uncommon in VS Code
- **Fixed height sections**: Rejected - content may be cut off, poor accessibility
- **Custom theming**: Rejected - breaks with VS Code themes, maintenance burden

**Implementation Notes**:
- Order: Setup → Features → Configuration → Status → Learning (per FR-009)
- Each section: `<section>` with h2 heading, optional expand/collapse button
- Internal grids: `display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr))`
- Colors: `var(--vscode-foreground)`, `var(--vscode-button-background)`, etc.
- Smooth transitions for collapse animations

### 7. Learning Resources Structure

**Decision**: Hardcoded JSON structure in extension with categories (Beginner, Intermediate, Advanced) mapping to external documentation URLs.

**Rationale**:
- Documentation links are relatively stable, don't require dynamic updates
- Hardcoded in extension allows offline access to link structure
- JSON structure easy to maintain and extend
- Avoids network dependency for resource list
- Can be updated with extension versions

**Alternatives Considered**:
- **Remote API fetch**: Rejected - adds network dependency, latency, complexity
- **Markdown files in repo**: Rejected - requires parsing, more complex than needed
- **User-editable config**: Rejected - out of scope, most users won't customize
- **Dynamic discovery**: Rejected - documentation doesn't change frequently enough to justify

**Implementation Notes**:
```typescript
interface LearningResource {
  title: string;
  description: string;
  url: string;
  category: 'Beginner' | 'Intermediate' | 'Advanced';
  keywords: string[];
}

const LEARNING_RESOURCES: LearningResource[] = [
  {
    title: 'Getting Started with SpecKit',
    description: 'Learn how to create your first specification',
    url: 'https://github.com/github/spec-kit/blob/main/README.md',
    category: 'Beginner',
    keywords: ['speckit', 'getting started', 'spec', 'create']
  },
  // ... more resources
];
```

### 8. Installation Action Behavior

**Decision**: For extensions, use `vscode.commands.executeCommand('workbench.extensions.search', '@id github.copilot-chat')`. For CLIs, copy install command to clipboard and show notification.

**Rationale**:
- VS Code provides built-in command to open Extensions marketplace to specific extension
- Clipboard API available in VS Code, familiar UX pattern
- Automatic extension installation requires elevated permissions, not recommended
- CLI installation varies by platform/package manager, user should control
- Copy+notification pattern is common in developer tools

**Alternatives Considered**:
- **Automatic installation**: Rejected - security concern, requires user consent, can fail silently
- **Open external browser**: Rejected - takes user out of VS Code, breaks flow
- **Terminal commands**: Rejected - assumes terminal setup, platform-specific
- **Text-only instructions**: Rejected - less convenient, higher friction

**Implementation Notes**:
```typescript
// GitHub Copilot Chat install
await vscode.commands.executeCommand(
  'workbench.extensions.search',
  '@id github.copilot-chat'
);

// SpecKit CLI install
await vscode.env.clipboard.writeText('uv tool install specify-cli --from git+https://github.com/github/spec-kit.git');
vscode.window.showInformationMessage(
  'SpecKit install command copied to clipboard. Paste in terminal to install.',
  'Open Terminal'
).then(selection => {
  if (selection === 'Open Terminal') {
    vscode.commands.executeCommand('workbench.action.terminal.new');
  }
});
```

## Summary of Decisions

| Area | Decision | Key Benefit |
|------|----------|-------------|
| Architecture | Panel + Provider pattern | Consistency with codebase |
| First-time tracking | workspaceState API | Per-workspace behavior |
| Configuration | Message-based updates | Security & validation |
| Dependency detection | Extension API + CLI exec | Reliable + actionable |
| Error display | 5 errors, 24-hour window | Useful without overwhelm |
| Layout | Vertical scroll, collapsible sections | Familiar VS Code UX |
| Learning resources | Hardcoded JSON | Simple, offline-capable |
| Installation actions | Marketplace + clipboard | Safe, user-controlled |

## Open Questions

None - all technical unknowns resolved.

## Next Steps

Proceed to Phase 1: Create data-model.md, contracts/, and quickstart.md with concrete designs based on these research findings.
