---
id: example-agent
name: Example Agent
fullName: Example Agent for Testing
description: A simple example agent to test the agent integration system
icon: resources/icons/example.png
commands:
  - name: hello
    description: Say hello to the user
    tool: example.hello
  - name: help
    description: Show available commands
    tool: example.help
resources:
  prompts: [example.prompt.md]
  skills: [example.skill.md]
  instructions: [example.instructions.md]
---

# Example Agent

This is an example agent that demonstrates the agent integration system.

## Commands

### /hello

Says hello to the user.

**Usage**: `@example-agent /hello`

**Example**:
```
@example-agent /hello
> Hello! I'm the Example Agent. How can I help you today?
```

### /help

Shows all available commands for this agent.

**Usage**: `@example-agent /help`

## Resources

This agent uses the following resources:

- **Prompts**: `example.prompt.md` - Template prompts for responses
- **Skills**: `example.skill.md` - Domain knowledge and capabilities  
- **Instructions**: `example.instructions.md` - Behavior guidelines

## Implementation Notes

This agent is provided as an example for testing the agent integration system. In production, you would implement actual tool handlers for the commands defined above.

Tool handlers should be registered in the ToolRegistry and linked to the command names specified in the YAML frontmatter.
