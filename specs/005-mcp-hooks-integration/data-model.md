# Data Model: MCP Server Integration for Hooks

**Feature**: 005-mcp-hooks-integration  
**Phase**: 1 - Design & Contracts  
**Date**: December 5, 2025

## Overview

This document defines the core entities and their relationships for MCP server integration with the Hooks module.

## Core Entities

### 1. MCP Server

Represents a Model Context Protocol server configured in the user's Copilot environment.

**Attributes**:
- `id`: string (unique identifier, format determined by Copilot)
- `name`: string (display name, e.g., "GitHub MCP", "Slack MCP")
- `description`: string (optional, describes server capabilities)
- `status`: ServerStatus (available | unavailable | unknown)
- `tools`: MCPTool[] (list of available actions/tools provided by this server)
- `lastDiscovered`: number (Unix timestamp when server was last detected)

**Validation Rules**:
- `id` must be non-empty string
- `name` must be non-empty string, max 100 characters
- `status` must be valid ServerStatus enum value
- `tools` must be array (can be empty if server provides no tools)
- `lastDiscovered` must be positive number

**State Transitions**:
- available → unavailable (server becomes unreachable)
- unavailable → available (server comes back online)
- unknown → available (server detected for first time)

---

### 2. MCP Tool

Represents a specific action or capability provided by an MCP server.

**Attributes**:
- `name`: string (unique identifier for the tool, e.g., "search_repository")
- `displayName`: string (human-readable name, e.g., "Search Repository")
- `description`: string (what the tool does)
- `inputSchema`: JSONSchema (parameter definition in JSON Schema format)
- `serverId`: string (reference to parent MCP Server)

**Validation Rules**:
- `name` must be non-empty string, alphanumeric + underscore only
- `displayName` must be non-empty string, max 100 characters
- `description` must be string (can be empty)
- `inputSchema` must be valid JSON Schema object
- `serverId` must reference existing MCP Server

**Relationships**:
- **Belongs to** one MCP Server (many-to-one)
- **Referenced by** zero or more Hook Configurations (one-to-many)

---

### 3. MCP Action Configuration

Represents a hook action that executes an MCP tool (extends existing `ActionConfig` type).

**Attributes**:
- `type`: "mcp" (action type discriminator)
- `parameters`: MCPActionParams (MCP-specific parameters)

**MCPActionParams Structure**:
- `serverId`: string (which MCP server to use)
- `toolName`: string (which tool to invoke)
- `parameterMappings`: ParameterMapping[] (how to map hook context to tool parameters)
- `timeout`: number (optional, override default 30s timeout)

