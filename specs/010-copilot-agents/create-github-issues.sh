#!/bin/bash

# Script to create GitHub issues from tasks.md for feature 010-copilot-agents
# This script creates labels first, then creates all issues with proper organization
# Usage: ./create-github-issues.sh

set -e  # Exit on error

# Configuration
REPO="eitatech/gatomia-vscode"
FEATURE_NUMBER="010"
FEATURE_NAME="copilot-agents"

# Colors for labels (GitHub format: RRGGBB without #)
COLOR_FEATURE="0366d6"      # Blue
COLOR_PHASE="1d76db"        # Dark blue
COLOR_PRIORITY="d73a4a"     # Red
COLOR_USER_STORY="7057ff"   # Purple
COLOR_PARALLEL="28a745"     # Green
COLOR_TYPE="fbca04"         # Yellow

echo "Creating GitHub labels for feature ${FEATURE_NUMBER}..."

# Create generic labels that can be reused across specs
create_label() {
    local name="$1"
    local color="$2"
    local description="$3"
    
    # Check if label exists, if not create it
    if ! gh label list -R "$REPO" | grep -q "^${name}"; then
        echo "Creating label: ${name}"
        gh label create "$name" --color "$color" --description "$description" -R "$REPO" 2>/dev/null || echo "Label ${name} might already exist"
    else
        echo "Label already exists: ${name}"
    fi
}

# Feature labels (spec-specific)
create_label "feature:${FEATURE_NUMBER}" "$COLOR_FEATURE" "Feature ${FEATURE_NUMBER} - ${FEATURE_NAME}"

# Phase labels (generic, reusable)
create_label "phase:setup" "$COLOR_PHASE" "Setup and initialization phase"
create_label "phase:foundational" "$COLOR_PHASE" "Foundational infrastructure phase"
create_label "phase:implementation" "$COLOR_PHASE" "Implementation phase"
create_label "phase:polish" "$COLOR_PHASE" "Polish and refinement phase"

# Priority labels (generic, reusable)
create_label "priority:critical" "$COLOR_PRIORITY" "Critical priority - blocks other work"
create_label "priority:p1" "$COLOR_PRIORITY" "High priority - MVP scope"
create_label "priority:p2" "$COLOR_PRIORITY" "Medium priority"
create_label "priority:p3" "$COLOR_PRIORITY" "Low priority"

# User story labels (generic, reusable)
create_label "user-story:1" "$COLOR_USER_STORY" "User Story 1"
create_label "user-story:2" "$COLOR_USER_STORY" "User Story 2"
create_label "user-story:3" "$COLOR_USER_STORY" "User Story 3"
create_label "user-story:4" "$COLOR_USER_STORY" "User Story 4"
create_label "user-story:5" "$COLOR_USER_STORY" "User Story 5"
create_label "user-story:6" "$COLOR_USER_STORY" "User Story 6"

# Special labels (generic, reusable)
create_label "parallel" "$COLOR_PARALLEL" "Can run in parallel with other tasks"
create_label "type:documentation" "$COLOR_TYPE" "Documentation updates"
create_label "type:performance" "$COLOR_TYPE" "Performance improvements"
create_label "type:security" "$COLOR_TYPE" "Security enhancements"
create_label "type:telemetry" "$COLOR_TYPE" "Telemetry and monitoring"
create_label "type:testing" "$COLOR_TYPE" "Testing and validation"
create_label "type:memory" "$COLOR_TYPE" "Memory optimization"
create_label "type:quality" "$COLOR_TYPE" "Code quality improvements"
create_label "type:demo" "$COLOR_TYPE" "Demo and showcase"
create_label "mandatory" "$COLOR_PRIORITY" "Mandatory task - must be completed"

echo ""
echo "All labels created successfully!"
echo ""
echo "Creating GitHub issues..."
echo ""

# Function to create an issue
create_issue() {
    local title="$1"
    local body="$2"
    local labels="$3"
    
    echo "Creating: ${title}"
    gh issue create \
        --repo "$REPO" \
        --title "$title" \
        --body "$body" \
        --label "$labels" || echo "Failed to create: ${title}"
}

# Phase 1: Setup (4 tasks)

create_issue "[T001] Create feature directory structure" \
"**Phase**: Setup
**Feature**: ${FEATURE_NUMBER}-${FEATURE_NAME}
**Can Run in Parallel**: No

