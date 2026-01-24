# Research: Copilot Agents Integration

**Feature**: 010-copilot-agents  
**Date**: 2026-01-24  
**Status**: Complete

## Overview

This document consolidates research findings for integrating GitHub Copilot agents into the GatomIA VS Code extension. All technical decisions have been clarified through the specification refinement process.

---

## Research Topics

### 1. VS Code Chat Participant API

**Decision**: Use VS Code's `vscode.chat.createChatParticipant` API for agent registration

**Rationale**:
- Official VS Code API for integrating with GitHub Copilot Chat
- Provides built-in support for command handling, autocomplete, and participant metadata
- Enables seamless discovery in the chat participants dropdown
- Supports both global and workspace-scoped participants

**Alternatives considered**:
- Custom chat interface: Rejected due to poor UX and lack of integration with Copilot Chat
- Language Server Protocol (LSP): Rejected as it's designed for language features, not chat agents
- WebView-based chat: Rejected due to fragmented UX and duplication of Copilot Chat functionality

**API Key Patterns**:
```typescript
// Registration
const participant = vscode.chat.createChatParticipant(id, handler);
participant.iconPath = vscode.Uri.file('path/to/icon.png');

// Handler signature
handler(
  request: vscode.ChatRequest,
  context: vscode.ChatContext,
  stream: vscode.ChatResponseStream,
  token: vscode.CancellationToken
): Promise<void>
```

