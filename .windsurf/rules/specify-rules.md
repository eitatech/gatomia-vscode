# gatomia-vscode Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-04-13

## Active Technologies
- TypeScript 5.3+ (strict: true, target: ES2022) + VS Code Extension API 1.84.0+, React 18.3+ (webview), `@agentclientprotocol/sdk` (already wired via `src/services/acp/acp-client.ts`), existing `src/features/cloud-agents/*` module (spec 016), existing `src/services/acp/*` (ACP client, session manager, provider registry, `KNOWN_AGENTS` catalog via `src/providers/hook-view-provider.ts`) (018-agent-chat-panel)

- TypeScript 5.3+ (strict: true, target: ES2022) + VS Code Extension API 1.84.0+, Node.js `fs` module (017-extension-docs-tree)

## Project Structure

```text
src/
tests/
```

## Commands

npm test && npm run lint

## Code Style

TypeScript 5.3+ (strict: true, target: ES2022): Follow standard conventions

## Recent Changes
- 018-agent-chat-panel: Added TypeScript 5.3+ (strict: true, target: ES2022) + VS Code Extension API 1.84.0+, React 18.3+ (webview), `@agentclientprotocol/sdk` (already wired via `src/services/acp/acp-client.ts`), existing `src/features/cloud-agents/*` module (spec 016), existing `src/services/acp/*` (ACP client, session manager, provider registry, `KNOWN_AGENTS` catalog via `src/providers/hook-view-provider.ts`)

- 017-extension-docs-tree: Added TypeScript 5.3+ (strict: true, target: ES2022) + VS Code Extension API 1.84.0+, Node.js `fs` module

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
