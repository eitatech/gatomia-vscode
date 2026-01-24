# Demo Video Script & Guide

**Title**: "Copilot Agents Integration - GatomIA v0.31.0"

**Duration**: 5-7 minutes

**Target Audience**: Developers, Project Managers, VS Code users

---

## Pre-Production

### Equipment Needed

- Screen recording software: OBS, Camtasia, or ScreenFlow
- Microphone: Built-in or dedicated
- Video editor: Minimal – just screen recording and voiceover
- VS Code with GatomIA extension installed
- Terminal/command line

### Recording Settings

```
Resolution: 1920×1080 (1080p)
Frame rate: 30 FPS
Audio: 44.1 kHz, Stereo
Bitrate: 5000 kbps (streaming quality)
```

### Setup

1. **Close unnecessary applications** to reduce clutter
2. **Set VS Code to light theme** for better visibility on video
3. **Increase font size** to 16pt minimum for readability
4. **Create sample project** with agents pre-configured
5. **Test microphone** levels
6. **Enable zoom function** in screen recording software

---

## Demo Script

### Part 1: Introduction (0:00-0:45)

**Visual**: Title card with GatomIA logo

**Voiceover Script**:

> "Welcome to GatomIA v0.31.0 – the Agentic Spec-Driven Development Toolkit for VS Code.
>
> Today, we're exploring the brand new Copilot Agents Integration feature, which brings
> powerful agent capabilities directly into GitHub Copilot Chat.
>
> Whether you're managing project specifications, automating workflows, or coordinating
> development tasks, agents make it easier than ever.
>
> Let's dive in."

**[Pause 3 seconds]**

---

### Part 2: Agent Discovery (0:45-1:30)

**Visual Actions**:
1. Show VS Code with GatomIA extension installed
2. Open file explorer showing `resources/agents/` directory
3. Display agent files: `example-agent.agent.md`, `speckit.agent.md`, etc.
4. Open one agent file to show YAML frontmatter structure

**Voiceover Script**:

> "Agents in GatomIA are defined as simple markdown files in the `resources/agents/` directory.
>
> Each agent includes metadata like ID, name, description, and commands – all configure using YAML frontmatter.
>
> When you start VS Code, GatomIA automatically discovers these agent definitions
> and registers them with GitHub Copilot Chat.
>
> No complex setup needed – just drop your agents in the resources directory and you're ready to go."

**[Show README.md from resources/agents/ directory]**

> "The example agents include detailed documentation showing best practices for creating your own."

---

### Part 3: Accessing Agents in Copilot (1:30-2:45)

**Visual Actions**:
1. Open GitHub Copilot Chat (Ctrl+Shift+I)
2. Type `@` to show agent suggestions
3. Show agent list with descriptions
4. Type `@example-agent` to select an agent
5. Show autocomplete suggestions for commands

**Voiceover Script**:

> "To use agents, simply open GitHub Copilot Chat with Ctrl+Shift+I or Cmd+Shift+I on Mac.
>
> Type `@` to see all available agents. The agent list appears instantly, showing each agent's name,
> icon, and description.
>
> [Pause while showing agent selection]
>
> Once you select an agent, you can see all available commands. For example, the Example Agent
> provides `/hello` and `/help` commands.
>
> You can also type `/help` to get detailed documentation about any agent:
> what it does, what commands it supports, and how to use them effectively."

**[Demonstrate typing different commands]**

> "The beautiful part? All of this works seamlessly within Copilot Chat. No context switching needed."

---

### Part 4: Executing Agent Commands (2:45-4:00)

**Visual Actions**:
1. Execute command: `@example-agent /hello World`
2. Show response appearing in chat
3. Execute help command: `@example-agent /help`
4. Show help documentation displayed in chat
5. Demonstrate trying @speckit agent if available

**Voiceover Script**:

> "Let's execute an agent command. I'll type @example-agent /hello World
>
> [Wait for response]
>
> As you can see, the agent executes immediately and returns a markdown-formatted response.
> The response includes information, examples, and even links to documentation.
>
> Behind the scenes, GatomIA is doing several things:
> - Loading the agent definition from the resources directory
> - Executing the registered tool handler with your input
> - Formatting the response as markdown
> - Streaming it back to you in real-time
>
> Let's try the help command:"

**[Type and execute /help]**

> "The /help command is built-in for every agent. It shows all available commands
> with descriptions, helping users discover what the agent can do."

**[If available, demonstrate a real agent]**

