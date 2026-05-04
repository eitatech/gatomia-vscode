# Phase 05: Visual Workflow Composer with React Flow

This phase introduces the visual workflow composer that lets engineers model hooks, triggers, schedules, and execution paths using an intuitive graph interface built on the new design-system and execution-flow foundations. It matters because the product vision depends on making orchestration legible and flexible, and a graph-based composer is the clearest way to show how events, conditions, and actions connect.

## Tasks

- [x] Define the workflow-composer interaction contract before implementing the graph UI:
  - Audit existing hooks UI, orchestration prototype UI, and the refactored hook model before adding React Flow-specific structures
  - Confirm the smallest graph vocabulary needed now: source node, condition node, schedule node, action node, and execution edge
  - Capture the contract in `docs/architecture/workflows/workflow-composer-contract.md` with YAML front matter and wiki-links to `[[Workflow-Node-Types]]` and `[[Workflow-Inspector-Patterns]]`

- [ ] Add React Flow and create the first reusable workflow graph foundations:
  - Integrate React Flow using the existing webview build and page patterns instead of creating a standalone app shell
  - Build minimal reusable node and edge renderers that reflect the design-system tokens and status semantics created earlier
  - Keep the first version focused on readability, selection, and persistence mapping rather than advanced animation or speculative features

- [ ] Implement the workflow composer for hooks, triggers, and schedules:
  - Bind the graph UI to the refactored execution-flow model so users can view and edit real workflow data instead of mock-only nodes
  - Add a side inspector or property editor that reuses current form controls where possible for editing node-specific configuration
  - Ensure changes in the graph can round-trip to the underlying hook model without inventing a second incompatible representation

- [ ] Add workflow documentation artifacts for product evolution:
  - Create `docs/architecture/workflows/workflow-node-types.md` and `docs/architecture/workflows/workflow-inspector-patterns.md` with YAML front matter and wiki-links to `[[Workflow-Composer-Contract]]`
  - Document how visual nodes map to execution-flow backend concepts so future contributors can extend the system safely

- [ ] Write tests for the workflow composer:
  - Add focused UI tests for graph rendering, node selection, inspector updates, and serialization or round-trip behavior
  - Add unit tests for any graph-to-domain mapping helpers introduced in this phase

- [ ] Run validation for the workflow-composer phase and fix failures:
  - Run targeted workflow and hooks UI tests first
  - Run `npm run check`
  - Verify the composer loads within the existing extension/webview architecture and does not regress the non-graph hooks experience
