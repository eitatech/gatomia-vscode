---
type: architecture
title: Workflow Inspector Patterns
created: 2026-05-04
tags:
  - workflow
  - inspector
  - ui
related:
  - '[[Workflow-Composer-Contract]]'
---

# Workflow Inspector Patterns

This document details the property editor (inspector) patterns used in the Workflow Composer.

## Pattern Overview

The Workflow Composer utilizes a side inspector panel to display and edit the configuration of selected nodes. Rather than maintaining a separate state representation, the inspector directly manipulates the underlying `Hook` model.

### 1. Form Reuse
- We reuse the `HookForm` component from the standard Hooks View.
- When a node is selected, its parent `Hook` configuration is loaded into the inspector.
- This ensures consistency across different views (Hooks list vs. visual graph) and prevents diverging configuration schemas.

### 2. State Synchronization
- **Selection**: Clicking a node triggers `onNodeClick`, identifying the `hookId`.
- **Loading**: The inspector fetches the corresponding `Hook` object from the current state.
- **Saving**: Form submissions dispatch `hooks/update` or `hooks/create` to the extension backend, which responds with a `hooks/sync` event. This synchronizes both the inspector and the graph layout with the source of truth.

## Future Evolution
If nodes become decoupled from a single linear `Hook` structure in the future, the inspector will need to adapt to edit individual node entities (`EventSource`, `ActionConfig`, etc.) rather than the entire `Hook`.