> "For a more practical example, here's the SpecKit Agent – a real agent that handles
> specification generation and task planning for your projects.
>
> It works the same way: you provide input, the agent processes it, and returns results."

---

### Part 5: Configuration & Customization (4:00-5:15)

**Visual Actions**:
1. Open VS Code Settings (Cmd+, or Ctrl+,)
2. Search for "GatomIA Agents"
3. Show settings:
   - `resourcesPath`
   - `enableHotReload`
   - `logLevel`
4. Explain each setting
5. Show extension output channel for debugging

**Voiceover Script**:

> "GatomIA Agents are highly configurable through VS Code settings.
>
> [Point to settings as you explain]
>
> **resourcesPath**: Specify where your agents and resources are stored. Default is 'resources'.
>
> **enableHotReload**: When enabled, resource files are automatically reloaded when you save changes.
> No need to restart VS Code – changes take effect immediately.
>
> **logLevel**: Control logging verbosity for debugging. Choose from debug, info, warn, or error.
>
> For troubleshooting, check the GatomIA output channel to see what's happening behind the scenes.
> All agent discovery, tool registration, and execution events are logged here."

**[Show output channel with messages like "Loaded 3 agents", "Tool registered"]**

---

### Part 6: Advanced: Custom Agents (5:15-6:30)

**Visual Actions**:
1. Show `src/features/agents/tools/example-tool-handler.ts`
2. Scroll through tool handler code
3. Show how it's registered in agent service
4. Point out key patterns: async/await, error handling, return format

**Voiceover Script**:

> "Creating custom agents is straightforward. You define:
>
> 1. **Agent definition**: A markdown file with YAML frontmatter
> 2. **Tool handlers**: Functions that implement your agent's commands
>
> Tool handlers follow this pattern:
> - Accept parameters including user input and agent context
> - Implement your logic
> - Return a structured response with markdown content
>
> GatomIA provides comprehensive error handling, resource access, and telemetry support.
>
> You can access agent resources like prompts and skills, execute VS Code commands,
> and return structured results that display beautifully in Copilot Chat.
>
> See the [Architecture Guide](../../src/features/agents/README.md) for complete details."

**[Show architecture diagram from README if available]**

---

### Part 7: Benefits & Wrap-Up (6:30-7:00)

**Visual**: GatomIA logo with key benefits

**Voiceover Script**:

> "The Copilot Agents Integration brings several key benefits:
>
> ✅ **Automated Discovery**: Agents are discovered and registered automatically
> ✅ **Zero Configuration**: Works out of the box with sensible defaults  
> ✅ **Extensible**: Create custom agents tailored to your workflow
> ✅ **Integrated**: Works seamlessly within Copilot Chat – no popup windows or context switching
> ✅ **Production-Ready**: Comprehensive error handling, telemetry, and resource management
> ✅ **Well-Documented**: Complete examples and architecture guides included
>
> Whether you're an individual developer or part of a large team,
> GatomIA Agents help you work smarter and faster.
>
> Get started today by installing GatomIA from the VS Code Marketplace.
>
> Thanks for watching!"

**[Show call-to-action: "Install from VS Code Marketplace"]**

---

## Production Notes

### Screen Recording

- **Location**: Entire screen (not just VS Code window)
- **Lighting**: Ensure terminal text is readable
- **Mouse**: Keep cursor visible but don't move unnecessarily
- **Typing speed**: Type at normal pace – editing in post is okay if needed
- **Pauses**: Add 1-2 second pause after each action for viewers to process

### Common Recording Mistakes to Avoid

❌ Moving mouse too much – distracts viewers

❌ Typing too fast – hard to follow

❌ Unclear terminal text – use larger fonts

❌ Background noise – use quiet environment

❌ No pauses – viewers can't read screen in time

✅ Deliberate, purposeful actions

✅ Clear narration with pauses

✅ Large, readable fonts (16pt minimum)

✅ Focus on what matters – close other windows

✅ Professional tone – conversational but authoritative

### Audio Recording

- **Microphone placement**: 6-8 inches from mouth
- **Volume level**: -6dB on meter during speaking
- **Narration script**: Read naturally, not robotic
- **Pacing**: Clear pronunciation, reasonable speed
- **Background**: Quiet room, no background music (except as theme)

### Editing Tips

**Intro**:
```
- Blue color overlay (GatomIA branding)
- Company logo centered
- Fade in with music
- Duration: 3 seconds
```

**Transitions**:
```
- Simple fade between sections
- Avoid fancy transitions – stay professional
- Keep transitions brief (0.5 seconds)
```

