# Research: MCP Server Integration for Hooks

**Feature**: 005-mcp-hooks-integration  
**Phase**: 0 - Research & Technology Decisions  
**Date**: December 5, 2025

## Overview

This document captures research findings and technology decisions for integrating MCP (Model Context Protocol) servers with the Hooks module.

## Research Questions & Findings

### 1. How does VS Code/Copilot expose MCP server configuration?

**Decision**: Access via Copilot's internal configuration  
**Rationale**: GitHub Copilot manages MCP servers through its own configuration system (`mcp.json` in user settings)

**Findings**:
- MCP servers are configured in `~/.config/Code/User/mcp.json` (or platform equivalent)
- VS Code extension cannot directly read Copilot's internal MCP registry
- Must use VS Code's extension API to query available Copilot tools/servers
- Existing code in `github-action.ts` shows MCP client provider pattern

**Alternatives Considered**:
- Direct `mcp.json` parsing → Rejected: brittle, breaks encapsulation, platform-dependent paths
- VS Code Copilot API → Rejected: no public API for MCP server discovery yet
- Manual MCP server configuration → Rejected: duplicates user configuration effort

**Implementation Approach**:
- Use VS Code Extension API to enumerate available Copilot capabilities
- Mirror pattern from `GitHubMcpClient` in `github-action.ts`
- Provide abstraction layer for MCP server discovery service

---

### 2. What MCP operations are needed for hooks integration?

**Decision**: Generic action invocation with parameter mapping  
**Rationale**: Hooks need to call arbitrary MCP actions, not just predefined operations

**Findings**:
- MCP servers expose "tools" (actions) via standard protocol
- Each tool has: name, description, input schema (JSON Schema)
- Tools accept structured parameters (JSON objects)
- GitHub MCP integration uses specific operations (openIssue, createPR, etc.)

**Alternatives Considered**:
- Predefined MCP operations only → Rejected: limits extensibility, requires code changes for new servers
- Dynamic tool discovery + execution → **SELECTED**: flexible, works with any MCP server
- Hardcoded server list → Rejected: doesn't scale, requires updates for new servers

**Implementation Approach**:
- Create `MCPServerInfo` type with: id, name, tools[]
- Create `MCPTool` type with: name, description, inputSchema
- Implement discovery service to enumerate servers and their tools
- Implement executor service to invoke tools with parameter mapping

---

### 3. How to handle parameter mapping between hook context and MCP actions?

**Decision**: Automatic name-based matching (from clarification session)  
**Rationale**: Simplifies configuration, reduces user burden for common cases

**Findings**:
- Hook context provides: feature, branch, timestamp, user
- MCP tools define parameter schemas (names, types, required/optional)
- Most common pattern: direct name matching (e.g., `branch` → `branch`)
- JSON Schema validation available for parameter types

**Implementation Approach**:
- Extract parameter names from MCP tool input schema
- Match against available template context variables
- Apply automatic type coercion where possible (string → number, etc.)
- Log warnings for unmatched required parameters
- Support template expansion for string parameters

---

### 4. What timeout and concurrency controls are needed?

**Decision**: 30s timeout, pool of 5 concurrent actions (from clarification session)  
**Rationale**: Balance responsiveness with resource protection

**Findings**:
- VS Code extensions run in Node.js environment (async/await, Promises)
- Existing hook executor has timeout infrastructure (30s timeout constant)
- No built-in concurrency pool in current implementation
- MCP actions can be slow (network calls, external processes)

**Implementation Approach**:
- Reuse `ACTION_TIMEOUT_MS` constant (30,000ms)
- Implement semaphore-based concurrency pool
- Queue actions when pool is exhausted
- Provide configurable pool size via extension settings (default: 5)

---

### 5. How to provide MCP action selection UI?

**Decision**: Searchable tree view with servers as parents, actions as children (from clarification session)  
**Rationale**: Matches VS Code UX patterns, provides context, supports search

**Findings**:
- Existing hooks UI uses webview + React components
- VS Code provides TreeView API for explorer views
- Webview approach more flexible for complex interactions
- Current hook configuration uses form-based UI

**Alternatives Considered**:
- VS Code TreeView → Rejected: less flexible for dynamic filtering/search
- Command Palette → Rejected: poor for browsing large action lists
- Dropdown menu → Rejected: hard to navigate with many servers/actions
- **Tree view in webview** → SELECTED: flexible, searchable, familiar pattern

**Implementation Approach**:
- Create `mcp-action-picker.tsx` React component
- Use shadcn/ui tree component with search input
- Show servers as expandable parent nodes
- Show actions as child nodes with descriptions
- Emit selection events to extension host

---

## Technology Stack Summary

### Core Dependencies
- **VS Code Extension API**: Extension host, commands, state management
- **Existing Hooks Infrastructure**: types.ts, hook-executor.ts, hook-manager.ts
- **React + shadcn/ui**: Webview UI components
- **TypeScript**: Type-safe MCP server/action definitions

### New Components Required
- **MCPDiscoveryService**: Enumerate servers and tools
- **MCPClientService**: Execute tools with parameter mapping
- **MCPActionExecutor**: Integrate with hook execution pipeline
- **MCPActionPicker**: React component for server/action selection

### Testing Strategy
- **Unit Tests**: Service layer (discovery, client, executor) with mocked MCP responses
- **Integration Tests**: End-to-end hook execution with mock MCP servers
- **Manual Testing**: Real MCP servers (GitHub, Slack, etc.) in development

---

## Best Practices

### MCP Integration Patterns
- **Service Abstraction**: Isolate MCP-specific logic in services layer
- **Provider Pattern**: Use dependency injection for testability (following `GitHubClientProvider`)
- **Error Boundaries**: Graceful fallbacks when MCP servers unavailable
- **Caching**: Cache server/tool discovery results (5-minute TTL)

### VS Code Extension Patterns
- **Async Operations**: All MCP calls are async, use proper Promise handling
- **Progress Indicators**: Show progress for slow MCP actions
- **Error Notifications**: User-friendly error messages via VS Code notifications
- **State Persistence**: Use workspace state for hook configurations

### Hooks Module Patterns
- **Action Executor Interface**: Implement consistent executor interface like `GitHubActionExecutor`
- **Template Expansion**: Reuse `expandTemplate` utility for parameter values
- **Validation**: Add type guards for MCP action parameters (like `isValidGitHubParams`)

---

## Open Questions (Resolved)

All research questions have been resolved through analysis and clarification session:
1. ✅ MCP server discovery approach
2. ✅ Parameter mapping strategy
3. ✅ Timeout and concurrency limits
4. ✅ UI approach for action selection
5. ✅ Error handling for unavailable servers

---

## Next Steps

**Ready for Phase 1: Design & Contracts**

1. Create data model definitions (MCP Server, MCP Tool, MCP Action Config)
2. Define service interfaces (discovery, client, executor)
3. Generate TypeScript contract files for MCP integration
4. Update hook types to include MCP action type
5. Create quickstart guide for users
