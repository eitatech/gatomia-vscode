# Message Contracts: Welcome Screen

**Date**: December 16, 2025  
**Feature**: [spec.md](../spec.md) | **Plan**: [../plan.md](../plan.md) | **Data Model**: [../data-model.md](../data-model.md)

## Purpose

Define all message contracts for bidirectional communication between the extension host and the welcome screen webview. These contracts ensure type safety and clear API boundaries.

## Message Flow Overview

```
Extension Host              Webview
      |                        |
      |--[welcome/init]------->|  1. Send initial state
      |                        |
      |<--[welcome/ready]------|  2. Webview loaded, ready for updates
      |                        |
      |--[welcome/state]------>|  3. Send complete state
      |                        |
      |<--[welcome/action]-----|  4. User interaction
      |                        |
      |--[welcome/update]----->|  5. State change notification
      |                        |
```

## Extension → Webview Messages

### `welcome/init`

Initial message sent when webview is created, before ready signal.

**Payload**:
```typescript
{
  extensionVersion: string;
  vscodeVersion: string;
}
```

**Purpose**: Provide version context for display.

**When Sent**: Immediately after webview HTML is set.

---

### `welcome/state`

Complete welcome screen state update.

**Payload**:
```typescript
{
  hasShownBefore: boolean;
  dontShowOnStartup: boolean;
  currentView: 'setup' | 'features' | 'configuration' | 'status' | 'learning';
  dependencies: {
    copilotChat: {
      installed: boolean;
      active: boolean;
      version: string | null;
    };
    speckit: {
      installed: boolean;
      version: string | null;
    };
    openspec: {
      installed: boolean;
      version: string | null;
    };
    lastChecked: number; // Unix timestamp
  };
  configuration: {
    specSystem: {
      key: string;
      label: string;
      currentValue: 'auto' | 'speckit' | 'openspec';
      options: string[];
      editable: boolean;
    };
    speckitSpecsPath: {
      key: string;
      label: string;
      currentValue: string;
      editable: boolean;
    };
    speckitMemoryPath: {
      key: string;
      label: string;
      currentValue: string;
      editable: boolean;
    };
    speckitTemplatesPath: {
      key: string;
      label: string;
      currentValue: string;
      editable: boolean;
    };
    openspecPath: {
      key: string;
      label: string;
      currentValue: string;
      editable: boolean;
    };
    promptsPath: {
      key: string;
      label: string;
      currentValue: string;
      editable: boolean;
    };
    otherSettings: Array<{
      key: string;
      label: string;
      currentValue: string | boolean;
      editable: false;
    }>;
  };
  diagnostics: Array<{
    id: string;
    timestamp: number;
    severity: 'error' | 'warning';
    message: string;
    source: string;
    suggestedAction: string | null;
  }>;
  learningResources: Array<{
    id: string;
    title: string;
    description: string;
    url: string;
    category: 'Getting Started' | 'Advanced Features' | 'Troubleshooting';
    keywords: string[];
    estimatedMinutes: number | null;
  }>;
  featureActions: Array<{
    id: string;
    featureArea: 'Specs' | 'Prompts' | 'Hooks' | 'Steering';
    label: string;
    description: string;
    commandId: string;
    enabled: boolean;
  }>;
}
```

**Purpose**: Provide all data needed to render welcome screen.

**When Sent**:
- After `welcome/ready` received from webview
- After configuration changes
- After dependency status updates

---

### `welcome/config-updated`

Notification that a single configuration value changed.

**Payload**:
```typescript
{
  key: string;
  newValue: string | boolean;
}
```

**Purpose**: Incremental update to avoid resending full state.

**When Sent**: After user edits configuration and change is persisted.

---

### `welcome/dependency-status`

Updated dependency detection results.

**Payload**:
```typescript
{
  copilotChat: {
    installed: boolean;
    active: boolean;
    version: string | null;
  };
  speckit: {
    installed: boolean;
    version: string | null;
  };
  openspec: {
    installed: boolean;
    version: string | null;
  };
  lastChecked: number;
}
```

**Purpose**: Refresh dependency status after install actions.

**When Sent**:
- After install button clicked and detection re-run
- On manual refresh request

---

### `welcome/diagnostic-added`

New error or warning logged.

**Payload**:
```typescript
{
  diagnostic: {
    id: string;
    timestamp: number;
    severity: 'error' | 'warning';
    message: string;
    source: string;
    suggestedAction: string | null;
  };
}
```

**Purpose**: Real-time diagnostic updates while welcome screen is open.

**When Sent**: When error logged and welcome screen is active.

---

## Webview → Extension Messages

### `welcome/ready`

Signal that webview is loaded and ready to receive state.

**Payload**: `null` or `{}`

**Purpose**: Handshake to ensure messages sent after webview is initialized.

**When Sent**: On webview mount, before rendering.

**Extension Response**: Sends `welcome/state` message.

---

### `welcome/execute-command`

Request to execute a VS Code command (feature action).

**Payload**:
```typescript
{
  commandId: string;
  args?: any[];
}
```

**Purpose**: Trigger feature actions like "Create New Spec".

**When Sent**: User clicks feature action button.

**Extension Response**: Execute command via `vscode.commands.executeCommand()`.

**Error Handling**: If command fails, show error message in VS Code.

---

### `welcome/update-config`

Request to update a configuration value.

**Payload**:
```typescript
{
  key: string;
  value: string | boolean;
}
```

**Purpose**: Persist user configuration changes.

**When Sent**: User edits editable configuration item.

