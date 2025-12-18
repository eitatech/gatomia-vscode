# Quickstart: Welcome Screen Implementation

**Date**: December 16, 2025  
**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

## Purpose

Guide developers through implementing the welcome screen feature, from setup to testing. Provides step-by-step instructions for working with the codebase.

## Prerequisites

- Node.js 18+ installed
- VS Code 1.84.0+ with Extension Development Host capability
- Familiarity with TypeScript and React
- GatomIA repository cloned and dependencies installed (`npm run install:all`)

## Architecture Overview

The welcome screen follows the established webview pattern:

```
┌──────────────────────────────────────────────────────────────┐
│ Extension Host (Node.js)                                     │
│                                                              │
│  extension.ts ─┬─> welcome-screen-panel.ts                   │
│                │   (Webview lifecycle management)            │
│                │                                             │
│                └─> welcome-screen-provider.ts                │
│                    (State & business logic)                  │
│                                                              │
│                ┌── dependency-checker.ts                     │
│   Services ────┼── system-diagnostics.ts                     │
│                └── learning-resources.ts                     │
└─────────────────────────────┬────────────────────────────────┘
                              │ Message passing
┌─────────────────────────────┴────────────────────────────────┐
│ Webview (Browser context)                                    │
│                                                              │
│  welcome-app.tsx ─┬─> setup-section.tsx                      │
│                   ├─> features-section.tsx                   │
│                   ├─> config-section.tsx                     │
│                   ├─> status-section.tsx                     │
│                   └─> learning-section.tsx                   │
│                                                              │
│  welcome-store.ts (Zustand state management)                 │
└──────────────────────────────────────────────────────────────┘
```

## Development Workflow

### Step 1: Set Up Development Environment

```bash
# Install dependencies
npm run install:all

# Start extension build in watch mode
npm run watch

# In separate terminal, start webview dev server
cd ui && npm run dev
```

### Step 2: Implement Extension Host Components

#### 2.1 Create Welcome Screen Panel

**File**: `src/panels/welcome-screen-panel.ts`

**Key Responsibilities**:
- Create and manage webview panel lifecycle
- Handle message routing between extension and webview
- Queue messages until webview is ready
- Integrate with VS Code's column/focus APIs

**Reference Pattern**: `src/panels/document-preview-panel.ts`

**Key Methods**:
- `constructor(context, outputChannel, provider)` - Initialize panel
- `show()` - Create or reveal panel
- `dispose()` - Clean up resources
- `ensurePanel()` - Lazy panel creation
- `handleWebviewMessage(message)` - Route incoming messages
- `postMessage(message)` - Send to webview with queueing

#### 2.2 Create Welcome Screen Provider

**File**: `src/providers/welcome-screen-provider.ts`

**Key Responsibilities**:
- Aggregate state from multiple sources (dependencies, config, diagnostics)
- Handle business logic for commands (install, config updates)
- Manage workspace state (first-time tracking, preferences)
- Coordinate with service classes

**Key Methods**:
- `getWelcomeState()` - Aggregate complete state
- `updateConfiguration(key, value)` - Validate and persist config
- `checkDependencies()` - Run dependency detection
- `installDependency(type)` - Trigger installation flows
- `executeCommand(commandId, args)` - Proxy VS Code commands

#### 2.3 Create Service Classes

**File**: `src/services/dependency-checker.ts`

**Purpose**: Detect installed dependencies (Copilot Chat, CLIs)

```typescript
export class DependencyChecker {
  private cache: Map<string, { result: any; timestamp: number }> = new Map();
  
  async checkCopilotChat(): Promise<DependencyStatus> {
    // Use vscode.extensions.getExtension('GitHub.copilot-chat')
  }
  
  async checkSpecKit(): Promise<DependencyStatus> {
    // Execute 'specify --version' and parse output
  }
  
  async checkOpenSpec(): Promise<DependencyStatus> {
    // Execute 'openspec --version' and parse output
  }
}
```

**File**: `src/services/system-diagnostics.ts`

**Purpose**: Collect and store recent errors/warnings

```typescript
export class SystemDiagnostics {
  private entries: DiagnosticEntry[] = [];
  
  recordError(message: string, source: string, action?: string): void {
    // Add entry with timestamp, trim to 5, cleanup old entries
  }
  
  getRecentDiagnostics(): DiagnosticEntry[] {
    // Return last 5 from past 24 hours
  }
}
```

**File**: `src/services/learning-resources.ts`

**Purpose**: Provide static learning resources

