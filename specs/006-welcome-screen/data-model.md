# Data Model: Extension Welcome Screen

**Date**: December 16, 2025  
**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Research**: [research.md](research.md)

## Purpose

Define all entities, their attributes, relationships, validation rules, and state transitions for the welcome screen feature. This is a conceptual model independent of implementation technology.

## Core Entities

### WelcomeScreenState

Represents the complete state of the welcome screen interface.

**Attributes**:
- `hasShownBefore`: boolean - Whether welcome screen has been displayed in current workspace
- `dontShowOnStartup`: boolean - User preference to suppress automatic display
- `currentView`: 'setup' | 'features' | 'configuration' | 'status' | 'learning' - Active section being viewed
- `collapsedSections`: string[] - List of section IDs that are collapsed
- `lastChecked`: timestamp - When dependency/status checks were last performed

**Relationships**:
- Contains one DependencyStatus
- Contains one SystemHealth
- Contains one ConfigurationState
- Contains multiple LearningResource entities

**Validation Rules**:
- `hasShownBefore` defaults to false for new workspaces
- `dontShowOnStartup` can be toggled by user, persists across sessions
- `lastChecked` must be valid ISO 8601 timestamp or null

**State Transitions**:
- New workspace: `hasShownBefore: false` → User closes welcome: `hasShownBefore: true`
- User toggles "Don't show on startup": `dontShowOnStartup: false ↔ true`
- Section collapse: Add/remove section ID from `collapsedSections`

---

### DependencyStatus

Represents installation and health status of required and optional dependencies.

**Attributes**:
- `copilotChatInstalled`: boolean - GitHub Copilot Chat extension present
- `copilotChatActive`: boolean - Extension is activated (not just installed)
- `copilotChatVersion`: string | null - Extension version if available
- `speckitInstalled`: boolean - SpecKit CLI available on PATH
- `speckitVersion`: string | null - CLI version output
- `openspecInstalled`: boolean - OpenSpec CLI available on PATH
- `openspecVersion`: string | null - CLI version output
- `lastChecked`: timestamp - When detection was last run
- `cacheInvalidation`: Cache is invalidated and detection re-runs on: (1) User clicks refresh button, (2) Extension restart/reload, (3) Workspace folder change, (4) 60 seconds elapsed since lastChecked, (5) Manual install dependency action completed

**Relationships**:
- Owned by WelcomeScreenState (1:1)

**Validation Rules**:
- If `copilotChat.installed: false`, then `copilotChat.active` must be false
- If not installed, version should be null
- `lastChecked` updated whenever detection runs
- Nested structure must match contracts/messages.md for consistency

**State Transitions**:
- Initial state: All booleans false, versions null
- After detection: Update based on actual system state
- Install action triggered: Mark for re-check after timeout

---

### ConfigurationItem

Represents a single configurable setting that can be edited from welcome screen.

**Attributes**:
- `key`: string - Full configuration key (e.g., 'gatomia.specSystem')
- `label`: string - Human-readable name
- `description`: string - Explanation of setting purpose
- `currentValue`: string | boolean - Current value from VS Code config
- `valueType`: 'enum' | 'string' | 'boolean' - Type of value
- `options`: string[] | null - Valid options for enum types
- `editable`: boolean - Whether user can edit from welcome screen
- `category`: 'spec-system' | 'paths' | 'other' - Setting category

**Relationships**:
- Grouped in ConfigurationState