**ParameterMapping Structure**:
- `toolParam`: string (parameter name in MCP tool's input schema)
- `source`: ParameterSource (where to get the value)
- `value`: string (template string or literal value)

**ParameterSource Types**:
- `"context"`: Use value from hook template context (feature, branch, timestamp, user)
- `"literal"`: Use literal string value
- `"template"`: Expand template string with context variables

**Validation Rules**:
- `serverId` must reference existing MCP Server
- `toolName` must exist in referenced server's tools list
- `parameterMappings` must cover all required parameters from tool's input schema
- `timeout` must be positive number between 1000-300000ms (1s-5min)

---

### 4. MCP Discovery Cache

Stores cached MCP server/tool information to avoid repeated discovery calls.

**Attributes**:
- `servers`: MCPServer[] (cached list of servers)
- `lastUpdated`: number (Unix timestamp of last discovery)
- `ttl`: number (time-to-live in milliseconds, default 300000 = 5 minutes)

**Cache Invalidation**:
- Automatic after TTL expires
- Manual when user requests refresh
- On Copilot configuration change (if detectable)

---

### 5. MCP Execution Context

Extends existing `ExecutionContext` with MCP-specific tracking.

**Additional Attributes**:
- `mcpServerStatus`: Map<serverId, ServerStatus> (server availability snapshot)
- `parameterResolutions`: Map<toolParam, resolvedValue> (actual parameter values used)

---

## Entity Relationships

```
MCP Server (1) ─────── (many) MCP Tool
     ↑                           ↑
     │                           │
     │                           │
     └─────────── (references) ──┘
              Hook Configuration
              (with MCP Action)
```

---

## Data Flows

### Discovery Flow
1. User opens hook configuration UI
2. System checks discovery cache for freshness
3. If stale or empty, query Copilot for available MCP servers
4. For each server, query available tools
5. Store in cache with timestamp
6. Return cached data to UI

### Parameter Mapping Flow
1. Hook trigger event occurs
2. System builds template context (feature, branch, etc.)
3. Load MCP Action Configuration
4. For each parameter mapping:
   - If source="context", extract from template context
   - If source="literal", use value as-is
   - If source="template", expand template with context
5. Validate resolved parameters against tool's input schema
6. Execute tool with resolved parameters

### Execution Flow
1. Hook executor receives MCP action
2. Check server availability in cache
3. If unavailable, log error and skip (don't fail hook)
4. If available, invoke tool via MCP client
5. Apply timeout (30s default or configured value)
6. Handle success/failure/timeout
7. Update execution log with results

---

## Extension to Existing Types

### Update to `ActionType` (in types.ts)
```typescript
export type ActionType =
  | "agent"
  | "git"
  | "github"
  | "mcp"     // NEW: MCP tool execution
  | "custom";
```

### Update to `ActionParameters` (in types.ts)
```typescript
export type ActionParameters =
  | AgentActionParams
  | GitActionParams
  | GitHubActionParams
  | MCPActionParams  // NEW
  | CustomActionParams;
```

### New Type Definitions (to add to types.ts)
```typescript
export interface MCPActionParams {
  serverId: string;
  toolName: string;
  parameterMappings: ParameterMapping[];
  timeout?: number; // Optional override, defaults to 30000ms
}

export interface ParameterMapping {
  toolParam: string;
  source: "context" | "literal" | "template";
  value: string;
}

export type ServerStatus = "available" | "unavailable" | "unknown";

export interface MCPServer {
  id: string;
  name: string;
  description?: string;
  status: ServerStatus;
  tools: MCPTool[];
  lastDiscovered: number;
}

export interface MCPTool {
  name: string;
  displayName: string;
  description: string;
  inputSchema: JSONSchema;
  serverId: string;
}

export interface JSONSchema {
  type: string;
  properties?: Record<string, JSONSchemaProperty>;
  required?: string[];
}

export interface JSONSchemaProperty {
  type: string;
  description?: string;
  enum?: unknown[];
  default?: unknown;
}
```

---

## Type Guards (to add to types.ts)

```typescript
export function isValidMCPParams(obj: unknown): obj is MCPActionParams {
  if (typeof obj !== "object" || obj === null) return false;
  const params = obj as MCPActionParams;
  
  return (
    typeof params.serverId === "string" &&
    params.serverId.length > 0 &&
    typeof params.toolName === "string" &&
    params.toolName.length > 0 &&
    Array.isArray(params.parameterMappings) &&
    params.parameterMappings.every(isValidParameterMapping) &&
    (params.timeout === undefined ||
      (typeof params.timeout === "number" &&
        params.timeout >= 1000 &&
        params.timeout <= 300000))
  );
}

export function isValidParameterMapping(obj: unknown): obj is ParameterMapping {
  if (typeof obj !== "object" || obj === null) return false;
  const mapping = obj as ParameterMapping;
  
  const validSources = ["context", "literal", "template"];
  
  return (
    typeof mapping.toolParam === "string" &&
    mapping.toolParam.length > 0 &&
    typeof mapping.source === "string" &&
    validSources.includes(mapping.source) &&
    typeof mapping.value === "string"
  );
}

export function isValidMCPServer(obj: unknown): obj is MCPServer {
  if (typeof obj !== "object" || obj === null) return false;
  const server = obj as MCPServer;
  
  const validStatuses: ServerStatus[] = ["available", "unavailable", "unknown"];
  
  return (
    typeof server.id === "string" &&
    server.id.length > 0 &&
    typeof server.name === "string" &&
    server.name.length > 0 &&
    server.name.length <= 100 &&
    typeof server.status === "string" &&
    validStatuses.includes(server.status) &&
    Array.isArray(server.tools) &&
    typeof server.lastDiscovered === "number" &&
    server.lastDiscovered > 0
  );
}

export function isValidMCPTool(obj: unknown): obj is MCPTool {
  if (typeof obj !== "object" || obj === null) return false;
  const tool = obj as MCPTool;
  
  return (
    typeof tool.name === "string" &&
    tool.name.length > 0 &&
    /^[a-zA-Z0-9_]+$/.test(tool.name) &&
    typeof tool.displayName === "string" &&
    tool.displayName.length > 0 &&
    tool.displayName.length <= 100 &&
    typeof tool.description === "string" &&
    typeof tool.inputSchema === "object" &&
    tool.inputSchema !== null &&
    typeof tool.serverId === "string" &&
    tool.serverId.length > 0
  );
}
```

---

## Constants (to add to types.ts)

```typescript
// MCP-specific limits
export const MCP_DISCOVERY_CACHE_TTL = 300000; // 5 minutes
export const MCP_DEFAULT_TIMEOUT = 30000; // 30 seconds
export const MCP_MIN_TIMEOUT = 1000; // 1 second
export const MCP_MAX_TIMEOUT = 300000; // 5 minutes
export const MCP_MAX_CONCURRENT_ACTIONS = 5; // Concurrency pool size
export const MAX_SERVER_NAME_LENGTH = 100;
export const MAX_TOOL_NAME_LENGTH = 100;
```

---

## Summary

This data model extends the existing hooks infrastructure with:
- 5 new entity types (MCPServer, MCPTool, MCPActionParams, ParameterMapping, JSONSchema)
- 1 cache entity (MCPDiscoveryCache)
- 4 new type guards for validation
- 6 new constants for limits
- Extension of existing ActionType and ActionParameters unions

All entities follow existing patterns from `github-action.ts` and integrate seamlessly with the current hooks architecture.
