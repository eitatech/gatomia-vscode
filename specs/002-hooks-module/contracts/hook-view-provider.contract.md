# Component Contract: HookViewProvider

**Feature**: Hooks Module  
**Component**: HookViewProvider  
**Responsibility**: Webview management, message routing, state synchronization

## Purpose

HookViewProvider manages the Hooks webview panel, handles message passing between extension and webview UI, and synchronizes hook state across the boundary.

## Interface

```typescript
export class HookViewProvider implements WebviewViewProvider {
    constructor(
        context: ExtensionContext,
        hookManager: HookManager,
        outputChannel: OutputChannel
    );

    // WebviewViewProvider implementation
    resolveWebviewView(
        webviewView: WebviewView,
        context: WebviewViewResolveContext,
        token: CancellationToken
    ): void;

    // Lifecycle
    initialize(): void;
    dispose(): void;

    // State Synchronization
    async syncHooksToWebview(): Promise<void>;
    async refreshWebview(): Promise<void>;

    // Message Handlers
    private handleWebviewMessage(message: WebviewMessage): Promise<void>;
}

type WebviewMessage = 
    | HookCreateMessage
    | HookUpdateMessage
    | HookDeleteMessage
    | HookToggleMessage
    | HookListRequestMessage
    | HookExecutionLogsRequestMessage;

interface HookCreateMessage {
    command: 'hooks.create';
    data: Omit<Hook, 'id' | 'createdAt' | 'modifiedAt' | 'executionCount'>;
}

interface HookUpdateMessage {
    command: 'hooks.update';
    data: {
        id: string;
        updates: Partial<Hook>;
    };
}

interface HookDeleteMessage {
    command: 'hooks.delete';
    data: { id: string };
}

interface HookToggleMessage {
    command: 'hooks.toggle';
    data: { id: string; enabled: boolean };
}

interface HookListRequestMessage {
    command: 'hooks.list';
}

interface HookExecutionLogsRequestMessage {
    command: 'hooks.logs';
    data: { hookId?: string };
}

// Extension → Webview messages
type ExtensionMessage =
    | HooksSyncMessage
    | HookCreatedMessage
    | HookUpdatedMessage
    | HookDeletedMessage
    | HookExecutionStatusMessage
    | ErrorMessage;

interface HooksSyncMessage {
    command: 'hooks.sync';
    data: { hooks: Hook[] };
}

interface HookCreatedMessage {
    command: 'hooks.created';
    data: { hook: Hook };
}

interface HookUpdatedMessage {
    command: 'hooks.updated';
    data: { hook: Hook };
}

interface HookDeletedMessage {
    command: 'hooks.deleted';
    data: { id: string };
}

interface HookExecutionStatusMessage {
    command: 'hooks.execution-status';
    data: {
        hookId: string;
        status: 'executing' | 'completed' | 'failed';
        error?: string;
    };
}

interface ErrorMessage {
    command: 'hooks.error';
    data: {
        message: string;
        code?: string;
    };
}
```

## Responsibilities

### Webview Initialization

```typescript
resolveWebviewView(
    webviewView: WebviewView,
    context: WebviewViewResolveContext,
    token: CancellationToken
): void {
    this._view = webviewView;
    
    // Configure webview
    webviewView.webview.options = {
        enableScripts: true,
        localResourceRoots: [
            Uri.joinPath(this._extensionUri, 'dist'),
            Uri.joinPath(this._extensionUri, 'ui/dist')
        ]
    };
    
    // Set HTML content
    webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);
    
    // Setup message handling
    webviewView.webview.onDidReceiveMessage(
        (message) => this.handleWebviewMessage(message),
        undefined,
        this._disposables
    );
    
    // Initial sync
    this.syncHooksToWebview();
    
    // Subscribe to hook changes
    this.hookManager.onHooksChanged(() => {
        this.syncHooksToWebview();
    });
}
```

### Message Handling

```typescript
private async handleWebviewMessage(message: WebviewMessage): Promise<void> {
    try {
        switch (message.command) {
            case 'hooks.create':
                await this.handleCreateHook(message.data);
                break;
            
            case 'hooks.update':
                await this.handleUpdateHook(message.data.id, message.data.updates);
                break;
            
            case 'hooks.delete':
                await this.handleDeleteHook(message.data.id);
                break;
            
            case 'hooks.toggle':
                await this.handleToggleHook(message.data.id, message.data.enabled);
                break;
            
            case 'hooks.list':
                await this.syncHooksToWebview();
                break;
            
            case 'hooks.logs':
                await this.sendExecutionLogs(message.data.hookId);
                break;
            
            default:
                this.outputChannel.appendLine(`Unknown command: ${(message as any).command}`);
        }
    } catch (error) {
        await this.sendError(error as Error);
    }
}
```

### CRUD Operations (Webview → Extension)

