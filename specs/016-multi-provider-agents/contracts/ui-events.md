# UI Event Contract

**Version**: 1.0  
**Feature**: 016-multi-provider-agents  
**Date**: 2025-07-14

---

## Overview

Defines the message-passing contract between the VS Code extension host and the Cloud Agents webview panel, as well as the tree view command interface.

---

## Tree View Commands

Commands exposed via VS Code command palette and tree view context menu.

### Provider Selection Commands

| Command | ID | Arguments | Description |
|---------|-----|-----------|-------------|
| Select Provider | `gatomia.selectProvider` | `providerId: string` | Opens provider selection or directly selects if arg provided |
| Change Provider | `gatomia.changeProvider` | None | Clears active provider, shows welcome content |
| Configure Provider | `gatomia.configureProvider` | `providerId?: string` | Configures credentials for active or specified provider |

### Session Commands

| Command | ID | Arguments | Description |
|---------|-----|-----------|-------------|
| Refresh Sessions | `gatomia.refreshSessions` | None | Manually triggers a poll cycle |
| Cancel Session | `gatomia.cancelSession` | `localId: string` | Cancels a running session |
| Open External | `gatomia.openExternal` | `localId: string` | Opens session in provider's external UI |
| Open Pull Request | `gatomia.openPr` | `prUrl: string` | Opens a PR URL |
| Dispatch Task | `gatomia.dispatchTask` | `specTaskId: string, specPath: string` | Dispatches a spec task to active provider |

### Context Menu Items

```typescript
// Session tree item context
interface SessionTreeItemContext {
  command: 'gatomia.cancelSession' | 'gatomia.openExternal';
  when: 'view == gatomia.views.cloudAgents && viewItem == session.running';
}

// PR tree item context
interface PrTreeItemContext {
  command: 'gatomia.openPr';
  when: 'view == gatomia.views.cloudAgents && viewItem == pullRequest';
}
```

---

## Webview Message Contract

### Extension → Webview (PostMessage)

Messages sent from the extension host to the webview.

#### session-update

Sent when session data changes (after polling or user action).

```typescript
interface SessionUpdateMessage {
  type: 'session-update';
  payload: {
    sessions: AgentSessionView[];
    activeProvider: {
      id: string;
      displayName: string;
    } | null;
  };
}

interface AgentSessionView {
  localId: string;
  providerId: string;
  status: SessionStatus;
  displayStatus: string;  // Provider-specific status text
  branch: string;
  specPath: string;
  externalUrl?: string;
  createdAt: number;
  updatedAt: number;
  isReadOnly: boolean;
  tasks: AgentTaskView[];
  pullRequests: PullRequestView[];
}

interface AgentTaskView {
  taskId: string;
  specTaskId: string;
  title: string;
  priority: TaskPriority;
  status: TaskStatus;
  progress?: number;  // 0-100 if available
}

interface PullRequestView {
  url: string;
  state: 'open' | 'closed' | 'merged';
  number: number;
  title: string;
}
```

#### provider-change

Sent when the active provider changes.

```typescript
interface ProviderChangeMessage {
  type: 'provider-change';
  payload: {
    provider: {
      id: string;
      displayName: string;
      description: string;
    } | null;
  };
}
```

#### error

Sent when an error occurs that should be shown to the user.

```typescript
interface ErrorMessage {
  type: 'error';
  payload: {
    message: string;
    code: string;
    recoverable: boolean;
    action?: {
      label: string;
      command: string;
    };
  };
}
```

#### loading

Sent during long-running operations.

```typescript
interface LoadingMessage {
  type: 'loading';
  payload: {
    operation: string;
    isLoading: boolean;
  };
}
```

### Webview → Extension (PostMessage)

Messages sent from the webview to the extension host.

#### cancel-session

Request to cancel a session.

```typescript
interface CancelSessionMessage {
  type: 'cancel-session';
  payload: {
    localId: string;
  };
}
```

#### refresh-status

Request to manually poll for updates.

```typescript
interface RefreshStatusMessage {
  type: 'refresh-status';
  payload: {};
}
```

