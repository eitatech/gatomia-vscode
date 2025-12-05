# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Quick Start: Common Commands

```bash
# Install all dependencies
npm run install:all

# Development workflow
npm run build          # Full build (prompts + extension + webview)
npm run watch         # TypeScript watch + webview dev server
npm run build-prompts # Compile markdown prompts to TypeScript
npm run build:ext     # Bundle extension only (esbuild)
npm run build:webview # Build React webview (Vite)

# Testing and Quality
npm test              # Run tests (Vitest)
npm run test:watch   # Watch mode for tests
npm run test:coverage # Coverage report
npm run lint         # Lint with Biome
npm run format       # Format code with Biome
npm run check        # Run all checks (lint + format validation)

# Packaging and Publishing
npm run package      # Create VSIX file for VS Code Marketplace
npm run compile      # Build then package (used for CI/CD)

# Webview development
npm --prefix webview-ui run dev  # Run webview dev server in isolation

# Launch the extension
Press F5 in VS Code to launch the Extension debug host
```