```typescript
export class LearningResources {
  private static resources: LearningResource[] = [
    // Hardcoded resource list
  ];
  
  getAll(): LearningResource[] {
    return LearningResources.resources;
  }
  
  searchByKeyword(query: string): LearningResource[] {
    // Filter by keywords, title, description
  }
}
```

#### 2.4 Register Command and First-Time Check

**File**: `src/extension.ts`

Add to `activate()` function:

```typescript
// Initialize services
const dependencyChecker = new DependencyChecker(outputChannel);
const systemDiagnostics = new SystemDiagnostics();
const learningResources = new LearningResources();

// Initialize provider and panel
const welcomeProvider = new WelcomeScreenProvider(
  context,
  outputChannel,
  { dependencyChecker, systemDiagnostics, learningResources }
);
const welcomePanel = new WelcomeScreenPanel(
  context,
  outputChannel,
  welcomeProvider
);

// Register command
context.subscriptions.push(
  commands.registerCommand('gatomia.showWelcome', () => {
    welcomePanel.show();
  })
);

// Check first-time activation
const hasShown = context.workspaceState.get('gatomia.welcomeScreen.hasShownBefore', false);
const dontShow = context.workspaceState.get('gatomia.welcomeScreen.dontShow', false);

if (!hasShown && !dontShow) {
  await context.workspaceState.update('gatomia.welcomeScreen.hasShownBefore', true);
  welcomePanel.show();
}
```

### Step 3: Implement Webview Components

#### 3.1 Create Main Welcome App

**File**: `ui/src/features/welcome/welcome-app.tsx`

**Key Responsibilities**:
- Initialize VS Code API connection
- Subscribe to welcome store
- Render section components in order
- Handle message events from extension

```tsx
import { useEffect } from 'react';
import { useWelcomeStore } from './stores/welcome-store';
import { SetupSection } from './components/setup-section';
import { FeaturesSection } from './components/features-section';
import { ConfigSection } from './components/config-section';
import { StatusSection } from './components/status-section';
import { LearningSection } from './components/learning-section';

export function WelcomeApp() {
  const state = useWelcomeStore();
  
  useEffect(() => {
    // Send ready message
    vscode.postMessage({ type: 'welcome/ready' });
    
    // Listen for messages from extension
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);
  
  const handleMessage = (event: MessageEvent) => {
    const message = event.data;
    switch (message.type) {
      case 'welcome/state':
        useWelcomeStore.getState().setState(message.payload);
        break;
      case 'welcome/config-updated':
        useWelcomeStore.getState().updateConfig(message.payload.key, message.payload.newValue);
        break;
      // ... handle other messages
    }
  };
  
  return (
    <div className="welcome-container">
      <header>
        <h1>Welcome to GatomIA</h1>
        <p>Agentic Spec-Driven Development Toolkit</p>
      </header>
      
      <SetupSection />
      <FeaturesSection />
      <ConfigSection />
      <StatusSection />
      <LearningSection />
    </div>
  );
}
```

#### 3.2 Create Section Components

Each section follows this pattern:

```tsx
// ui/src/features/welcome/components/setup-section.tsx
export function SetupSection() {
  const { dependencies } = useWelcomeStore();
  
  const handleInstall = (dependency: string) => {
    vscode.postMessage({
      type: 'welcome/install-dependency',
      payload: { dependency }
    });
  };
  
  return (
    <section className="setup-section">
      <h2>Setup</h2>
      <DependencyStatus
        name="GitHub Copilot Chat"
        status={dependencies.copilotChat}
        onInstall={() => handleInstall('copilot-chat')}
      />
      {/* More dependencies */}
    </section>
  );
}
```

#### 3.3 Create Zustand Store

**File**: `ui/src/features/welcome/stores/welcome-store.ts`

```typescript
import { create } from 'zustand';
import type { WelcomeState } from '../types';

interface WelcomeStore extends WelcomeState {
  setState: (state: Partial<WelcomeState>) => void;
  updateConfig: (key: string, value: string | boolean) => void;
}

export const useWelcomeStore = create<WelcomeStore>((set) => ({
  // Initial state
  hasShownBefore: false,
  dontShowOnStartup: false,
  dependencies: {},
  configuration: {},
  diagnostics: [],
  learningResources: [],
  featureActions: [],
  
  setState: (newState) => set((state) => ({ ...state, ...newState })),
  
  updateConfig: (key, value) => set((state) => ({
    ...state,
    configuration: {
      ...state.configuration,
      [key]: { ...state.configuration[key], currentValue: value }
    }
  })),
}));
```

### Step 4: Write Tests

#### 4.1 Unit Tests for Extension Components