**Validation Rules**:
- `key` must match pattern `gatomia.*`
- If `valueType: 'enum'`, `options` cannot be null/empty
- If `editable: true`, must be in spec-system or paths category
- `currentValue` must be valid for `valueType`
- **Path configurations** (keys ending in `Path` or `path`) must satisfy:
  - Absolute path (starting with `/` on Unix or drive letter on Windows) OR workspace-relative (starting with `./` or `../`)
  - No special characters except `/`, `\`, `.`, `-`, `_`, and alphanumerics
  - Parent directory should exist (create if missing is acceptable)
  - Must be writable by current user (verify with fs.access)
  - Maximum length 500 characters

**State Transitions**:
- User edits: `currentValue` updates → Persist to VS Code config → Refresh UI
- Config changed externally: Reload `currentValue` from VS Code config

---

### ConfigurationState

Aggregates all configuration items displayed in welcome screen.

**Attributes**:
- `specSystem`: ConfigurationItem - Current spec system selection (auto/speckit/openspec)
- `speckitSpecsPath`: ConfigurationItem - Path to SpecKit specs
- `speckitMemoryPath`: ConfigurationItem - Path to SpecKit memory
- `speckitTemplatesPath`: ConfigurationItem - Path to SpecKit templates
- `openspecPath`: ConfigurationItem - Path to OpenSpec directory
- `promptsPath`: ConfigurationItem - Path to prompts directory
- `otherSettings`: ConfigurationItem[] - Non-editable settings for display only

**Relationships**:
- Owned by WelcomeScreenState (1:1)
- Contains multiple ConfigurationItem entities

**Validation Rules**:
- Spec system related items (`specSystem`, `speckitSpecsPath`, etc.) must have `editable: true`
- Other settings must have `editable: false`

**State Transitions**:
- On load: Populate from VS Code configuration API
- On user edit: Update specific ConfigurationItem → Persist → Broadcast change
- On external config change: Reload all ConfigurationItem values

---

### SystemDiagnostic

Represents an error or warning from extension operations.

**Attributes**:
- `id`: string - Unique identifier for this diagnostic
- `timestamp`: number - Unix epoch milliseconds when error occurred
- `severity`: 'error' | 'warning' - Importance level
- `message`: string - Human-readable error description
- `source`: string - Which component generated the error (e.g., 'SpecExplorer', 'HookExecutor')
- `suggestedAction`: string | null - Actionable fix description

**Relationships**:
- Collected in SystemHealth (1:many)

**Validation Rules**:
- `timestamp` must be within past 24 hours to display
- `message` must not be empty
- `source` should match known extension components

**State Transitions**:
- Created when error logged: Capture details with timestamp
- Aged out: Remove when timestamp exceeds 24 hours
- Trimmed: Keep only most recent 5 entries

---

### SystemHealth

Aggregates diagnostics and extension health information.

**Attributes**:
- `extensionVersion`: string - Current GatomIA version
- `vscodeVersion`: string - VS Code version
- `recentDiagnostics`: SystemDiagnostic[] - Last 5 errors/warnings from past 24h
- `lastUpdated`: timestamp - When diagnostics were last collected

**Relationships**:
- Owned by WelcomeScreenState (1:1)
- Contains multiple SystemDiagnostic entities

**Validation Rules**:
- `recentDiagnostics` limited to 5 most recent entries
- Only diagnostics from past 24 hours included
- `extensionVersion` matches package.json version

**State Transitions**:
- On welcome screen load: Collect diagnostics from past 24h
- New error occurs: Add to `recentDiagnostics`, trim to 5 if needed
- 24h timeout: Remove old entries automatically

---

### LearningResource

Represents a documentation link or tutorial.

**Attributes**:
- `id`: string - Unique identifier
- `title`: string - Display name
- `description`: string - Brief explanation of content
- `url`: string - External link to documentation
- `category`: 'Getting Started' | 'Advanced Features' | 'Troubleshooting' - Organization category
- `keywords`: string[] - Searchable terms
- `estimatedMinutes`: number | null - Time to complete (for tutorials)

**Relationships**:
- Listed in WelcomeScreenState (1:many)

**Validation Rules**:
- `url` must be valid HTTPS URL
- `keywords` should be lowercase for case-insensitive search
- `estimatedMinutes` null for documentation (not tutorials)

**State Transitions**:
- Static data: Loaded from hardcoded JSON, no runtime changes
- User filters: List filtered by category or keyword match

---

### FeatureAction

Represents an actionable item in the Features section.

**Attributes**:
- `id`: string - Unique identifier
- `featureArea`: 'Specs' | 'Prompts' | 'Hooks' | 'Steering' - Which feature this belongs to
- `label`: string - Button text
- `description`: string - Explanation of what action does
- `commandId`: string - VS Code command to execute
- `icon`: string | null - Optional icon identifier
- `enabled`: boolean - Whether action is currently available

**Relationships**:
- Grouped by featureArea in UI

**Validation Rules**:
- `commandId` must match registered VS Code command
- `label` should be concise (≤50 characters)

**State Transitions**:
- User clicks: Execute `commandId` via VS Code API
- Command unavailable: Set `enabled: false` and disable button

---

## Entity Relationships Diagram

```
WelcomeScreenState (root)
├── DependencyStatus (1:1)
├── ConfigurationState (1:1)
│   ├── specSystem (ConfigurationItem)
│   ├── speckitSpecsPath (ConfigurationItem)
│   ├── speckitMemoryPath (ConfigurationItem)
│   ├── speckitTemplatesPath (ConfigurationItem)
│   ├── openspecPath (ConfigurationItem)
│   ├── promptsPath (ConfigurationItem)
│   └── otherSettings (ConfigurationItem[])
├── SystemHealth (1:1)
│   └── recentDiagnostics (SystemDiagnostic[])
├── learningResources (LearningResource[])
└── featureActions (FeatureAction[])
```

## Data Flow

### On Welcome Screen Activation

1. Check `workspaceState.get('gatomia.welcomeScreen.hasShownBefore')` → Set `WelcomeScreenState.hasShownBefore`
2. Check `workspaceState.get('gatomia.welcomeScreen.dontShow')` → Set `WelcomeScreenState.dontShowOnStartup`
3. Initialize `DependencyStatus`: Run detection for Copilot Chat, SpecKit CLI, OpenSpec CLI
4. Initialize `ConfigurationState`: Load all ConfigurationItem values from VS Code config
5. Initialize `SystemHealth`: Collect SystemDiagnostic entries from past 24 hours
6. Load static `LearningResource` array from hardcoded JSON
7. Load static `FeatureAction` array
8. Send complete `WelcomeScreenState` to webview

### On User Configuration Edit

1. Webview sends update message with key and new value
2. Extension validates: Is key editable? Is value valid for type?
3. Extension persists: `workspace.getConfiguration('gatomia').update(key, value)`
4. Extension reloads: Fetch updated value from config
5. Extension broadcasts: Send updated `ConfigurationItem` to webview
6. Webview updates: Refresh UI with new value

### On Dependency Install Action

1. User clicks "Install GitHub Copilot Chat"
2. Extension executes: `vscode.commands.executeCommand('workbench.extensions.search', '@id github.copilot-chat')`
3. User completes installation in VS Code
4. User returns to welcome screen → Trigger dependency re-check
5. Update `DependencyStatus` with new state → Send to webview

### On Error Logged

1. Extension operation fails, logs error via OutputChannel
2. `SystemDiagnostics` service captures: message, source, timestamp, severity
3. Add to `SystemHealth.recentDiagnostics` array
4. Trim array to 5 most recent entries
5. Remove entries older than 24 hours
6. If welcome screen is open: Broadcast updated `SystemHealth` to webview

## Persistence

- **Workspace State**: `hasShownBefore`, `dontShowOnStartup` → VS Code workspaceState API
- **Configuration**: All `ConfigurationItem` values → VS Code configuration API
- **Diagnostics**: `SystemDiagnostic` → In-memory with 24-hour TTL, no persistence
- **Learning Resources**: Hardcoded JSON, no persistence
- **Dependency Status**: Transient, re-checked on demand, 60-second cache

## Performance Considerations

- **Lazy Loading**: Don't run expensive checks (CLI detection) until welcome screen opens
- **Caching**: Cache dependency detection for 60 seconds to avoid repeated subprocess spawns
- **Throttling**: Debounce configuration changes (300ms) to avoid excessive persistence
- **Batch Updates**: Send complete state on load, incremental updates for changes

## Next Steps

Proceed to define message contracts for extension ↔ webview communication in [contracts/](./contracts/).
