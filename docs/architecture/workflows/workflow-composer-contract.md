---
type: architecture
title: Workflow Composer Interaction Contract
created: 2026-05-04
tags:
  - workflow
  - react-flow
  - ui
related:
  - '[[Workflow-Node-Types]]'
  - '[[Workflow-Inspector-Patterns]]'
---

# Workflow Composer Interaction Contract

This document defines the interaction contract for the visual workflow composer built with React Flow, specifying how graph structures map to the execution flow model.

## Graph Vocabulary

The minimal set of nodes and edges required to represent workflows:

### Nodes
- **Source Node**: Represents an external trigger or event (e.g., repository push, file change).
- **Condition Node**: Represents a logic gate or filter that execution must pass through.
- **Schedule Node**: Represents a time-based trigger or delay.
- **Action Node**: Represents an executable task or hook (e.g., running an agent, executing a script).

### Edges
- **Execution Edge**: Represents the flow of execution from one node to another.

## Interaction Patterns

- **Selection**: Clicking a node or edge selects it and opens the property inspector.
- **Editing**: Modifying properties in the inspector updates the node's underlying configuration.
- **Persistence**: The graph structure must serialize to and deserialize from the core execution-flow model without requiring a separate representation.