**File**: `tests/unit/panels/welcome-screen-panel.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WelcomeScreenPanel } from '../../../src/panels/welcome-screen-panel';

describe('WelcomeScreenPanel', () => {
  it('should create panel on show()', () => {
    // Test panel creation
  });
  
  it('should queue messages until webview ready', async () => {
    // Test message queueing
  });
  
  it('should handle dispose correctly', () => {
    // Test cleanup
  });
});
```

**File**: `tests/unit/services/dependency-checker.test.ts`

```typescript
describe('DependencyChecker', () => {
  it('should detect installed Copilot Chat', async () => {
    // Mock vscode.extensions.getExtension
    // Assert detection works
  });
  
  it('should cache results for 60 seconds', async () => {
    // Test caching behavior
  });
});
```

#### 4.2 Integration Tests

**File**: `tests/integration/welcome/welcome-first-time.test.ts`

```typescript
describe('Welcome Screen First-Time Display', () => {
  it('should show automatically on first workspace activation', async () => {
    // Mock workspace with no prior state
    // Activate extension
    // Assert welcome panel created
  });
  
  it('should not show if dontShow preference set', async () => {
    // Mock workspace with dontShow: true
    // Activate extension
    // Assert welcome panel not created
  });
});
```

### Step 5: Run and Debug

#### 5.1 Launch Extension Host

1. Press `F5` in VS Code
2. Extension Development Host window opens
3. Run command: `GatomIA: Show Welcome Screen`
4. Inspect webview for errors in DevTools (Help > Toggle Developer Tools)

#### 5.2 Debug Extension Code

- Set breakpoints in `src/` files
- Use VS Code's debugger
- Check `OutputChannel` logs for diagnostics

#### 5.3 Debug Webview Code

- Open webview DevTools: Cmd+Shift+P → "Developer: Open Webview Developer Tools"
- Set breakpoints in `ui/src/` compiled code
- Use console.log for quick debugging

### Step 6: Test and Iterate

1. Run unit tests: `npm run test`
2. Run integration tests: `npm run test tests/integration/welcome`
3. Manual testing checklist:
   - [ ] Welcome screen appears on first activation
   - [ ] Command palette access works
   - [ ] Dependency detection accurate
   - [ ] Configuration editing persists
   - [ ] Install buttons work
   - [ ] Learning resources open in browser
   - [ ] Light/dark theme support
   - [ ] Error display shows recent errors

## Common Tasks

### Add a New Configuration Item

1. Update `ConfigurationState` in `data-model.md`
2. Add to `welcome/state` message payload in `contracts/messages.md`
3. Add to `configuration` object in `WelcomeScreenProvider.getWelcomeState()`
4. Add UI control in `config-section.tsx`

### Add a New Learning Resource

1. Edit `learning-resources.ts`
2. Add to `LearningResources.resources` array
3. Rebuild extension: `npm run build`
4. Resource appears in Learning section automatically

### Add a New Feature Action

1. Register VS Code command in `extension.ts`
2. Add to `featureActions` array in `WelcomeScreenProvider.getWelcomeState()`
3. Action appears in Features section automatically

### Handle a New Error Type

1. Call `systemDiagnostics.recordError()` where error occurs
2. Error automatically appears in Status section
3. Add `suggestedAction` for actionable fixes

## Troubleshooting

### Webview Not Loading

- Check browser console for CSP errors
- Verify `getWebviewContent()` returns valid HTML
- Check webview resource paths are correct

### State Not Syncing

- Verify `welcome/ready` message sent
- Check message handler receives `welcome/state`
- Inspect Zustand store state in React DevTools

### Tests Failing

- Run tests in watch mode: `npm run test:watch`
- Check mock setup matches VS Code API
- Verify async timing with `await` or `waitFor()`

## Code Style

- Follow kebab-case for file names: `welcome-screen-panel.ts`
- Use TypeScript strict mode (already configured)
- Format before commit: `npm run format`
- Lint before PR: `npm run lint`

## Next Steps

After implementation:
1. Run full test suite: `npm run test:coverage`
2. Create PR with checklist from `checklists/requirements.md`
3. Request code review
4. Address feedback
5. Merge when CI passes and approved

## Resources

- [VS Code Extension API](https://code.visualstudio.com/api)
- [Webview API Guide](https://code.visualstudio.com/api/extension-guides/webview)
- [React Documentation](https://react.dev)
- [Zustand Documentation](https://docs.pmnd.rs/zustand)
- [Vitest Documentation](https://vitest.dev)

---

**Questions?** Check `spec.md` for requirements or `contracts/messages.md` for API details.