**Outro**:
```
- List of resources with links
- Call-to-action: "Install Now"
- Subscribe button overlay
- End screen with related videos
```

**Captions**:
```
- Generated automatically or professionally edited
- Include code snippets and command names
- Time-code to narration
- Font: White text, 18pt minimum
```

---

## Distribution

### Platforms

1. **YouTube**
   - Description with timestamps and links
   - Tags: GatomIA, VS Code, GitHub Copilot, Agents
   - Thumbnail: Clear and compelling

2. **GitHub**
   - Embed in README.md
   - Include link in Quick Start section
   - Link from release notes

3. **Documentation**
   - Embed in getting started guide
   - Link from feature documentation
   - Include in release announcement

### YouTube Description Template

```
Copilot Agents Integration - GatomIA v0.31.0

In this video, we explore the brand new Copilot Agents Integration feature
in GatomIA, a VS Code extension for Agentic Spec-Driven Development.

Learn how to:
✅ Discover and register agents automatically
✅ Use agents in GitHub Copilot Chat
✅ Execute agent commands and access results
✅ Configure agent behavior through settings
✅ Create custom agents for your workflow

Timestamps:
0:00 Introduction
0:45 Agent Discovery
1:30 Accessing Agents in Copilot
2:45 Executing Commands
4:00 Configuration
5:15 Custom Agents
6:30 Benefits & Wrap-up

Resources:
📖 Extension: https://marketplace.visualstudio.com/items?itemName=EITA.gatomia
📚 Documentation: https://github.com/eitatech/gatomia-vscode
🔧 Architecture Guide: https://github.com/eitatech/gatomia-vscode/tree/main/src/features/agents
📋 Migration Guide: https://github.com/eitatech/gatomia-vscode/blob/main/MIGRATION_GUIDE.md

Related Videos:
- GatomIA Quick Start Guide
- Spec-Driven Development with SpecKit
- VS Code Extension Development

#GatomIA #VSCode #GitHubCopilot #Development
```

### Social Media Posts

**Twitter/X**:
```
🎬 NEW VIDEO: Copilot Agents Integration in GatomIA v0.31.0

Discover how to:
✅ Auto-discover agents in VS Code
✅ Execute commands in Copilot Chat
✅ Build custom agents for your workflow

Watch: [YouTube link]
Code: [GitHub link]

#VSCode #GitHubCopilot #Development
```

**LinkedIn**:
```
Excited to announce the Copilot Agents Integration in GatomIA v0.31.0!

This powerful feature brings agent capabilities directly into GitHub Copilot Chat,
enabling teams to automate workflows and coordinate development tasks more effectively.

In our new video, we walk through:
- Agent discovery and registration
- Executing commands in Copilot Chat
- Configuration and customization
- Creating custom agents

Learn more: [links]
```

---

## Post-Production Checklist

Before publishing:

- [ ] Audio levels consistent throughout
- [ ] No background noise or hums
- [ ] Screen text fully readable
- [ ] No typos in on-screen text
- [ ] Color correction applied if needed
- [ ] Captions synced with audio
- [ ] All links in description work
- [ ] Timestamps in description are accurate
- [ ] Thumbnail is clear and compelling
- [ ] Title is descriptive and SEO-friendly
- [ ] Video plays smoothly (no stuttering)
- [ ] Audio is not clipped (no distortion)

---

## Analytics & Followup

### Metrics to Track

- Views per day/week/month
- Watch time (average duration watched)
- Click-through rate on links
- Comments and feedback
- Shares across social media

### Engagement Strategy

- Respond to comments within 24 hours
- Answer questions about feature usage
- Direct users to documentation for deep dives
- Gather feedback for future videos
- Pin helpful comments

### Content Series Ideas

Based on this demo, consider follow-up videos:

1. "Creating Custom Agents - Step by Step"
2. "Automating Workflows with Agents"
3. "Performance Optimization for Large Agent Sets"
4. "Real-World Agent Examples"
5. "Troubleshooting Common Issues"

---

## Accessibility for Video

- ✅ Captions for all dialogue
- ✅ Audio descriptions for visual elements
- ✅ High contrast text on screen
- ✅ Clear, readable fonts
- ✅ No color-only information conveyance
- ✅ No rapid flashing (would be distracting anyway)

---

**Last Updated**: January 24, 2026  
**Status**: ✅ Ready for Recording  
**Estimated Production Time**: 2-4 hours (recording + editing)