**Extension Response**:
1. Validate key is editable (spec system related)
2. Validate value is appropriate for key type
3. Persist via `workspace.getConfiguration('gatomia').update(key, value)`
4. Send `welcome/config-updated` confirmation or error

**Error Handling**: If validation fails, send error message back to webview.

**Validation Rules**:
- `key` must start with `gatomia.`
- `key` must be in allowed editable list (specSystem, paths)
- `value` type must match expected type for key

---

### `welcome/install-dependency`

Request to initiate dependency installation.

**Payload**:
```typescript
{
  dependency: 'copilot-chat' | 'speckit' | 'openspec';
}
```

**Purpose**: Trigger installation helpers.

**When Sent**: User clicks install button for missing dependency.

**Extension Response**:
- `copilot-chat`: Execute `workbench.extensions.search @id github.copilot-chat`
- `speckit`: Copy `uv tool install specify-cli --from git+https://github.com/github/spec-kit.git` to clipboard, show notification
- `openspec`: Copy `npm install -g @fission-ai/openspec@latest` to clipboard, show notification

---

### `welcome/refresh-dependencies`

Request to re-check dependency installation status.

**Payload**: `null` or `{}`

**Purpose**: Manual refresh after user installs dependency outside VS Code.

**When Sent**: User clicks "Refresh" button in setup section.

**Extension Response**:
1. Invalidate dependency cache
2. Re-run detection for all dependencies
3. Send `welcome/dependency-status` with updated results

---

### `welcome/update-preference`

Update welcome screen display preferences.

**Payload**:
```typescript
{
  preference: 'dontShowOnStartup';
  value: boolean;
}
```

**Purpose**: Save user preference to suppress automatic welcome screen.

**When Sent**: User toggles "Don't show on startup" checkbox.

**Extension Response**:
1. Update `workspaceState.update('gatomia.welcomeScreen.dontShow', value)`
2. Acknowledge with success (optional)

---

### `welcome/open-external`

Request to open external URL.

**Payload**:
```typescript
{
  url: string;
}
```

**Purpose**: Open documentation or learning resources in browser.

**When Sent**: User clicks learning resource link.

**Extension Response**: Execute `vscode.env.openExternal(vscode.Uri.parse(url))`.

**Validation**: Ensure URL is HTTPS.

---

### `welcome/navigate-section`

Report section navigation for analytics (optional).

**Payload**:
```typescript
{
  section: 'setup' | 'features' | 'configuration' | 'status' | 'learning';
}
```

**Purpose**: Track which sections users visit (for future UX improvements).

**When Sent**: User navigates to a section (click or scroll).

**Extension Response**: Log for telemetry (if implemented).

---

### `welcome/search-resources`

Search learning resources by keyword.

**Payload**:
```typescript
{
  query: string;
}
```

**Purpose**: Filter learning resources in real-time.

**When Sent**: User types in search box.

**Extension Response**: Filter `learningResources` array by matching keywords or title/description, return filtered list.

---

## Error Messages

### Extension → Webview Error

**Message Type**: `welcome/error`

**Payload**:
```typescript
{
  code: string;
  message: string;
  context?: string;
}
```

**Error Codes**:
- `CONFIG_UPDATE_FAILED`: Configuration update failed
- `INVALID_CONFIG_KEY`: Configuration key not editable
- `INVALID_CONFIG_VALUE`: Value invalid for configuration key
- `COMMAND_EXECUTION_FAILED`: VS Code command failed
- `DEPENDENCY_CHECK_FAILED`: Dependency detection error

**When Sent**: Any operation failure.

**Webview Response**: Display user-friendly error message.

---

## Message Sequence Examples

### Example 1: First-Time Welcome Screen Display

```
Extension                          Webview
    |                                 |
    |-- welcome/init ---------------->|
    |                                 |
    |<-- welcome/ready ---------------|
    |                                 |
    |-- welcome/state --------------->| (Render UI)
    |                                 |
```

### Example 2: User Updates Configuration

```
Extension                          Webview
    |                                 |
    |<-- welcome/update-config -------|
    |    (key: specSystem,            |
    |     value: 'speckit')           |
    |                                 |
    | [Validate & Persist]            |
    |                                 |
    |-- welcome/config-updated ------>|
    |    (key: specSystem,            |
    |     newValue: 'speckit')        | (Update UI)
    |                                 |
```

### Example 3: Install GitHub Copilot Chat

```
Extension                          Webview
    |                                 |
    |<-- welcome/install-dependency --|
    |    (dependency: copilot-chat)   |
    |                                 |
    | [Open Extensions Marketplace]   |
    |                                 |
    | [User installs extension]       |
    |                                 |
    |<-- welcome/refresh-dependencies-|
    |                                 |
    | [Re-check dependencies]         |
    |                                 |
    |-- welcome/dependency-status --->| (Show success)
    |                                 |
```

### Example 4: Error Handling

```
Extension                          Webview
    |                                 |
    |<-- welcome/update-config -------|
    |    (key: invalid.key)           |
    |                                 |
    | [Validation fails]              |
    |                                 |
    |-- welcome/error ---------------->|
    |    (code: INVALID_CONFIG_KEY)   | (Show error)
    |                                 |
```

## Type Safety

All message contracts will be defined as TypeScript interfaces in:
- `src/types/welcome.ts` (extension host)
- `ui/src/features/welcome/types.ts` (webview)

Shared types should be kept in sync manually or via code generation.

## Versioning

Message contracts are versioned with the extension. Breaking changes require:
1. Major version bump
2. Migration path for stored state
3. Backward compatibility shims if possible

## Next Steps

Proceed to create [quickstart.md](../quickstart.md) with developer guide for implementing welcome screen.