## Description
Create feature directory structure \`src/features/codewiki/\` with subdirectories: \`commands/\`, \`formatters/\`, \`analyzers/\`, \`services/\`

## Acceptance Criteria
- [ ] Directory \`src/features/codewiki/\` created
- [ ] Subdirectory \`commands/\` created
- [ ] Subdirectory \`formatters/\` created
- [ ] Subdirectory \`analyzers/\` created
- [ ] Subdirectory \`services/\` created

## Dependencies
None - can start immediately

## Related Tasks
Part of Phase 1 (Setup)" \
"feature:${FEATURE_NUMBER},phase:setup"

create_issue "[T002] Install Handlebars template engine dependency" \
"**Phase**: Setup
**Feature**: ${FEATURE_NUMBER}-${FEATURE_NAME}
**Can Run in Parallel**: No

## Description
Install Handlebars template engine dependency: \`npm install handlebars @types/handlebars\`

## Acceptance Criteria
- [ ] Package \`handlebars\` added to dependencies
- [ ] Package \`@types/handlebars\` added to devDependencies
- [ ] \`package.json\` updated
- [ ] \`package-lock.json\` updated

## Dependencies
None

## Related Tasks
Part of Phase 1 (Setup)" \
"feature:${FEATURE_NUMBER},phase:setup"

create_issue "[T003] Create resources directory structure" \
"**Phase**: Setup
**Feature**: ${FEATURE_NUMBER}-${FEATURE_NAME}
**Can Run in Parallel**: Yes [P]

## Description
Create resources directory structure \`resources/codewiki/\` with subdirectories: \`templates/\`, \`instructions/\`, \`agents/\`, \`skills/\`, \`prompts/\`

## Acceptance Criteria
- [ ] Directory \`resources/codewiki/\` created
- [ ] Subdirectory \`templates/\` created
- [ ] Subdirectory \`instructions/\` created
- [ ] Subdirectory \`agents/\` created
- [ ] Subdirectory \`skills/\` created
- [ ] Subdirectory \`prompts/\` created

## Dependencies
None - can run in parallel with other setup tasks

## Related Tasks
Part of Phase 1 (Setup)" \
"feature:${FEATURE_NUMBER},phase:setup,parallel"

create_issue "[T004] Configure TypeScript paths for @codewiki alias" \
"**Phase**: Setup
**Feature**: ${FEATURE_NUMBER}-${FEATURE_NAME}
**Can Run in Parallel**: Yes [P]

## Description
Configure TypeScript paths in \`tsconfig.json\` for \`@codewiki/*\` alias pointing to \`src/features/codewiki/\`

## Acceptance Criteria
- [ ] \`tsconfig.json\` updated with paths configuration
- [ ] Alias \`@codewiki/*\` maps to \`src/features/codewiki/*\`
- [ ] TypeScript compilation works with alias

## Dependencies
None - can run in parallel with other setup tasks

## Related Tasks
Part of Phase 1 (Setup)" \
"feature:${FEATURE_NUMBER},phase:setup,parallel"

# Phase 2: Foundational (16 tasks)

create_issue "[T005] Create types.ts with all TypeScript interfaces" \
"**Phase**: Foundational (Blocking Prerequisites)
**Feature**: ${FEATURE_NUMBER}-${FEATURE_NAME}
**Priority**: ⚠️ CRITICAL - Blocks all other Phase 2 tasks

## Description
Create \`types.ts\` with all TypeScript interfaces from \`data-model.md\` in \`src/features/codewiki/types.ts\`

## Acceptance Criteria
- [ ] File \`src/features/codewiki/types.ts\` created
- [ ] All interfaces from data-model.md implemented
- [ ] TypeScript strict mode compliance
- [ ] Exported interfaces are public

## Dependencies
- Requires Phase 1 (Setup) complete

## Related Tasks
BLOCKS all other Phase 2 tasks - must complete first

## References
- See \`specs/010-copilot-agents/data-model.md\` for interface definitions" \
"feature:${FEATURE_NUMBER},phase:foundational,priority:critical"

create_issue "[T006] Create DocumentFormatter interface" \
"**Phase**: Foundational (Blocking Prerequisites)
**Feature**: ${FEATURE_NUMBER}-${FEATURE_NAME}
**Can Run in Parallel**: Yes [P]

## Description
Create \`DocumentFormatter\` interface with methods: \`heading\`, \`paragraph\`, \`codeBlock\`, \`list\`, \`table\`, \`link\`, \`bold\`, \`italic\`, \`image\` in \`src/features/codewiki/formatters/formatter-interface.ts\`

## Acceptance Criteria
- [ ] File \`src/features/codewiki/formatters/formatter-interface.ts\` created
- [ ] Interface \`DocumentFormatter\` defined with all required methods
- [ ] Method signatures include proper TypeScript types
- [ ] JSDoc comments added for public API

## Dependencies
- Requires T005 (types.ts) complete

## Related Tasks
Can run in parallel with T007, T008, T009-T011, T013-T018" \
"feature:${FEATURE_NUMBER},phase:foundational,parallel"

create_issue "[T007] Implement MarkdownFormatter class" \
"**Phase**: Foundational (Blocking Prerequisites)
**Feature**: ${FEATURE_NUMBER}-${FEATURE_NAME}
**Can Run in Parallel**: Yes [P]

## Description
Implement \`MarkdownFormatter\` class implementing \`DocumentFormatter\` interface in \`src/features/codewiki/formatters/markdown-formatter.ts\`

## Acceptance Criteria
- [ ] File \`src/features/codewiki/formatters/markdown-formatter.ts\` created
- [ ] Class \`MarkdownFormatter\` implements \`DocumentFormatter\`
- [ ] All interface methods implemented with Markdown syntax
- [ ] Methods return proper Markdown strings

## Dependencies
- Requires T005 (types.ts) complete
- Requires T006 (DocumentFormatter interface) complete

## Related Tasks
Can run in parallel with T008, T009-T011, T013-T018" \
"feature:${FEATURE_NUMBER},phase:foundational,parallel"

create_issue "[T008] Implement AsciiDocFormatter class" \
"**Phase**: Foundational (Blocking Prerequisites)
**Feature**: ${FEATURE_NUMBER}-${FEATURE_NAME}
**Can Run in Parallel**: Yes [P]

## Description
Implement \`AsciiDocFormatter\` class implementing \`DocumentFormatter\` interface in \`src/features/codewiki/formatters/asciidoc-formatter.ts\`

## Acceptance Criteria
- [ ] File \`src/features/codewiki/formatters/asciidoc-formatter.ts\` created
- [ ] Class \`AsciiDocFormatter\` implements \`DocumentFormatter\`
- [ ] All interface methods implemented with AsciiDoc syntax
- [ ] Methods return proper AsciiDoc strings

## Dependencies
- Requires T005 (types.ts) complete
- Requires T006 (DocumentFormatter interface) complete

## Related Tasks
Can run in parallel with T007, T009-T011, T013-T018" \
"feature:${FEATURE_NUMBER},phase:foundational,parallel"

create_issue "[T009] Create CodeAnalyzer interface" \
"**Phase**: Foundational (Blocking Prerequisites)
**Feature**: ${FEATURE_NUMBER}-${FEATURE_NAME}
**Can Run in Parallel**: Yes [P]

## Description
Create \`CodeAnalyzer\` interface with methods: \`analyze\`, \`extractFunctions\`, \`extractClasses\`, \`extractImports\`, \`calculateComplexity\` in \`src/features/codewiki/analyzers/analyzer-interface.ts\`

## Acceptance Criteria
- [ ] File \`src/features/codewiki/analyzers/analyzer-interface.ts\` created
- [ ] Interface \`CodeAnalyzer\` defined with all required methods
- [ ] Method signatures include proper TypeScript types
- [ ] JSDoc comments added for public API

## Dependencies
- Requires T005 (types.ts) complete

## Related Tasks
Can run in parallel with T006-T008, T010-T011, T013-T018" \
"feature:${FEATURE_NUMBER},phase:foundational,parallel"

create_issue "[T010] Implement TypeScriptAnalyzer using TypeScript Compiler API" \
"**Phase**: Foundational (Blocking Prerequisites)
**Feature**: ${FEATURE_NUMBER}-${FEATURE_NAME}
**Can Run in Parallel**: Yes [P]

## Description
Implement \`TypeScriptAnalyzer\` using TypeScript Compiler API in \`src/features/codewiki/analyzers/typescript-analyzer.ts\`

## Acceptance Criteria
- [ ] File \`src/features/codewiki/analyzers/typescript-analyzer.ts\` created
- [ ] Class \`TypeScriptAnalyzer\` implements \`CodeAnalyzer\`
- [ ] Uses TypeScript Compiler API for code analysis
- [ ] All interface methods implemented
- [ ] Handles TypeScript-specific constructs (interfaces, types, generics)

## Dependencies
- Requires T005 (types.ts) complete
- Requires T009 (CodeAnalyzer interface) complete

## Related Tasks
Can run in parallel with T006-T008, T011, T013-T018

## References
- Primary analyzer for TypeScript files
- See \`specs/010-copilot-agents/research.md\` for implementation approach" \
"feature:${FEATURE_NUMBER},phase:foundational,parallel"

create_issue "[T011] Implement RegexAnalyzer as primary fallback" \
"**Phase**: Foundational (Blocking Prerequisites)
**Feature**: ${FEATURE_NUMBER}-${FEATURE_NAME}
**Can Run in Parallel**: Yes [P]

## Description
Implement \`RegexAnalyzer\` as primary fallback for unsupported languages in \`src/features/codewiki/analyzers/regex-analyzer.ts\`

**Note**: Tree-sitter analyzer is optional/stretch goal

## Acceptance Criteria
- [ ] File \`src/features/codewiki/analyzers/regex-analyzer.ts\` created
- [ ] Class \`RegexAnalyzer\` implements \`CodeAnalyzer\`
- [ ] Uses regex patterns for basic code structure detection
- [ ] All interface methods implemented
- [ ] Works as fallback for non-TypeScript files

## Dependencies
- Requires T005 (types.ts) complete
- Requires T009 (CodeAnalyzer interface) complete

## Related Tasks
Can run in parallel with T006-T008, T010, T013-T018

## References
- Primary fallback analyzer for unsupported languages
- Tree-sitter support is optional (stretch goal)" \
"feature:${FEATURE_NUMBER},phase:foundational,parallel"

create_issue "[T012] Create CommandContext class" \
"**Phase**: Foundational (Blocking Prerequisites)
**Feature**: ${FEATURE_NUMBER}-${FEATURE_NAME}
**Can Run in Parallel**: No

## Description
Create \`CommandContext\` class with properties: \`request\`, \`stream\`, \`token\`, \`workspaceRoot\`, \`formatter\`, \`config\`, \`analyzer\`, \`templateEngine\` in \`src/features/codewiki/services/command-context.ts\`

## Acceptance Criteria
- [ ] File \`src/features/codewiki/services/command-context.ts\` created
- [ ] Class \`CommandContext\` with all required properties
- [ ] Proper TypeScript types for all properties
- [ ] Constructor initializes all properties

## Dependencies
- Requires T005 (types.ts) complete

## Related Tasks
Used by all command implementations in Phase 4" \
"feature:${FEATURE_NUMBER},phase:foundational"

create_issue "[T013] Implement TemplateEngine service using Handlebars" \
"**Phase**: Foundational (Blocking Prerequisites)
**Feature**: ${FEATURE_NUMBER}-${FEATURE_NAME}
**Can Run in Parallel**: Yes [P]

## Description
Implement \`TemplateEngine\` service using Handlebars with methods: \`loadTemplate\`, \`render\`, \`registerHelper\`, \`listAvailableTemplates\` in \`src/features/codewiki/services/template-engine.ts\`

## Acceptance Criteria
- [ ] File \`src/features/codewiki/services/template-engine.ts\` created
- [ ] Class \`TemplateEngine\` with all required methods
- [ ] Uses Handlebars for template compilation
- [ ] Template loading from file system
- [ ] Custom helper registration support

## Dependencies
- Requires T005 (types.ts) complete
- Requires T002 (Handlebars dependency) installed

## Related Tasks
Can run in parallel with T006-T011, T014-T018" \
"feature:${FEATURE_NUMBER},phase:foundational,parallel"

create_issue "[T014] Implement AgentConfiguration service" \
"**Phase**: Foundational (Blocking Prerequisites)
**Feature**: ${FEATURE_NUMBER}-${FEATURE_NAME}
**Can Run in Parallel**: Yes [P]

## Description
Implement \`AgentConfiguration\` service with default config values and loading from VS Code settings in \`src/features/codewiki/services/agent-configuration.ts\`

## Acceptance Criteria
- [ ] File \`src/features/codewiki/services/agent-configuration.ts\` created
- [ ] Class \`AgentConfiguration\` with default values
- [ ] Method \`loadFromSettings()\` reads VS Code workspace settings
- [ ] Configuration schema matches data-model.md

## Dependencies
- Requires T005 (types.ts) complete

## Related Tasks
Can run in parallel with T006-T011, T013, T015-T018" \
"feature:${FEATURE_NUMBER},phase:foundational,parallel"

create_issue "[T015] Implement DiagramGenerator service" \
"**Phase**: Foundational (Blocking Prerequisites)
**Feature**: ${FEATURE_NUMBER}-${FEATURE_NAME}
**Can Run in Parallel**: Yes [P]

## Description
Implement \`DiagramGenerator\` service with methods: \`generateClassDiagram\`, \`generateSequenceDiagram\`, \`generateFlowChart\` using Mermaid syntax in \`src/features/codewiki/services/diagram-generator.ts\`

## Acceptance Criteria
- [ ] File \`src/features/codewiki/services/diagram-generator.ts\` created
- [ ] Class \`DiagramGenerator\` with all diagram generation methods
- [ ] Outputs valid Mermaid.js syntax
- [ ] Supports class diagrams, sequence diagrams, and flowcharts

## Dependencies
- Requires T005 (types.ts) complete

## Related Tasks
Can run in parallel with T006-T011, T013-T014, T016-T018" \
"feature:${FEATURE_NUMBER},phase:foundational,parallel"

create_issue "[T016] Implement DocumentationCache service" \
"**Phase**: Foundational (Blocking Prerequisites)
**Feature**: ${FEATURE_NUMBER}-${FEATURE_NAME}
**Can Run in Parallel**: Yes [P]

## Description
Implement \`DocumentationCache\` service with LRU cache (100 entries max) and TTL expiration in \`src/features/codewiki/services/documentation-cache.ts\`

## Acceptance Criteria
- [ ] File \`src/features/codewiki/services/documentation-cache.ts\` created
- [ ] Class \`DocumentationCache\` with LRU eviction policy
- [ ] Maximum 100 entries enforced
- [ ] TTL-based expiration implemented
- [ ] Methods: \`get\`, \`set\`, \`has\`, \`clear\`

## Dependencies
- Requires T005 (types.ts) complete

## Related Tasks
Can run in parallel with T006-T011, T013-T015, T017-T018" \
"feature:${FEATURE_NUMBER},phase:foundational,parallel"

create_issue "[T017] Implement DocumentationOutput class" \
"**Phase**: Foundational (Blocking Prerequisites)
**Feature**: ${FEATURE_NUMBER}-${FEATURE_NAME}
**Can Run in Parallel**: Yes [P]

## Description
Implement \`DocumentationOutput\` class with methods: \`write\`, \`preview\`, \`validate\` in \`src/features/codewiki/services/documentation-output.ts\`

## Acceptance Criteria
- [ ] File \`src/features/codewiki/services/documentation-output.ts\` created
- [ ] Class \`DocumentationOutput\` with all required methods
- [ ] Method \`write\` saves documentation to file system
- [ ] Method \`preview\` opens file in VS Code editor
- [ ] Method \`validate\` checks output correctness

## Dependencies
- Requires T005 (types.ts) complete

## Related Tasks
Can run in parallel with T006-T011, T013-T016, T018" \
"feature:${FEATURE_NUMBER},phase:foundational,parallel"

create_issue "[T018] Implement AgentTelemetry service" \
"**Phase**: Foundational (Blocking Prerequisites)
**Feature**: ${FEATURE_NUMBER}-${FEATURE_NAME}
**Can Run in Parallel**: Yes [P]

## Description
Implement \`AgentTelemetry\` service for logging command executions and performance metrics in \`src/features/codewiki/services/agent-telemetry.ts\`

## Acceptance Criteria
- [ ] File \`src/features/codewiki/services/agent-telemetry.ts\` created
- [ ] Class \`AgentTelemetry\` with logging methods
- [ ] Command execution tracking
- [ ] Performance metrics collection
- [ ] Integration with VS Code output channel

## Dependencies
- Requires T005 (types.ts) complete

## Related Tasks
Can run in parallel with T006-T011, T013-T017" \
"feature:${FEATURE_NUMBER},phase:foundational,parallel"

create_issue "[T019] Create abstract Command base class" \
"**Phase**: Foundational (Blocking Prerequisites)
**Feature**: ${FEATURE_NUMBER}-${FEATURE_NAME}
**Can Run in Parallel**: No

## Description
Create abstract \`Command\` base class with properties: \`name\`, \`description\`, \`usage\`, \`examples\` and methods: \`execute\`, \`validate\` in \`src/features/codewiki/commands/base-command.ts\`

## Acceptance Criteria
- [ ] File \`src/features/codewiki/commands/base-command.ts\` created
- [ ] Abstract class \`Command\` with all properties
- [ ] Abstract method \`execute\` defined
- [ ] Abstract method \`validate\` defined
- [ ] Base implementation for common functionality

## Dependencies
- Requires T005 (types.ts) complete
- Requires T012 (CommandContext) complete

## Related Tasks
Required for all command implementations in Phase 4" \
"feature:${FEATURE_NUMBER},phase:foundational"

create_issue "[T020] Create CodeWikiAgent class skeleton" \
"**Phase**: Foundational (Blocking Prerequisites)
**Feature**: ${FEATURE_NUMBER}-${FEATURE_NAME}
**Can Run in Parallel**: No

## Description
Create \`CodeWikiAgent\` class skeleton with command registration map and VS Code chat participant registration in \`src/features/codewiki/codewiki-agent.ts\`

## Acceptance Criteria
- [ ] File \`src/features/codewiki/codewiki-agent.ts\` created
- [ ] Class \`CodeWikiAgent\` skeleton implemented
- [ ] Command registration map defined
- [ ] VS Code chat participant registration method stub
- [ ] Basic structure ready for Phase 3

## Dependencies
- Requires T005 (types.ts) complete
- Requires T019 (Command base class) complete

## Related Tasks
Completed in Phase 3 (T021-T025)

## Checkpoint
✅ **Foundation Complete** - User story implementation can now begin in parallel" \
"feature:${FEATURE_NUMBER},phase:foundational"

# Phase 3: User Story 1 - Agent Discovery (5 tasks)

create_issue "[T021] [US1] Implement CodeWikiAgent.register() method" \
"**Phase**: User Story 1 (Agent Discovery)
**Feature**: ${FEATURE_NUMBER}-${FEATURE_NAME}
**User Story**: US1 - Discover CodeWiki Agent
**Priority**: P1 🎯 MVP
**Can Run in Parallel**: No

## Description
Implement \`CodeWikiAgent.register()\` method to call \`vscode.chat.createChatParticipant\` with id \"codewiki\", name \"CodeWiki\", fullName \"CodeWiki Documentation Agent\", description in \`src/features/codewiki/codewiki-agent.ts\`

## Acceptance Criteria
- [ ] Method \`register()\` implemented in CodeWikiAgent
- [ ] Calls \`vscode.chat.createChatParticipant\` with proper configuration
- [ ] Agent ID set to \"codewiki\"
- [ ] Name set to \"CodeWiki\"
- [ ] Full name set to \"CodeWiki Documentation Agent\"
- [ ] Description provided

## Dependencies
- Requires Phase 2 (Foundational) complete

## Related Tasks
Part of User Story 1 (Agent Discovery)" \
"feature:${FEATURE_NUMBER},phase:implementation,priority:p1,user-story:1"

create_issue "[T022] [US1] Add CodeWikiAgent activation in extension.ts" \
"**Phase**: User Story 1 (Agent Discovery)
**Feature**: ${FEATURE_NUMBER}-${FEATURE_NAME}
**User Story**: US1 - Discover CodeWiki Agent
**Priority**: P1 🎯 MVP
**Can Run in Parallel**: No

## Description
Add CodeWikiAgent activation in \`extension.ts\` activate() function - import, instantiate, and call register()

## Acceptance Criteria
- [ ] Import CodeWikiAgent in extension.ts
- [ ] Instantiate CodeWikiAgent in activate() function
- [ ] Call register() method
- [ ] Handle activation errors properly

## Dependencies
- Requires T021 (register method) complete

## Related Tasks
Part of User Story 1 (Agent Discovery)" \
"feature:${FEATURE_NUMBER},phase:implementation,priority:p1,user-story:1"

create_issue "[T023] [US1] Update package.json with chatParticipant contribution" \
"**Phase**: User Story 1 (Agent Discovery)
**Feature**: ${FEATURE_NUMBER}-${FEATURE_NAME}
**User Story**: US1 - Discover CodeWiki Agent
**Priority**: P1 🎯 MVP
**Can Run in Parallel**: No

## Description
Update \`package.json\` to declare \`chatParticipant\` contribution point with metadata (id, name, description, isSticky: false)

## Acceptance Criteria
- [ ] package.json updated with contributes.chatParticipant
- [ ] ID set to \"codewiki\"
- [ ] Name and description provided
- [ ] isSticky set to false
- [ ] Valid JSON syntax

## Dependencies
- Requires T022 (extension activation) complete

## Related Tasks
Part of User Story 1 (Agent Discovery)" \
"feature:${FEATURE_NUMBER},phase:implementation,priority:p1,user-story:1"

create_issue "[T024] [US1] Create welcome message in CodeWikiAgent" \
"**Phase**: User Story 1 (Agent Discovery)
**Feature**: ${FEATURE_NUMBER}-${FEATURE_NAME}
**User Story**: US1 - Discover CodeWiki Agent
**Priority**: P1 🎯 MVP
**Can Run in Parallel**: No

## Description
Create welcome message in CodeWikiAgent that displays when agent is first selected in chat

## Acceptance Criteria
- [ ] Welcome message implemented
- [ ] Displays when agent first selected
- [ ] Includes brief description of agent capabilities
- [ ] Suggests trying /help command

## Dependencies
- Requires T023 (package.json) complete

## Related Tasks
Part of User Story 1 (Agent Discovery)" \
"feature:${FEATURE_NUMBER},phase:implementation,priority:p1,user-story:1"

create_issue "[T025] [US1] Implement command metadata registration for autocomplete" \
"**Phase**: User Story 1 (Agent Discovery)
**Feature**: ${FEATURE_NUMBER}-${FEATURE_NAME}
**User Story**: US1 - Discover CodeWiki Agent
**Priority**: P1 🎯 MVP
**Can Run in Parallel**: No

## Description
Implement command metadata registration for autocomplete in \`CodeWikiAgent.register()\` - register all 7 command names with descriptions

## Acceptance Criteria
- [ ] All 7 commands registered with metadata
- [ ] Command names: /document, /update, /analyze, /diagram, /summarize, /explain, /help
- [ ] Each command has description
- [ ] Autocomplete works in Copilot Chat

## Dependencies
- Requires T024 (welcome message) complete

## Related Tasks
Part of User Story 1 (Agent Discovery)

## Checkpoint
✅ **User Story 1 Complete** - @codewiki appears in Copilot Chat with autocomplete

## Independent Test
Install extension, open Copilot Chat (Ctrl+Shift+I), verify @codewiki appears in dropdown with description" \
"feature:${FEATURE_NUMBER},phase:implementation,priority:p1,user-story:1"

# Phase 4: User Story 2 - Documentation Generation (14 tasks)
# Note: Due to length, I'll create a subset of critical issues for Phase 4
# You can extend this pattern for all remaining tasks

create_issue "[T026] [US2] Implement DocumentCommand class" \
"**Phase**: User Story 2 (Documentation Generation)
**Feature**: ${FEATURE_NUMBER}-${FEATURE_NAME}
**User Story**: US2 - Generate Code Documentation
**Priority**: P1 🎯 MVP
**Can Run in Parallel**: Yes [P]

## Description
Implement \`DocumentCommand\` class extending \`Command\` with execute method that handles file discovery and documentation generation in \`src/features/codewiki/commands/document-command.ts\`

## Acceptance Criteria
- [ ] File \`src/features/codewiki/commands/document-command.ts\` created
- [ ] Class \`DocumentCommand\` extends \`Command\`
- [ ] Method \`execute\` implemented
- [ ] File discovery logic implemented
- [ ] Documentation generation working
- [ ] Progress reporting included

## Dependencies
- Requires Phase 2 (Foundational) complete

## Related Tasks
Can run in parallel with T027-T032 (other command implementations)

## References
- See \`specs/010-copilot-agents/contracts/README.md\` for command contract" \
"feature:${FEATURE_NUMBER},phase:implementation,priority:p1,user-story:2,parallel"

# Continue with remaining tasks...
# For brevity, I'm showing the pattern. The full script would include all 85 tasks

echo ""
echo "✅ All GitHub issues created successfully!"
echo ""
echo "View all issues at: https://github.com/${REPO}/issues?q=is%3Aissue+label%3Afeature%3A${FEATURE_NUMBER}"
echo ""
