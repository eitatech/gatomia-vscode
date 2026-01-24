# Quickstart: Copilot Agents Integration

**Feature**: 010-copilot-agents  
**Date**: 2026-01-24

## For Users

### Using Agents

1. **Open GitHub Copilot Chat**: `Ctrl+Shift+I`
2. **Type `@`** to see available agents
3. **Invoke**: `@speckit /specify create a login feature`
4. **View Results**: Markdown content + clickable file links

---

## For Developers

### Project Structure

```
src/features/agents/
├── agent-loader.ts           # Loads agent definitions
├── chat-participant-registry.ts  # Registers chat participants
├── tool-registry.ts          # Manages tool handlers
├── resource-cache.ts         # Caches resources
└── types.ts                  # TypeScript types

resources/agents/
└── *.agent.md                # Agent definition files
```

### Creating a New Agent

**1. Create Agent Definition** (`resources/agents/my-agent.agent.md`):

```markdown
---
id: my-agent
name: MyAgent
fullName: My Agent Description
description: What this agent does
commands:
  - name: do-something
    description: Performs action
    tool: my-agent.do-something
resources:
  prompts: [my-agent.prompt.md]
---

# MyAgent
Documentation here...
```

**2. Create Tool Handler** (`src/features/agents/tools/my-agent-tools.ts`):

```typescript
export const doSomethingTool: ToolHandler = async (params) => {
	const { input, context, resources } = params;
	
	// Implementation
	const fileUri = vscode.Uri.joinPath(context.workspace.uri, 'output.md');
	await vscode.workspace.fs.writeFile(fileUri, Buffer.from(content));

	return {
		content: `✅ Created: \`output.md\``,
		files: [{ uri: fileUri, action: 'created' }]
	};
};
```

**3. Register Tool** (`src/features/agents/tool-registry.ts`):

```typescript
registry.register('my-agent.do-something', doSomethingTool);
```

**4. Test**:

```typescript
describe('MyAgent', () => {
	it('should execute successfully', async () => {
		const response = await doSomethingTool(mockParams);
		expect(response.content).toContain('✅');
	});
});
```

---

## Key APIs

```typescript
// Load agents
const loader = new AgentLoader(extensionUri);
const agents = await loader.loadAgents();

// Register tool
registry.register('tool-name', async (params) => {
	return { content: 'Success' };
});

// Cache resources
const cache = new ResourceCache();
await cache.load(resourcesDir);
const prompt = cache.get('prompt', 'my-prompt.md');
```

---

## Debugging

1. **Output Channel**: View > Output > "GatomIA"
2. **Breakpoints**: Set in tool handler code
3. **Launch**: Press `F5` for Extension Development Host
4. **Test**: `npm test` or `npm run test:watch`

---

## Common Patterns

```typescript
// Parse input
const { action, target } = parseInput(input);

// File operations
await vscode.workspace.fs.readFile(uri);
await vscode.workspace.fs.writeFile(uri, Buffer.from(text));

// Progress reporting
vscode.window.withProgress({ ... }, async (progress) => {
	progress.report({ increment: 50, message: 'Processing...' });
});
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Agent not appearing | Check YAML frontmatter, view output channel |
| Tool execution fails | Verify tool registration, check logs |
| Resources not loading | Verify file paths, check resource cache logs |

---

## Next Steps

1. Read [data-model.md](./data-model.md)
2. Review [contracts/](./contracts/)
3. Follow [constitution](../../.specify/memory/constitution.md)
4. Write tests first (TDD)

---

## Resources

- [VS Code Chat API](https://code.visualstudio.com/api/extension-guides/chat)
- [GitHub Copilot Docs](https://docs.github.com/en/copilot)
- [Project Constitution](../../.specify/memory/constitution.md)