```typescript
private async handleCreateHook(data: Omit<Hook, 'id' | 'createdAt' | 'modifiedAt' | 'executionCount'>): Promise<void> {
    const hook = await this.hookManager.createHook(data);
    
    // Send confirmation to webview
    await this._view?.webview.postMessage({
        command: 'hooks.created',
        data: { hook }
    });
}

private async handleUpdateHook(id: string, updates: Partial<Hook>): Promise<void> {
    const hook = await this.hookManager.updateHook(id, updates);
    
    await this._view?.webview.postMessage({
        command: 'hooks.updated',
        data: { hook }
    });
}

private async handleDeleteHook(id: string): Promise<void> {
    const success = await this.hookManager.deleteHook(id);
    
    if (success) {
        await this._view?.webview.postMessage({
            command: 'hooks.deleted',
            data: { id }
        });
    }
}

private async handleToggleHook(id: string, enabled: boolean): Promise<void> {
    await this.hookManager.updateHook(id, { enabled });
}
```

### State Synchronization (Extension → Webview)

```typescript
async syncHooksToWebview(): Promise<void> {
    if (!this._view) return;
    
    const hooks = await this.hookManager.getAllHooks();
    
    await this._view.webview.postMessage({
        command: 'hooks.sync',
        data: { hooks }
    });
}

async refreshWebview(): Promise<void> {
    await this.syncHooksToWebview();
}
```

### Execution Status Updates

```typescript
// Subscribe to hook execution events
private setupExecutionListeners(): void {
    this.hookExecutor.onExecutionStarted((event) => {
        this.sendExecutionStatus(event.hook.id, 'executing');
    });
    
    this.hookExecutor.onExecutionCompleted((event) => {
        this.sendExecutionStatus(event.hook.id, 'completed');
    });
    
    this.hookExecutor.onExecutionFailed((event) => {
        this.sendExecutionStatus(
            event.hook.id,
            'failed',
            event.result?.error?.message
        );
    });
}

private async sendExecutionStatus(
    hookId: string,
    status: 'executing' | 'completed' | 'failed',
    error?: string
): Promise<void> {
    await this._view?.webview.postMessage({
        command: 'hooks.execution-status',
        data: { hookId, status, error }
    });
}
```

### Error Handling

```typescript
private async sendError(error: Error): Promise<void> {
    this.outputChannel.appendLine(`Hook operation error: ${error.message}`);
    
    await this._view?.webview.postMessage({
        command: 'hooks.error',
        data: {
            message: error.message,
            code: (error as any).code
        }
    });
}
```

### HTML Generation

```typescript
private getHtmlForWebview(webview: Webview): string {
    const scriptUri = webview.asWebviewUri(
        Uri.joinPath(this._extensionUri, 'ui', 'dist', 'hooks-view.js')
    );
    const styleUri = webview.asWebviewUri(
        Uri.joinPath(this._extensionUri, 'ui', 'dist', 'hooks-view.css')
    );
    
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link rel="stylesheet" href="${styleUri}">
        <title>Hooks Configuration</title>
    </head>
    <body>
        <div id="root"></div>
        <script src="${scriptUri}"></script>
    </body>
    </html>`;
}
```

## Dependencies

- `vscode.ExtensionContext` - extension context
- `vscode.WebviewViewProvider` - webview provider interface
- `HookManager` - hook CRUD operations
- `HookExecutor` - execution status events
- `vscode.OutputChannel` - logging

## Error Handling

| Error Scenario | Action |
|----------------|--------|
| Invalid message format | Log error, send error message to webview |
| Hook validation error | Send error message to webview with details |
| Hook not found | Send error message to webview |
| Webview not initialized | Log warning, skip operation |
| Message serialization error | Log error, continue |

## Events

Provider subscribes to:
- `hookManager.onHooksChanged` → trigger `syncHooksToWebview()`
- `hookExecutor.onExecutionStarted` → send execution status
- `hookExecutor.onExecutionCompleted` → send execution status
- `hookExecutor.onExecutionFailed` → send execution status

## Usage Example

```typescript
// Initialize in extension.ts
const hookViewProvider = new HookViewProvider(
    context,
    hookManager,
    outputChannel
);
hookViewProvider.initialize();

// Register commands that open the Hooks panel when needed
commands.registerCommand('gatomia.hooks.addHook', async () => {
    await hookViewProvider.showCreateHookForm();
});

commands.registerCommand('gatomia.hooks.viewLogs', async (hookId?: string) => {
    await hookViewProvider.showLogsPanel(hookId);
});
```

## Testing Requirements

### Unit Tests
- ✅ Open hooks panel on demand
- ✅ Handle create message
- ✅ Handle update message
- ✅ Handle delete message
- ✅ Handle toggle message
- ✅ Sync hooks to webview
- ✅ Send execution status updates
- ✅ Send error messages
- ✅ Generate HTML correctly

### Integration Tests
- ✅ Webview → Create hook → Extension creates → Webview updates
- ✅ Extension hook change → Webview auto-syncs
- ✅ Hook execution → Webview receives status updates
- ✅ Error in operation → Webview displays error

## Performance Considerations

- **Message Throttling**: Debounce rapid sync requests
- **Lazy Loading**: Only load hooks when webview is visible
- **Optimistic Updates**: Webview updates immediately, sync confirms

**Expected Scale**:
- 50 hooks displayed
- 10-20 messages per session
- <100ms message handling latency
