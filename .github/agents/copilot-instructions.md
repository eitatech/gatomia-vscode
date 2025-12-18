# copilot-spec-ui Development Guidelines

Auto-generated from all feature plans. Last updated: 2025-12-05

## Active Technologies
- TypeScript 5.x (VS Code Extension) + VS Code Extension API, existing Hooks module, GitHub Copilot MCP integration (005-mcp-hooks-integration)
- VS Code workspace state (existing hook storage mechanism) (005-mcp-hooks-integration)
- TypeScript 5.x (VS Code extension) + React 18 (webview) (001-spec-review-flow)
- TypeScript 5.x, target ES2020 (extension) + React 18 with TypeScript (webview UI) + VS Code Extension API ^1.84.0, React 18.x, Vite (webview build), esbuild (extension build), Vitest (testing) (006-welcome-screen)
- VS Code workspace state API (for first-time tracking), VS Code configuration API (for settings persistence), no external database (006-welcome-screen)

- TypeScript 5.x (ES2022 target) + VS Code Extension API, Node.js path/fs (004-fix-delete-spec)

## Project Structure

```text
src/
tests/
```

## Commands

npm test && npm run lint

## Code Style

TypeScript 5.x (ES2022 target): Follow standard conventions

## Recent Changes
- 006-welcome-screen: Added TypeScript 5.x, target ES2020 (extension) + React 18 with TypeScript (webview UI) + VS Code Extension API ^1.84.0, React 18.x, Vite (webview build), esbuild (extension build), Vitest (testing)
- 001-spec-review-flow: Added TypeScript 5.x (VS Code extension) + React 18 (webview)
- 005-mcp-hooks-integration: Added TypeScript 5.x (VS Code Extension) + VS Code Extension API, existing Hooks module, GitHub Copilot MCP integration


<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