#### open-external

Request to open session in provider's UI.

```typescript
interface OpenExternalMessage {
  type: 'open-external';
  payload: {
    localId: string;
  };
}
```

#### open-pr

Request to open a pull request.

```typescript
interface OpenPrMessage {
  type: 'open-pr';
  payload: {
    url: string;
  };
}
```

#### select-provider

Request to initiate provider selection (from welcome content button).

```typescript
interface SelectProviderMessage {
  type: 'select-provider';
  payload: {
    providerId?: string;  // If undefined, show selection UI
  };
}
```

---

## Tree View Welcome Content

### Welcome View Schema

```json
{
  "contributes": {
    "viewsWelcome": [
      {
        "view": "gatomia.views.cloudAgents",
        "contents": "Select a cloud agent provider to get started:\n[Devin](command:gatomia.selectProvider?%22devin%22) [GitHub Copilot](command:gatomia.selectProvider?%22github-copilot%22)\n\nConfigure an existing provider:\n[Configure Credentials](command:gatomia.configureProvider)",
        "when": "gatomia.cloudAgent.hasProvider == false"
      }
    ]
  }
}
```

### Context Keys

| Key | Type | Description |
|-----|------|-------------|
| `gatomia.cloudAgent.hasProvider` | boolean | True when a provider is configured |
| `gatomia.cloudAgent.activeProvider` | string | The active provider ID |
| `gatomia.cloudAgent.hasRunningSessions` | boolean | True when any session is running |

---

## Event Flows

### Provider Selection Flow

```
User clicks provider button
        |
        v
Webview: select-provider message
        |
        v
Extension: handleSelectProvider()
        |
        v
Extension: ProviderRegistry.setActive()
        |
        v
Extension: Storage update
        |
        v
Extension: provider-change message to webview
        |
        v
Webview: Update UI to show provider info
```

### Session Update Flow (Polling)

```
PollingService timer (30s)
        |
        v
CloudAgentPollingService.pollAll()
        |
        v
ActiveProvider.pollSessions()
        |
        v
Session updates returned
        |
        v
SessionStore.update() for each
        |
        v
Extension: session-update message to webview
        |
        v
Webview: Refresh session list
```

### Task Dispatch Flow

```
User clicks "Run with Cloud Agent" on spec task
        |
        v
Extension: dispatchTask command
        |
        v
Check: active provider configured?
        |
        +-- No --> Show provider selection
        |
        +-- Yes --> ActiveProvider.createSession()
        |
        v
Provider API call (Devin/GitHub)
        |
        v
Session created
        |
        v
SessionStore.create()
        |
        v
Extension: session-update message
        |
        v
PollingService.start() if not running
```

---

## Error Handling Patterns

### Provider Error Display

```typescript
// In webview message handler
case 'error': {
  const { message, code, recoverable, action } = message.payload;
  
  if (recoverable && action) {
    showErrorWithAction(message, action.label, () => {
      vscode.postMessage({ type: action.command });
    });
  } else {
    showErrorNotification(message);
  }
  break;
}
```

### Retry Logic

```typescript
// Polling retry pattern
async function pollWithRetry(
  provider: CloudAgentProvider,
  sessions: AgentSession[],
  maxRetries = 3
): Promise<SessionUpdate[]> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await provider.pollSessions(sessions);
    } catch (error) {
      if (attempt === maxRetries) throw error;
      if (error.code === 'API_RATE_LIMITED') {
        await delay(5000 * attempt); // Exponential backoff
      }
    }
  }
  return [];
}
```

---

## Performance Considerations

### Message Batching

Session updates are batched into a single `session-update` message:

```typescript
// Instead of sending N messages for N updates:
// Send 1 message with all updates
webview.postMessage({
  type: 'session-update',
  payload: {
    sessions: allSessions  // Complete list, webview diffs
  }
});
```

### Throttling

User-initiated actions (refresh, cancel) are throttled:

```typescript
const throttledRefresh = throttle(() => {
  pollingService.pollOnce();
}, 5000); // Min 5s between manual refreshes
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-07-14 | Initial contract definition |