**References**:
- [VS Code Chat API Documentation](https://code.visualstudio.com/api/extension-guides/chat)
- [Chat Participant Sample](https://github.com/microsoft/vscode-extension-samples/tree/main/chat-sample)

---

### 2. Agent Definition Format (Markdown + YAML Frontmatter)

**Decision**: Store agent definitions as Markdown files with YAML frontmatter

**Rationale**:
- Human-readable and easy to edit
- YAML frontmatter provides structured metadata (id, name, commands, tools)
- Markdown body can contain agent documentation and usage examples
- Well-established pattern in static site generators and documentation tools
- Easy to parse with existing libraries (gray-matter, js-yaml)

**Alternatives considered**:
- JSON files: Rejected due to lack of documentation support and poor readability
- TypeScript files: Rejected as it couples agent definitions to code and requires compilation
- Custom YAML format: Rejected in favor of standard markdown + frontmatter pattern

**Example Agent Definition**:
```markdown
---
id: speckit
name: SpecKit
fullName: SpecKit Workflow Agent
description: Manages feature specifications and workflow automation
icon: resources/icons/speckit.png
commands:
  - name: specify
    description: Create or update feature specification
    tool: speckit.specify
  - name: plan
    description: Generate implementation plan
    tool: speckit.plan
resources:
  prompts: [speckit.specify.prompt.md, speckit.plan.prompt.md]
  skills: [spec-writing.skill.md]
  instructions: [speckit-behavior.instructions.md]
---

# SpecKit Agent

SpecKit helps you manage feature specifications using the Spec-Driven Development workflow.

## Commands

### /specify
Creates or updates a feature specification...
```

**References**:
- [gray-matter (frontmatter parser)](https://github.com/jonschlinkert/gray-matter)
- [YAML frontmatter convention](https://jekyllrb.com/docs/front-matter/)

---

### 3. Tool Execution Model

**Decision**: Register tools as TypeScript functions in VS Code extension, agents reference by name

**Rationale**:
- Type-safe implementation with full access to VS Code APIs
- Testable in isolation without requiring agent infrastructure
- Reusable across multiple agents
- Clear separation between agent metadata (markdown) and tool logic (TypeScript)
- Enables versioning and maintenance of tools independently from agent definitions

**Alternatives considered**:
- Dynamic script loading from resources/tools/: Rejected due to security concerns and lack of type safety
- Inline functions in agent files: Rejected due to lack of reusability and testability
- External MCP servers: Rejected as it adds deployment complexity for built-in tools

**Tool Registry Pattern**:
```typescript
interface ToolHandler {
  (params: {
    input: string;
    context: ToolExecutionContext;
    resources: AgentResources;
    token: vscode.CancellationToken;
  }): Promise<ToolResponse>;
}

class ToolRegistry {
  register(name: string, handler: ToolHandler): void;
  get(name: string): ToolHandler | undefined;
  execute(name: string, params: ToolExecutionParams): Promise<ToolResponse>;
}
```

**References**:
- [VS Code Extension API](https://code.visualstudio.com/api/references/vscode-api)
- [Command Registry Pattern](https://refactoring.guru/design-patterns/command)

---

### 4. Resource Loading Strategy

**Decision**: Load and cache all agent resources in memory on extension activation

**Rationale**:
- Eliminates I/O latency during tool execution (performance critical)
- Enables fast resource lookups by name or path
- Simplifies tool handler implementation (resources always available)
- File watchers enable hot-reload without full extension restart
- Memory overhead is negligible for text-based resources (~1-10MB typical)

**Alternatives considered**:
- On-demand loading: Rejected due to I/O delays during tool execution
- Lazy loading with LRU cache: Rejected as premature optimization (YAGNI)
- Direct file path access from tools: Rejected due to complexity and error-prone file handling

**Caching Strategy**:
```typescript
interface ResourceCache {
  prompts: Map<string, string>;
  skills: Map<string, string>;
  instructions: Map<string, string>;
  
  load(resourcesDir: string): Promise<void>;
  reload(changedFiles: string[]): Promise<void>;
  get(type: 'prompt' | 'skill' | 'instruction', name: string): string | undefined;
}
```

**File Watching**:
- Use `vscode.workspace.createFileSystemWatcher` for hot-reload
- Watch patterns: `resources/**/*.md`, `resources/**/*.prompt.md`, etc.
- Debounce reload to handle multiple rapid changes
- Log reload events for debugging

**References**:
- [VS Code File System Watcher API](https://code.visualstudio.com/api/references/vscode-api#FileSystemWatcher)

---

### 5. Parameter Parsing Strategy

**Decision**: Pass free-text strings to tool handlers for custom parsing

**Rationale**:
- Maximum flexibility for different tool types (some need structured args, others natural language)
- Aligns with AI-powered tools that work best with natural language input
- Simple implementation at the chat participant level (no complex parsing logic)
- Tools can use regex, split(), or natural language processing as needed
- Enables gradual enhancement (start simple, add structure if needed)

**Alternatives considered**:
- Structured parameters with validation: Rejected due to poor UX for natural language commands
- JSON object parsing: Rejected as it's unnatural for chat-based interaction
- Positional arguments: Rejected due to lack of flexibility and poor discoverability

**Parsing Patterns**:
```typescript
// Simple split-based parsing
function parseSimple(input: string): { command: string; args: string[] } {
  const parts = input.trim().split(/\s+/);
  return { command: parts[0], args: parts.slice(1) };
}

// Regex-based parsing with named groups
function parseWithOptions(input: string): { text: string; options: Record<string, string> } {
  const optionRegex = /--(\w+)=(\S+)/g;
  const options: Record<string, string> = {};
  let match;
  while ((match = optionRegex.exec(input)) !== null) {
    options[match[1]] = match[2];
  }
  const text = input.replace(optionRegex, '').trim();
  return { text, options };
}
```

**References**:
- [Command-line argument parsing patterns](https://www.gnu.org/software/libc/manual/html_node/Argument-Syntax.html)

---

### 6. Tool Response Format

**Decision**: Structured object with markdown content and optional file references

**Rationale**:
- Markdown enables rich formatting (code blocks, lists, tables, links) in chat
- File references enable direct navigation ("click to open file")
- Structured format allows for consistent rendering across all tools
- Extensible for future enhancements (progress, attachments, etc.)
- Aligns with VS Code chat participant API patterns

**Alternatives considered**:
- Plain text only: Rejected due to lack of formatting and poor UX
- VS Code ChatResponseStream only: Rejected as it couples tools to VS Code APIs
- JSON with structured data: Rejected as it's less natural for chat display

**Response Interface**:
```typescript
interface ToolResponse {
  content: string; // Markdown-formatted content
  files?: {
    uri: vscode.Uri;
    label?: string;
    action?: 'created' | 'modified' | 'deleted';
  }[];
  metadata?: {
    duration?: number;
    tokensUsed?: number;
    [key: string]: any;
  };
}
```

**References**:
- [VS Code Chat Response Stream API](https://code.visualstudio.com/api/references/vscode-api#ChatResponseStream)
- [Markdown Syntax Guide](https://www.markdownguide.org/basic-syntax/)

---

## Technology Stack Summary

| Component | Technology | Version | Purpose |
|-----------|------------|---------|---------|
| Language | TypeScript | 5.3+ | Extension code (strict mode) |
| Build Tool | esbuild | latest | Extension bundling |
| Testing | Vitest | 3.2+ | Unit & integration tests |
| YAML Parser | gray-matter | latest | Parse agent markdown frontmatter |
| File Watching | VS Code API | 1.84.0+ | Hot-reload agent resources |
| Chat Integration | VS Code Chat API | 1.84.0+ | Register agents as participants |
| Resource Storage | File System | N/A | Agent resources in `resources/` |
| Resource Cache | In-Memory Map | N/A | Fast resource lookups |

---

## Best Practices

### Agent Definition Files
- Keep agent metadata concise and descriptive
- Document all commands with examples in markdown body
- Use consistent naming: `<agent-id>.agent.md`
- Store in `resources/agents/` directory

### Tool Handlers
- Keep tool handlers focused and single-purpose
- Validate input parameters early (fail fast)
- Return detailed error messages in ToolResponse
- Log execution time and outcomes for telemetry
- Use async/await for all I/O operations

### Resource Management
- Bundle essential resources with extension
- Allow workspace overrides for customization
- Use file watchers for development hot-reload
- Log resource loading errors clearly

### Testing Strategy
- Unit test each component in isolation (loader, registry, cache)
- Integration test full agent workflow (load → register → execute)
- Mock VS Code APIs for faster test execution
- Test error cases (malformed files, missing resources, etc.)

---

## Open Questions / Future Considerations

None identified. All clarifications completed during specification refinement.

**Potential future enhancements** (not in scope for v1):
- Custom agent discovery from workspace `.gatomia/agents/`
- Agent marketplace/registry
- Streaming responses for long-running tools
- Multi-agent collaboration/workflows
- Agent-specific telemetry dashboard

---

## References

- [VS Code Extension API Documentation](https://code.visualstudio.com/api)
- [VS Code Chat API Guide](https://code.visualstudio.com/api/extension-guides/chat)
- [GitHub Copilot Chat Documentation](https://docs.github.com/en/copilot/using-github-copilot/using-github-copilot-chat)
- [TypeScript 5.3 Release Notes](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-3.html)
- [GatomIA Project Constitution](../../.specify/memory/constitution.md)
