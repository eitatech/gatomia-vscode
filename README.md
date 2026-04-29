# GatomIA (Agentic Spec-Driven Development Toolkit)

[![Visual Studio Marketplace](https://img.shields.io/vscode-marketplace/v/EITA.gatomia.svg?style=flat-square)](https://marketplace.visualstudio.com/items?itemName=EITA.gatomia)
[![Downloads](https://img.shields.io/vscode-marketplace/d/EITA.gatomia.svg?style=flat-square)](https://marketplace.visualstudio.com/items?itemName=EITA.gatomia)
[![GitHub stars](https://img.shields.io/github/stars/eitatech/gatomia-vscode.svg?style=flat-square)](https://github.com/eitatech/gatomia-vscode/stargazers)
[![GitHub issues](https://img.shields.io/github/issues/eitatech/gatomia-vscode.svg?style=flat-square)](https://github.com/eitatech/gatomia-vscode/issues)

GatomIA is a VS Code extension for agentic, spec-driven development with
first-class support for **SpecKit**, **OpenSpec**, **GitHub Copilot**, ACP
providers, workflow automation, and repository documentation.

It gives you a single workspace for authoring specs, reviewing changes,
previewing and refining documents, managing prompts/agents/skills, automating
work with hooks, and delegating implementation to local or cloud agents.

---

## Current Project Status

This project is under **continuous development**. Some features may still exhibit unexpected behavior, contain bugs, or be only partially implemented.

**Bug reports, suggestions, and general feedback are highly appreciated!** They play a crucial role in helping us stabilize and improve the extension.

We are actively working on:

* **Stabilizing all existing features**
* **Implementing the upcoming functionalities from our roadmap**
* **Improving overall reliability and user experience**

You can follow our progress, open issues, or contribute directly through our official repository:

**[https://github.com/eitatech/gatomia-vscode/issues](https://github.com/eitatech/gatomia-vscode/issues)**

## Features

### Views at a glance

| View | Purpose |
| --- | --- |
| **Specs** | Create specs, inspect review state, open documents in preview, and run tasks locally or on cloud agents. |
| **Actions** | Manage prompts, agents, skills, scripts, templates, and bundled SpecKit resources from one tree. |
| **Steering** | Maintain project/user instruction rules, constitutions, and global resource access policies. |
| **Hooks** | Create automations that react to SpecKit/OpenSpec operations and external tool events. |
| **Repo Wiki** | Browse and synchronize `docs/` content directly from the sidebar. |
| **Cloud Agents** | Track provider-backed sessions, task progress, external links, and pull requests. |
| **Running Agents** | Manage live ACP/Agent Chat sessions, recent runs, and orphaned worktrees. |
| **Quick Access** | Jump to spec system selection, settings, MCP config, dependency setup, and help. |

### Spec authoring, execution, and review

- **Multi-system support**: Work with **SpecKit** or **OpenSpec**, or let the
  extension auto-detect the active system.
- **Spec creation**: Run `GatomIA: Create New Spec` to capture summary, product
  context, and constraints, then open a ready-to-send prompt in chat.
- **Task execution**: Run individual tasks, task groups, or an entire spec from
  the **Specs** tree.
- **Cloud delegation**: Dispatch a task group or full spec to a configured
  cloud provider.
- **Review lifecycle**: Specs move through `current -> review -> reopened ->
  archived`, with unarchive support for previously completed work.
- **Change requests**: Track reviewer feedback, archival blockers, linked tasks,
  and pending review work directly inside the spec explorer.
- **Review metadata**: The extension tracks pending tasks/checklist items so
  review state stays synchronized with the underlying documents.

### Document preview and refinement

- **Rich preview panel**: Open spec, plan, task, research, checklist, and code
  files in a read-only preview webview.
- **Markdown and code support**: Markdown documents are parsed into sections and
  metadata; non-markdown files are rendered with syntax-aware code previews.
- **Frontmatter-powered forms**: Preview documents can surface structured forms
  and persist their submissions.
- **Outdated document detection**: Dependency changes can mark a document as
  stale so you know when downstream docs need attention.
- **In-place refinement requests**: Send review findings from the preview panel
  to the right workflow command (`/speckit.specify`, `/speckit.plan`,
  `/speckit.tasks`, `/speckit.research`, `/speckit.checklist`, or
  `/speckit.clarify`).
- **Editor handoff**: Jump from preview back to the source document when you
  want to edit the file directly.

### Actions, prompts, agents, and resources

- **Unified Actions explorer**: Browse project prompts, agents, skills,
  scripts, templates, and the repository's SpecKit assets in one place.
- **Create built-in resources**: Create agents, skills, and Copilot prompts
  directly from the tree view.
- **Run and maintain prompts**: Execute runnable prompts from the explorer, then
  rename or delete them from context menus.
- **Copilot agent integration**: Discover agent resources from the configured
  resource path, hot-reload updates, and expose built-in help for agent
  commands.
- **Configurable resource loading**: Set the resource root, enable/disable
  hot-reload, and tune agent log verbosity.

### Steering and governance

- **Project and user rules**: Manage `.github/instructions/*.instructions.md`
  and `$HOME/.github/instructions/*.instructions.md` guidance from the
  **Steering** view.
- **Constitution support**: Generate and maintain SpecKit constitutions or
  OpenSpec-style steering documents.
- **Global resource access control**: Decide whether workspace sessions can read
  global Copilot resources from your home directory.
- **Custom instruction injection**: Append reusable instructions globally or for
  create-spec, task-start, and run-prompt flows.

### Hooks and workflow automation

- **Before/after triggers**: Fire hooks before or after SpecKit/OpenSpec
  operations, with optional blocking before-execution behavior.
- **Supported operations**: Automate around research, data model, design,
  specify, clarify, plan, tasks, tasks-to-issues, analyze, checklist,
  constitution, implementation, unit-test, and integration-test flows.
- **Multiple action types**: Hooks can trigger agent, git, GitHub, MCP, custom,
  or ACP actions.
- **Output-aware templates**: Use `$agentOutput`, `$clipboardContent`, and
  `$outputPath` in action arguments and message templates.
- **ACP-aware setup**: Discover local ACP agents, known-agent integrations, and
  available models from the Hooks UI.
- **Operational tooling**: Add, edit, enable, disable, delete, export, import,
  and inspect hook logs from the sidebar.

### Chat providers, running agents, and cloud sessions

- **Provider routing**: `gatomia.chat.provider` can route extension prompts
  through GitHub Copilot Chat, Devin, Gemini, or auto-select based on host.
- **ACP session modes**: Choose workspace-scoped, per-spec, or per-prompt ACP
  sessions depending on how much context sharing you want.
- **Permission policy**: Control the default answer for ACP tool permission
  prompts and optionally enable verbose ACP logging.
- **Running Agents view**: Start new agent chat sessions, reopen active/recent
  sessions, inspect lifecycle state, and clean up orphaned worktrees.
- **Cloud Agents view**: Select a provider, monitor task and PR progress, open
  provider URLs, cancel active sessions, and remove old entries from the list.
- **Provider discovery**: Re-probe ACP providers, switch providers, and open
  the ACP output channel from commands or context menus.

### Host-aware routing

- **Supported hosts**: GatomIA detects VS Code, VS Code Insiders, Cursor,
  Windsurf, Antigravity, VSCodium, and Positron.
- **Smart defaults**: In `auto` mode, prompt routing adapts to the current host:
  Windsurf prefers Devin CLI via ACP, Antigravity prefers Gemini CLI via ACP,
  and the other supported editors default to GitHub Copilot Chat.
- **Remote-aware ACP behavior**: ACP-only routing is disabled in remote
  environments where the extension host cannot spawn the required local CLI
  subprocesses.

### Devin integration

- **Task delegation**: Run a single task or all incomplete tasks with Devin.
- **Progress tracking**: Open the dedicated Devin progress view/panel and cancel
  active sessions when needed.
- **Credential management**: Configure Devin API credentials from within VS
  Code.
- **Git-aware launch**: Task submission validates branch/repository state before
  starting a remote implementation run.
- **Cloud compatibility**: Devin is also available as a selectable cloud-agent
  provider for broader session tracking workflows.

### Repo Wiki and documentation sync

- **`docs/` explorer**: Browse markdown documents in `docs/` with folder-aware
  grouping and titles inferred from frontmatter, headings, or filenames.
- **Document operations**: Open documents, refresh the tree, show the table of
  contents, update individual docs, or synchronize the full wiki.
- **Status feedback**: Bulk synchronization surfaces progress, completion, and
  failure counts in the sidebar.

### Welcome screen and onboarding

- **Guided setup**: A first-run welcome screen introduces the extension and can
  be reopened anytime with `GatomIA: Show Welcome Screen`.
- **Dependency detection**: Checks GitHub Copilot Chat, Copilot CLI, SpecKit,
  OpenSpec, and related prerequisites.
- **Install assistance**: Provides install steps, prerequisite hints, and quick
  actions for missing tools.
- **Configuration editing**: Update core spec-system settings directly from the
  welcome experience.
- **Learning resources**: Surface documentation, examples, tutorials, and
  curated links inside the extension, organized into **Getting Started**,
  **Advanced Features**, and **Troubleshooting** categories.
- **Diagnostics**: Show recent setup and runtime issues in a single onboarding
  surface.

### Migration

- **Migrate to SpecKit**: Move OpenSpec-style repositories to SpecKit with the
  built-in migration command.
- **Guideline import**: Generate a constitution from existing guidance and
  create a backup during migration flows.

## Installation

### Prerequisites

* Visual Studio Code 1.84.0 or newer
* **[GitHub Copilot Chat](https://marketplace.visualstudio.com/items?itemName=GitHub.copilot-chat)**
  for the default prompt-routing and spec-generation experience
* GitHub Copilot CLI:

  ```shell
  npm install -g @github/copilot
  ```

* Optional ACP providers if you want local agent routing beyond Copilot Chat:
  Devin CLI and/or Gemini CLI
* Optional cloud-agent credentials if you want remote execution with Devin or
  other configured providers

### [SpecKit](https://github.com/github/spec-kit)

1. Install the Specify CLI globally:

   ```shell
   uv tool install specify-cli --from git+https://github.com/github/spec-kit.git
   ```

2. Initialize SpecKit in your project:

   ```shell
   specify init --here --ai copilot

   ```

### [OpenSpec](https://github.com/fission-ai/openspec)

If you prefer OpenSpec:

1. Install the CLI globally:

   ```shell
   npm install -g @fission-ai/openspec@latest
   ```

2. Initialize in your project:

   ```shell
   openspec init
   ```

### [GatomIA CLI](https://github.com/eitatech/gatomia-cli)

After the prerequisites are installed, install GatomIA CLI:

```shell
uv tool install gatomia --from git+https://github.com/eitatech/gatomia-cli.git
```

Configure GitHub Copilot as the default provider:

```shell
gatomia config set --llm-provider copilot --main-model gpt-4
```

If your environment uses the `mia` alias, use `mia config set ...` with the same options.

### Marketplace

Search for "GatomIA" in the VS Code Marketplace and install the extension.

### From Local VSIX

1. Build the package with `npm run package` (produces `gatomia-<version>.vsix`).
2. Install via `code --install-extension gatomia-<version>.vsix`.

## Usage

### 1. Set up the workspace

1. Open **GatomIA: Show Welcome Screen** on first launch or from the command
   palette.
2. Install or verify prerequisites from the welcome screen.
3. Choose the active spec system from **Quick Access** or Settings.
4. Configure optional chat/cloud providers if you want ACP or remote execution.

### 2. Create and manage specs

1. Open the **Specs** view in the Activity Bar.
2. Click **Create New Spec**.
3. Provide the summary, product context, and constraints.
4. GatomIA opens a generated prompt in chat to create the spec files.
5. Browse the generated documents in the **Specs** tree.

### 3. Execute work locally or on cloud agents

1. Use inline actions in **Specs** to run a task, task group, or full spec.
2. Use **Run on Cloud** / **Run Full Spec on Cloud** to delegate execution to a
   configured provider.
3. Track remote sessions in **Cloud Agents** and ACP/local chat sessions in
   **Running Agents**.

### 4. Review, reopen, and archive specs

1. Move a spec to **Review** with **Send to Review**.
2. Track change requests and linked tasks from the spec tree.
3. Reopen work with **Reopen (Back to Current)**.
4. Archive completed work with **Send to Archived**, then restore with
   **Unarchive** if needed.

### 5. Preview and refine documents

1. Open a supported document from **Specs** or **Repo Wiki**.
2. Use the preview panel to inspect sections, metadata, forms, and dependency
   status.
3. Submit a refinement request from the preview when something is missing or
   outdated.
4. Open the source file in the editor for direct edits when needed.

### 6. Manage project resources and steering

1. Use **Actions** to browse prompts, agents, skills, scripts, templates, and
   SpecKit assets.
2. Use **Steering** to create project/user rules and constitutions.
3. Adjust global resource access settings if your workflow relies on shared
   home-directory Copilot resources.

### 7. Automate workflows with hooks

1. Open the **Hooks** view and create a new hook.
2. Pick an agent system, operation, timing, and action type.
3. Use template variables such as `$agentOutput` or `$outputPath` to pass
   dynamic context.
4. Enable the hook and inspect logs from the same view.

### 8. Browse and synchronize repository docs

1. Open **Repo Wiki** to browse the `docs/` tree.
2. Open a document, refresh the tree, or show the table of contents.
3. Update one document or run **Synchronize All Documents** from the view title.

### Command highlights

| Command | Purpose |
| --- | --- |
| `GatomIA: Show Welcome Screen` | Reopen onboarding, dependency checks, and learning resources. |
| `GatomIA: GatomIA Settings` | Open the extension settings page. |
| `GatomIA: Open MCP Config (mcp.json)` | Jump directly to the MCP configuration file. |
| `GatomIA: Select Spec System` | Switch between auto-detect, SpecKit, and OpenSpec. |
| `GatomIA: Create New Spec` | Start a new spec-generation flow. |
| `GatomIA: Select Cloud Agent Provider` / `Change Cloud Agent Provider` | Choose or switch the active remote provider. |
| `GatomIA: Configure Provider Credentials` | Configure credentials for the active cloud provider. |
| `GatomIA: Refresh Cloud Agent Sessions` | Refresh remote session status and task progress. |
| `GatomIA: Configure Devin Credentials` | Store Devin credentials for direct task delegation. |

### Built-in SpecKit commands

The command palette also exposes a built-in SpecKit workflow surface for common
operations:

- `gatomia.speckit.constitution`
- `gatomia.speckit.specify`
- `gatomia.speckit.plan`
- `gatomia.speckit.research`
- `gatomia.speckit.datamodel`
- `gatomia.speckit.design`
- `gatomia.speckit.clarify`
- `gatomia.speckit.analyze`
- `gatomia.speckit.checklist`
- `gatomia.speckit.tasks`
- `gatomia.speckit.taskstoissues`
- `gatomia.speckit.unit-test`
- `gatomia.speckit.integration-test`
- `gatomia.speckit.implementation`

## Configuration

All settings live under the `gatomia` namespace.

### Core workflow

| Setting | Default | Purpose |
| --- | --- | --- |
| `gatomia.specSystem` | `auto` | Active spec system: auto-detect, SpecKit, or OpenSpec. |
| `gatomia.chat.provider` | `auto` | Route prompts through Copilot Chat, Devin, Gemini, or auto-select. |
| `gatomia.chatLanguage` | `English` | Preferred response language for prompt-based flows. |
| `gatomia.copilot.specsPath` | `speckit` | Path where Copilot specification files are stored. |
| `gatomia.copilot.promptsPath` | `.github/prompts` | Path for markdown prompt files. |
| `gatomia.speckit.specsPath` | `specs` | SpecKit specs directory. |
| `gatomia.speckit.memoryPath` | `.specify/memory` | SpecKit memory directory. |
| `gatomia.speckit.templatesPath` | `.specify/templates` | SpecKit templates directory. |
| `gatomia.speckit.scriptsPath` | `.specify/scripts` | SpecKit scripts directory. |

### Custom instructions

| Setting | Default | Purpose |
| --- | --- | --- |
| `gatomia.customInstructions.global` | `""` | Instructions appended to all prompts. |
| `gatomia.customInstructions.createSpec` | `""` | Extra guidance appended during spec creation. |
| `gatomia.customInstructions.startAllTask` | `""` | Extra guidance appended when starting all tasks. |
| `gatomia.customInstructions.runPrompt` | `""` | Extra guidance appended when running prompts. |

### Views

| Setting | Default | Purpose |
| --- | --- | --- |
| `gatomia.views.specs.visible` | `true` | Show or hide the **Specs** view. |
| `gatomia.views.actions.visible` | `true` | Show or hide the **Actions** view. |
| `gatomia.views.steering.visible` | `true` | Show or hide the **Steering** view. |
| `gatomia.views.hooks.visible` | `true` | Show or hide the **Hooks** view. |
| `gatomia.views.quickAccess.visible` | `true` | Show or hide the **Quick Access** view. |
| `gatomia.views.wiki.visible` | `true` | Show or hide the **Repo Wiki** view. |

### Steering and resource access

| Setting | Default | Purpose |
| --- | --- | --- |
| `gatomia.steering.globalResourceAccessDefault` | `ask` | Default policy for reading global Copilot resources from your home directory. |
| `gatomia.steering.workspaceGlobalResourceAccess` | `inherit` | Workspace-level override for global resource access. |
| `gatomia.agents.resourcesPath` | `resources` | Root folder for prompts, agents, skills, and instructions. |
| `gatomia.agents.enableHotReload` | `true` | Reload resource changes automatically. |
| `gatomia.agents.logLevel` | `info` | Agent integration log verbosity. |

### ACP and agent chat

| Setting | Default | Purpose |
| --- | --- | --- |
| `gatomia.agentChat.maxConcurrentAcpSessions` | `5` | Maximum concurrent ACP agent chat sessions. |
| `gatomia.acp.sessionMode` | `workspace` | Reuse one ACP session per workspace, per spec, or per prompt. |
| `gatomia.acp.permissionDefault` | `ask` | Default response to ACP permission requests. |
| `gatomia.acp.verboseLogging` | `false` | Write ACP protocol/tool-call details to the ACP output channel. |
| `gatomia.acp.registryRemoteFetch` | `true` | Query the public ACP registry for additional providers. |

### Devin

| Setting | Default | Purpose |
| --- | --- | --- |
| `gatomia.devin.pollingInterval` | `5` | Polling interval, in seconds, for Devin session updates. |
| `gatomia.devin.maxRetries` | `3` | Retry limit for failed Devin API calls. |
| `gatomia.devin.verboseLogging` | `false` | Enable verbose Devin logging in the output channel. |

## Workspace layout

### Common project locations

| Path | Purpose |
| --- | --- |
| `.github/prompts/` | Project prompts surfaced in **Actions**. |
| `.github/instructions/` | Project instruction rules surfaced in **Steering** and **Actions**. |
| `.github/agents/` | Custom Copilot agents. |
| `.github/skills/` | Custom skills used by agents and automation. |
| `resources/` | Configurable resource root for agent assets. |
| `docs/` | Repository documentation shown in **Repo Wiki**. |
| `specs/` | Default SpecKit specs directory. |
| `.specify/` | SpecKit memory, templates, and scripts. |
| `openspec/` | OpenSpec workspace files. |

### SpecKit Structure

```text
.specify/
├── constitution.md         # Global steering rules
├── memory/                 # Project memory
├── templates/              # Spec templates
specs/                      # Feature specifications
├── 001-feature-name/
│   ├── spec.md
│   └── 001-task-name.md
```

### OpenSpec Structure

```text
openspec/
├── AGENTS.md               # Project-specific steering rules
├── project.md              # Project specification
├── specs/
│   ├── <spec>/
│       ├── requirements.md
│       ├── design.md
│       └── tasks.md
```

## Development

1. Install dependencies:
   * `npm run install:all`
2. Build:
   * `npm run build`
3. Run quality checks:
   * `npm run check`
   * `npm test`
4. Launch:
   * Press `F5` inside VS Code.

## License

MIT License. See [`LICENSE`](LICENSE).

## Credits

* [SpecKit](https://github.com/github/spec-kit)
* [OpenSpec](https://github.com/Fission-AI/OpenSpec)
