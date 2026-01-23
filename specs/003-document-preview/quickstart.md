# Quickstart: Document Preview & Refinement

**Feature**: Document Preview & Refinement  
**Branch**: `001-document-preview`  
**Last Updated**: 2025-12-06

## Overview

This feature adds a rich preview webview to the VS Code extension that:

- Renders SpecKit documents (specs, plans, tasks, research, data models, APIs, quickstarts) with Markdown and diagrams
- Supports interactive form editing directly in the preview
- Provides a "Refine Document" workflow to submit structured feedback
- Maintains read-only enforcement to prevent accidental edits
- Tracks performance metrics (SC-001: 95% previews <3s, SC-002: 90% diagram success)

## Prerequisites

- VS Code 1.84+ with GatomIA workspace open
- `npm run install:all` completed (root + `ui`)
- Sample SpecKit documents covering specs, plans, research, and data models

## Run the development loop

1. `npm run watch` — launches TypeScript watch plus the Vite dev server for the webview.
2. In VS Code, press `F5` to start the Extension Development Host.
3. Open the GatomIA "Specs" view and select any document to trigger the preview webview.

## Validate the preview renderer

1. Confirm Markdown content renders without opening the raw file.
2. Paste Mermaid + C4 snippets inside the document and ensure diagrams load with zoom/scroll controls.
3. Toggle between light/dark themes to verify styling parity.

## Test interactive forms

1. Load a task template with dropdowns and checkboxes.
2. Modify several fields; simulate concurrent edits by changing the file in the main VS Code window.
3. Verify the preview warns about the external update, offers manual reload, and preserves drafts until a choice is made.

## Submit a refinement request

1. Click **Refine Document** inside the preview.
2. Enter an issue description (≥20 characters) and pick a category.
3. Submit and verify the confirmation banner displays the request id.

## Accessibility Features

The preview webview includes comprehensive accessibility support:

- **ARIA Labels**: All interactive elements have descriptive labels
- **Keyboard Navigation**: Full keyboard support (Tab, Shift+Tab, Enter, Escape)
- **Screen Reader**: Compatible with VoiceOver (macOS) and NVDA (Windows)
- **Focus Management**: Modal dialogs trap focus appropriately
- **Error Announcements**: Form validation errors are announced with `aria-invalid` and `aria-describedby`
- **Live Regions**: Dynamic content updates use `aria-live` for screen reader announcements

## Run tests

1. `npm run test -- --filter preview` for extension-side preview logic.
2. `cd ui && npm run test -- preview` for React components.
3. `npm run lint && npm run check` to satisfy gating quality checks before raising a PR.

## Monitor performance metrics

The telemetry system tracks preview load times and diagram render success rates to validate SC-001 and SC-002 targets.

### Basic usage in code

```typescript
import { PreviewLoadTracker, DiagramRenderTracker } from "../utils/telemetry";

// Track preview load
const tracker = new PreviewLoadTracker(documentId, documentType);
tracker.setMetadata({ diagramCount: 3, formFieldCount: 5, sectionCount: 10 });
// ... perform loading ...
tracker.complete(true); // or tracker.complete(false, "error message")

// Track diagram rendering
const diagramTracker = new DiagramRenderTracker(documentId, diagramId, "mermaid");
// ... render diagram ...
diagramTracker.complete(true); // or diagramTracker.complete(false, "parse error")
```

### View performance summary

```typescript
import { getPerformanceReport, meetsPreviewPerformanceTarget, meetsDiagramSuccessTarget } from "../utils/telemetry";

console.log(getPerformanceReport());
// Shows:
// - Preview load times (SC-001: 95% within 3 seconds)
// - Diagram success rate (SC-002: 90% success)
// - Breakdown by document type

// Check if targets are met
if (meetsPreviewPerformanceTarget() && meetsDiagramSuccessTarget()) {
  console.log("✓ All performance targets met!");
}
```

### Export metrics for analysis

```typescript
import { exportMetrics } from "../utils/telemetry";

const metrics = exportMetrics();
// Returns: { previews, diagrams, forms, refinements }
// Can be logged, sent to analytics, or saved for later analysis
```

## Troubleshooting

### Preview webview not opening

- Ensure you have a document selected in the Specs Explorer
- Check the Extension Development Host console for errors
- Verify `npm run watch` is running for the webview dev server
- Try reloading the Extension Development Host (`Cmd+R` / `Ctrl+R`)

### Diagrams not rendering

- Check diagram syntax in the Markdown source (valid Mermaid/C4/PlantUML)
- Verify markdown-it diagram plugins are installed (`npm run install:all`)
- Inspect browser console in webview (Developer Tools)
- Diagram rendering has automatic retry logic (up to 2 retries)

### Forms not saving

- Verify form fields have unique `fieldId` values
- Check that form submission handler is connected in `preview-app.tsx`
- Ensure document has `permissions.canEditForms = true`
- Review form validation errors in the webview UI

### Performance issues

- Use telemetry tools to identify slow operations:
  - `getPerformanceReport()` shows load time statistics
  - `meetsPreviewPerformanceTarget()` validates SC-001 target
  - `meetsDiagramSuccessTarget()` validates SC-002 target
- Check if diagrams are timing out (default 5s render timeout)
- Profile React components using React DevTools

### Stale document warnings

- This is expected behavior when the file changes externally
- Click "Reload preview" to refresh with latest content
- Draft form changes are preserved until you choose to reload or discard

## Architecture Notes

### Extension Host (src/)

- `src/panels/documentPreviewPanel.ts`: Webview provider and lifecycle management
- `src/services/documentPreviewService.ts`: Fetches DocumentArtifact payloads via SpecKit APIs
- `src/services/refinementGateway.ts`: Submits refinement requests to `/refinements` endpoint
- `src/extension.ts`: Command registration, file watchers, message passing bridge

### Webview UI (ui/src/)

- `features/preview/preview-app.tsx`: Main preview container with metadata header, outline, content rendering
- `components/preview/document-outline.tsx`: Navigation sidebar with section anchors
- `components/forms/preview-form-container.tsx`: Form rendering with validation and submission
- `components/refine/refine-dialog.tsx`: Modal dialog for refinement request submission
- `lib/markdown/preview-renderer.ts`: Markdown-it configuration with diagram plugin support

### Stores (ui/src/features/preview/stores/)

- `preview-store.ts`: Document state, stale notifications, session management
- `form-store.ts`: Form field state, validation, dirty tracking, submission payload

### Testing

- Unit tests: `tests/unit/features/documents/`, `ui/tests/preview/`
- Integration tests: `tests/integration/preview/` (webview, readonly, performance)
- Performance harness: `tests/integration/preview/preview-performance.test.ts` validates SC-001/SC-002

## Next Steps

- Review [ACCESSIBILITY_AUDIT.md](./ACCESSIBILITY_AUDIT.md) for detailed accessibility compliance
- See [data-model.md](./data-model.md) for entity relationships and validation rules
- Check [contracts/](./contracts/) for API specifications (preview.yaml)
- Consult [research.md](./research.md) for technical decisions and constraints

