# Quickstart: Dynamic Extension Document Display in Spec Explorer

**Feature**: 017-extension-docs-tree
**Date**: 2026-04-13

## Prerequisites

- Node.js 18+
- VS Code 1.84.0+
- Dependencies installed: `npm run install:all`

## Development Setup

```bash
# 1. Switch to feature branch
git checkout 017-extension-docs-tree

# 2. Install dependencies
npm run install:all

# 3. Run tests in watch mode
npm run test:watch

# 4. Build and launch extension
npm run build
# Then press F5 to launch Extension Development Host
```

## Verify the Feature

### Quick Smoke Test

1. Open a workspace with a SpecKit project (has `specs/` directory)
2. Add an extra markdown file to any spec directory:
   ```bash
   echo "# Test Doc" > specs/016-multi-provider-agents/my-extension-doc.md
   ```
3. Open the Spec Explorer tree view in VS Code
4. Expand the `016-multi-provider-agents` spec
5. Verify "My extension doc" appears with a distinct icon (extensions icon)
6. Click it to confirm it opens in the editor

### Subfolder Test

1. Create a subfolder with markdown files:
   ```bash
   mkdir -p specs/016-multi-provider-agents/v-model
   echo "# Requirements" > specs/016-multi-provider-agents/v-model/requirements-spec.md
   echo "# Design" > specs/016-multi-provider-agents/v-model/system-design.md
   ```
2. Expand the spec in the tree
3. Verify "V model" appears as a collapsible folder node
4. Expand it to see "Requirements spec" and "System design" leaf nodes

### Run Tests

```bash
# Unit tests for adapter changes
npm test -- tests/unit/utils/spec-kit-adapter-extension-docs.test.ts

# Unit tests for provider changes
npm test -- tests/unit/providers/spec-explorer-provider.test.ts

# Integration tests
npm test -- tests/integration/spec-explorer/extension-docs-tree.test.ts

# All tests + lint
npm test && npm run check
```

## Key Files

| File | Role |
|------|------|
| `src/utils/spec-kit-adapter.ts` | `getSpecKitFeatureFiles()` -- collects extra files/folders |
| `src/providers/spec-explorer-provider.ts` | Renders `extension-document` and `extension-folder` tree nodes |
| `tests/unit/utils/spec-kit-adapter-extension-docs.test.ts` | Unit tests for file discovery |
| `tests/integration/spec-explorer/extension-docs-tree.test.ts` | Integration tests for tree rendering |
