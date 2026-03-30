# Quickstart: Multi-Provider Cloud Agent Support

## Overview

This feature adds support for multiple cloud agent providers (Devin, GitHub Copilot coding agent) to the GatomIA VS Code extension. Users can select their preferred provider and view task progress in the Cloud Agents sidebar.

## For Users

### First-Time Setup

1. Open the **Cloud Agents** sidebar in VS Code
2. If no provider is configured, you'll see a welcome view with provider options
3. Select your preferred provider (Devin or GitHub Copilot)
4. Follow the prompts to configure credentials:
   - **Devin**: Enter your Devin API token
   - **GitHub Copilot**: Authenticate via GitHub (OAuth)

### Switching Providers

1. Click the provider selector in the Cloud Agents sidebar header
2. Choose a different provider
3. Previous provider sessions become read-only (visible but not interactive)

### Viewing Task Progress

- **Active sessions** appear in the "Active" section
- **Completed sessions** appear in the "Recent" section
- Click a session to see tasks and pull requests
- Click external links to view in the provider's web UI

---

## For Developers

### Architecture

```
src/features/cloud-agents/
├── providers/
│   ├── index.ts              # Provider registry
│   ├── cloud-agent-provider.ts   # Interface definition
│   ├── devin-adapter.ts      # Devin implementation
│   └── github-copilot-adapter.ts # GitHub Copilot implementation
├── services/
│   ├── provider-config-store.ts  # Configuration persistence
│   ├── session-aggregator.ts     # Combines active/read-only sessions
│   └── session-cleanup-service.ts # 7-day retention
└── ui/
    ├── cloud-agents-provider.ts  # Tree view data provider
    └── cloud-agents-panel.ts     # Webview panel
```

### Adding a New Provider

1. Create a new adapter in `src/features/cloud-agents/providers/`
2. Implement the `CloudAgentProvider` interface (see `contracts/provider-adapter.md`)
3. Register the adapter in `providers/index.ts`
4. Add tests in `tests/unit/features/cloud-agents/`

### Key Files

| File | Purpose |
|------|---------|
| `providers/cloud-agent-provider.ts` | Interface all adapters must implement |
| `services/provider-config-store.ts` | Manages provider preference storage |
| `providers/devin-adapter.ts` | Existing Devin integration (refactored) |
| `providers/github-copilot-adapter.ts` | New GitHub Copilot integration |

### Running Tests

```bash
# Run all cloud-agents tests
npm test -- tests/unit/features/cloud-agents/

# Run with watch mode
npm run test:watch -- tests/unit/features/cloud-agents/
```

### Building

```bash
# Full build
npm run build

# Extension only
npm run build:ext

# Webview only
npm run build:webview
```

---

## Configuration

Provider configuration is stored in:

- **Provider preference**: VS Code workspaceState (`gatomia.cloud-agents.config`)
- **Credentials**: VS Code secrets storage (`gatomia.cloud-agents.{providerId}`)
- **Sessions**: VS Code workspaceState (`gatomia.cloud-agents.sessions`)

---

## Constraints

- Single active provider at a time
- 7-day session retention (same as existing Devin behavior)
- Must preserve existing Devin functionality when Devin is selected
- All source files must use kebab-case naming
- TypeScript strict mode enabled
