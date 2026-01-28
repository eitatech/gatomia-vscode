# Github Copilot Development Guidelines

This file provides guidance to AI agents when working with code in this repository.

## MANDATORY ACTIONS

- Always run `npm run check` before marking any task as complete. This ensures code quality and formatting standards are met.
- Never use emoji in source code files (from global user instructions).

## Project Constitution (NON-NEGOTIABLE)

This constitution applies to all source code, tests, documentation, and configuration files within the GatomIA project. It governs naming conventions, coding practices, testing strategies, and overall code quality standards.

### I. Kebab-Case File Naming (MANDATORY)

- **All source files MUST use kebab-case** (e.g., `preview-store.ts`, `document-preview-panel.ts`)
- ❌ NO camelCase, PascalCase, or snake_case files
- Linter will fail on non-compliant filenames
- Exceptions: Config files requiring specific naming (`package.json`, `tsconfig.json`, `README.md`)

### II. TypeScript-First Development

- All code MUST be TypeScript with `strict: true`
- No `any` types without explicit justification
- All public APIs MUST have complete type definitions

### III. Test-First Development (TDD)

- Tests MUST be written BEFORE implementation
- Red-Green-Refactor cycle strictly enforced
- PRs without tests are rejected
- Test coverage MUST NOT decrease
- Integration tests required for new features

### IV. Observability & Instrumentation

- Significant operations MUST include telemetry, logging, and error reporting
- Performance-critical paths MUST include instrumentation
- Errors MUST be logged with sufficient debug context
- No silent failures

### V. Simplicity & YAGNI

- Implement only what is needed NOW
- No features or abstractions for potential future use
- Challenge unnecessary abstractions in code reviews
- Refactor when patterns emerge (Rule of Three)

## Quick Start: Common Commands

```bash
# Install all dependencies (root + ui)
npm run install:all

# Development workflow
npm run build          # Full build (prompts + extension + webview)
npm run watch          # TypeScript watch + webview dev server
npm run build-prompts  # Compile markdown prompts to TypeScript
npm run build:ext      # Bundle extension only (esbuild)
npm run build:webview  # Build React webview (Vite)

# Testing and Quality (MUST pass before commits)
npm test               # Run all tests (Vitest)
npm run test:watch     # Watch mode for tests
npm run test:coverage  # Generate coverage report
npm run format         # Format code with Biome
npm run check          # Run all checks (lint + format validation) - MANDATORY

# Running specific tests
npm test -- path/to/test-file.test.ts           # Run single test file
npm test -- -t "test name pattern"               # Run tests matching pattern

# Packaging and Publishing
npm run package        # Create VSIX file for VS Code Marketplace
npm run compile        # Build then package (used for CI/CD)

# Webview development
npm --prefix ui run dev  # Run webview dev server in isolation

# Launch extension in debug mode
Press F5 in VS Code to launch the Extension Development Host
```

## Code Quality Standards

### Formatting & Style

- Tab indentation (configured in formatter)
- Double quotes for strings
- Semicolons required
- `npm run format` MUST pass before commit
- `npm run check` MUST pass before merge

### Biome Linting Rules (MANDATORY)

These rules are enforced by our linter and MUST be followed:

#### Performance Rules

- **useTopLevelRegex** (CRITICAL): Regular expressions MUST be defined at the top level (as constants) outside functions
  - ❌ BAD: `const name = filename.replace(/\.agent\.md$/, "")`
  - ❌ BAD: `expect(path).toMatch(/\.agent\.md$/)`
  - ✅ GOOD: Define `const AGENT_FILE_PATTERN = /\.agent\.md$/;` at top level, then use `filename.replace(AGENT_FILE_PATTERN, "")`
  - **Reason**: Regex literals inside functions are recompiled on every call, causing performance degradation
  - **Rule applies to**: Production code, test files, and ANY file where regex is used inside a function/loop
  - **How to fix**: 
    1. Move regex to top-level constant with descriptive name
    2. Use SCREAMING_SNAKE_CASE for the constant name
    3. Add a comment if the pattern isn't obvious
  - **Examples of affected locations**: 
    - Inside `describe()` or `it()` test blocks
    - Inside class methods
    - Inside arrow functions or callbacks
    - Inside loops

#### Code Quality Rules

- **noShadow**: Variables MUST NOT shadow outer scope variables with the same name
  - ❌ BAD: 
    ```typescript
    const agents = getAgents();
    callback((agents) => { /* shadows outer 'agents' */ });
    ```
  - ✅ GOOD: 
    ```typescript
    const agents = getAgents();
    callback((agentList) => { /* different name */ });
    ```
  - Reason: Variable shadowing makes code confusing and error-prone

- **noExcessiveCognitiveComplexity** (CRITICAL): Functions MUST NOT exceed complexity score of 15
  - **What is complexity**: Nested conditions, loops, try-catch, logical operators, early returns
  - **How to measure**: Biome calculates complexity automatically
  - **How to fix**:
    1. Extract helper functions for logical blocks
    2. Use early returns to reduce nesting
    3. Extract complex conditions into well-named boolean variables
    4. Split validation/processing into separate functions
  - **Example pattern for refactoring**:
    ```typescript
    // ❌ BAD: High complexity (21)
    async validateData(data: Data): Promise<Result> {
      const errors = [];
      if (!data || typeof data !== "object") {
        errors.push({field: "data", message: "Invalid"});
        return {valid: false, errors};
      }
      if (!data.name || data.name.length === 0) {
        errors.push({field: "name", message: "Empty"});
      } else if (data.name.length > 100) {
        errors.push({field: "name", message: "Too long"});
      }
      if (data.type === "custom") {
        if (data.params?.subtype) {
          const validTypes = ["a", "b"];
          if (!validTypes.includes(data.params.subtype)) {
            errors.push({field: "subtype", message: "Invalid"});
          }
        }
      }
      // ... more nested conditions
      return {valid: errors.length === 0, errors};
    }
    
    // ✅ GOOD: Low complexity (extract helpers)
    async validateData(data: Data): Promise<Result> {
      const errors = [];
      
      // Early return for structure errors
      if (!data || typeof data !== "object") {
        return {valid: false, errors: [{field: "data", message: "Invalid"}]};
      }
      
      // Extract each validation into helper
      errors.push(...this.validateName(data.name));
      errors.push(...this.validateType(data));
      // ... more helper calls
      
      return {valid: errors.length === 0, errors};
    }
    
    private validateName(name: string): ValidationError[] {
      // Simple, focused function (complexity: 2)
      if (!name || name.length === 0) {
        return [{field: "name", message: "Empty"}];
      }
      if (name.length > 100) {
        return [{field: "name", message: "Too long"}];
      }
      return [];
    }
    ```
  - **Naming helper functions**: Use descriptive names that explain WHAT is being validated/processed

- **noUndeclaredVariables**: All variables MUST be declared before use
  - Ensure all imports are present at the top of the file
  - Check TypeScript compilation errors for missing imports

#### Test Quality Rules

- **noDuplicateTestHooks**: Don't use duplicate test hooks (beforeEach, afterEach, etc.)
- **noDisabledTests**: Don't commit disabled tests (`.skip`, `.todo`)
  - If a test must be skipped temporarily, document WHY in comments and create a tracking issue

### Documentation

- Public APIs MUST include JSDoc comments
- Complex algorithms MUST include explanatory comments
- README files MUST be kept up-to-date with feature changes
- Use `// biome-ignore` comments ONLY when absolutely necessary with clear justification

### Error Handling

- All async operations MUST handle errors explicitly
- User-facing errors MUST be actionable and clear
- Internal errors MUST include sufficient debug context
- Console.error() for errors that need debugging context
- Don't silence errors without logging

### Common Coding Patterns

#### Constants and Configuration

- Define constants at the module top level, not inside functions
- Group related constants together
- Use SCREAMING_SNAKE_CASE for constants
- Export constants that are used across modules

```typescript
// ✅ GOOD: Top-level constants
const AGENT_FILE_PATTERN = /\.agent\.md$/;
const DEBOUNCE_DELAY_MS = 500;
const MAX_RETRY_ATTEMPTS = 3;

function processFile(filename: string) {
  return filename.replace(AGENT_FILE_PATTERN, "");
}
```

#### Variable Naming

- Use descriptive names that avoid shadowing
- Prefer `item`, `element`, `entry` over reusing the collection name
- For callbacks, use descriptive parameter names

```typescript
// ❌ BAD: Variable shadowing
const users = getUsers();
users.forEach((users) => { /* confusing */ });

// ✅ GOOD: Clear naming
const users = getUsers();
users.forEach((user) => { /* clear */ });

// ✅ GOOD: Alternative for callbacks
registry.onAgentsChanged((agentList) => {
  // 'agentList' doesn't shadow any outer 'agents' variable
});
```

#### Async/Await Patterns

- Always handle promise rejections
- Use try-catch for async operations
- Return early on error conditions

```typescript
// ✅ GOOD: Proper error handling
async function loadAgent(path: string): Promise<Agent | null> {
  try {
    const content = await fs.readFile(path, "utf-8");
    return parseAgent(content);
  } catch (error) {
    console.error(`Failed to load agent from ${path}:`, error);
    return null;
  }
}
```

#### Class Property Declarations

- Use `readonly` for properties that don't change after construction
- Avoid unnecessary `biome-ignore` comments
- Initialize properties in constructor or at declaration

```typescript
// ✅ GOOD: Clear property declarations
class Service {
  private readonly config: Config;
  private watcher: FileSystemWatcher | undefined;
  private isActive = false;
  
  constructor(config: Config) {
    this.config = config;
  }
}
```

### Anti-Patterns to Avoid

#### ❌ DON'T: Define regex inside functions (PRODUCTION CODE)

```typescript
function parseFileName(path: string) {
  return path.replace(/\.agent\.md$/, ""); // ❌ Recompiled every call
}
```

#### ✅ DO: Define regex at top level (PRODUCTION CODE)

```typescript
// Top-level constant
const AGENT_FILE_EXTENSION = /\.agent\.md$/;

function parseFileName(path: string) {
  return path.replace(AGENT_FILE_EXTENSION, ""); // ✅ Compiled once
}
```

---

#### ❌ DON'T: Use inline regex in tests

```typescript
describe("File validation", () => {
  it("should match agent files", () => {
    expect(path).toMatch(/\.agent\.md$/); // ❌ Bad: inline regex in test
  });
});
```

#### ✅ DO: Define test regex patterns at top level

```typescript
// Top-level test constants
const AGENT_FILE_PATTERN = /\.agent\.md$/;
const AGENT_ID_PATTERN = /^local:[a-z0-9-]+$/;

describe("File validation", () => {
  it("should match agent files", () => {
    expect(path).toMatch(AGENT_FILE_PATTERN); // ✅ Good: uses constant
  });
  
  it("should match agent IDs", () => {
    expect(id).toMatch(AGENT_ID_PATTERN); // ✅ Good: uses constant
  });
});
```

---

❌ **DON'T: Shadow variables in callbacks**
```typescript
const items = getItems();
items.forEach((items) => { // ❌ Confusing shadowing
  processItem(items);
});
```

✅ **DO: Use distinct parameter names**
```typescript
const items = getItems();
items.forEach((item) => { // ✅ Clear and distinct
  processItem(item);
});
```

---

❌ **DON'T: Ignore errors silently**
```typescript
try {
  await riskyOperation();
} catch (error) {
  // ❌ Silent failure
}
```

✅ **DO: Log errors with context**
```typescript
try {
  await riskyOperation();
} catch (error) {
  console.error("Failed to perform risky operation:", error); // ✅ Debuggable
  throw error; // or handle appropriately
}
```

---

❌ **DON'T: Create overly complex functions**
```typescript
function processData(data: Data) {
  // ❌ 200 lines, nested loops, multiple if-else chains
  // Complexity score: 35
}
```

✅ **DO: Break down into smaller functions**
```typescript
function processData(data: Data) {
  const validated = validateData(data);
  const transformed = transformData(validated);
  return formatOutput(transformed);
}
// ✅ Each function has complexity < 15
```

---

❌ **DON'T: Leave unnecessary biome-ignore comments**
```typescript
// biome-ignore lint/style/useReadonlyClassProperties: Will be reassigned
private property = "value"; // ❌ Comment no longer applies after implementation
```

✅ **DO: Remove obsolete ignore comments**
```typescript
private property = "value"; // ✅ Clean code without unnecessary suppressions
```

## Architecture Overview

### High-Level Structure

This is a VS Code extension that provides Agentic Spec-Driven Development capabilities, integrating with **SpecKit**, **OpenSpec**, and **GitHub Copilot**.

#### Extension (src/)

- **Main Entry**: `src/extension.ts` - Registers all commands, providers, and services
- **Features**: Domain-specific modules (specs, hooks, steering, documents)
  - `features/spec/` - Spec management and review flow
  - `features/hooks/` - MCP hooks and automation
  - `features/steering/` - Constitution/agents management
  - `features/documents/` - Document preview and refinement
- **Providers**: VS Code Tree Views and UI providers
  - `providers/spec-explorer-provider.ts` - Specs tree view
  - `providers/hooks-explorer-provider.ts` - Hooks tree view
  - `providers/prompts-explorer-provider.ts` - Prompts tree view
- **Services**: Core business logic
  - `services/prompt-loader.ts` - Loads and compiles markdown prompts
  - `services/document-preview-service.ts` - Handles document rendering
- **Panels**: Webview panels for rich UI
  - `panels/document-preview-panel.ts` - Preview/refinement UI

#### Webview (ui/)

- **React 18** SPA with TypeScript
- **Components**: Reusable UI components in `ui/src/components/`
  - `spec-explorer/` - Spec review flow components
  - `hooks-view/` - Hook management components
  - `ui/` - Shared UI components (buttons, forms, etc.)
- **Bridge**: VS Code extension ↔ webview communication via `ui/src/bridge/`
- **Stores**: State management in `ui/src/stores/`
- **Build**: Vite for bundling

### Key Architectural Patterns

1. **Dual-Build System**:
   - Extension: esbuild (Node.js bundle)
   - Webview: Vite (browser bundle)
   - Dependencies installed in both root and `ui/` directories

2. **Message Passing**: Extension communicates with webview via VS Code postMessage API
   - Commands sent from webview → extension
   - State updates sent from extension → webview

3. **MCP Integration**: Hooks system integrates with GitHub Copilot's Model Context Protocol
   - `MCPDiscoveryService` discovers available MCP servers/tools
   - `HookExecutor` executes MCP actions based on triggers

4. **Review Flow**: Spec lifecycle management with status transitions
   - States: draft → review → reopened → archived
   - Change requests block archival until addressed
   - Telemetry tracks all state transitions

5. **Test Configuration**: Vitest with dual dependency resolution
   - UI dependencies in `ui/node_modules/`
   - Testing libraries in root `node_modules/`
   - Aliases configured in `vitest.config.ts` to resolve both

## Development Workflow

### Adding a New Feature

1. **Write tests first** (TDD is mandatory)
   - Unit tests: `tests/unit/`
   - Integration tests: `tests/integration/`
   - Webview tests: `ui/tests/` or `tests/unit/webview/`

2. **Implement feature**
   - Follow kebab-case naming
   - Use strict TypeScript
   - Add telemetry/logging for significant operations

3. **Before committing**

   ```bash
   npm test           # All tests must pass
   npm run check      # Linting and formatting must pass
   ```

4. **Pre-Commit Checklist**
   - ✅ All tests passing (`npm test`)
   - ✅ Linting passes (`npm run check`)
   - ✅ No `console.log` statements (use proper logging)
   - ✅ No disabled tests (`.skip`, `.only`) unless documented
   - ✅ No TODO comments without tracking issues
   - ✅ All imports are used and necessary
   - ✅ No variable shadowing warnings
   - ✅ No excessive complexity warnings
   - ✅ Regex patterns moved to top-level constants
   - ✅ All Biome warnings resolved (not just errors)

5. **File a PR**
   - Tests included and passing
   - Constitution compliance verified
   - No test coverage decrease

### Performance Best Practices

#### Regex Compilation

**CRITICAL RULE**: All regex literals MUST be defined at module top-level as constants.

**Why**: JavaScript recompiles regex literals on every function call, causing significant performance degradation in hot paths.

**Where this applies**:
- ✅ Production code: functions, methods, callbacks
- ✅ Test code: `it()`, `describe()`, `beforeEach()`, etc.
- ✅ Inline callbacks: `.forEach()`, `.map()`, `.filter()`, etc.
- ✅ Event handlers: click handlers, onChange, etc.

**Naming convention**:
- Use SCREAMING_SNAKE_CASE
- Include context: `AGENT_FILE_PATTERN`, not just `FILE_PATTERN`
- Group related patterns together

**Example structure**:

```typescript
// ========================================
// Top-Level Constants (Regex Patterns)
// ========================================

// File patterns
const AGENT_FILE_EXTENSION = /\.agent\.md$/;
const CONFIG_FILE_PATTERN = /^config\.(json|yaml)$/;

// ID patterns
const AGENT_ID_FORMAT = /^(local|extension):[a-z0-9-]+$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Content patterns
const YAML_FRONTMATTER = /^---\n([\s\S]*?)\n---/;
const MARKDOWN_HEADING = /^#{1,6}\s+(.+)$/m;

// ========================================
// Implementation
// ========================================

function parseFile(path: string) {
  if (!AGENT_FILE_EXTENSION.test(path)) {
    throw new Error("Invalid file type");
  }
  // ... rest of implementation
}
```

**Tools to check**:
```bash
# Biome will warn about inline regex
npm run check

# Look for warnings like:
# "This regex literal is not defined in the top level scope"
```

### Running Tests for Specific Areas

```bash
# Extension tests
npm test -- tests/unit/features/spec/
npm test -- tests/integration/

# Webview tests
npm test -- ui/tests/
npm test -- tests/unit/webview/

# Specific feature
npm test -- -t "Review Flow"
npm test -- -t "MCP"
```

## Key Technologies

- **VS Code Extension API**: 1.84.0+
- **TypeScript**: 5.3+ (target: ES2022, strict mode)
- **React**: 18.3+ (webview only)
- **Vitest**: 3.2+ (testing framework)
- **Biome**: Linting and formatting
- **esbuild**: Extension bundling
- **Vite**: Webview bundling
- **GitHub Copilot Chat**: AI integration
- **MCP (Model Context Protocol)**: Automation hooks

## Integration Points

### GitHub Copilot Chat

- Extension sends prompts to Copilot Chat via `sendPromptToChat()`
- Prompts compiled from markdown files in `src/prompts/`
- Custom instructions configurable per operation type

### SpecKit / OpenSpec

- Extension detects spec system automatically
- Adapters in `utils/spec-kit-adapter.ts` provide unified interface
- SpecKit: `.specify/` directory structure
- OpenSpec: `openspec/` directory structure

### MCP Servers

- Discovered via GitHub Copilot Chat configuration
- Hooks can trigger MCP tools (create issues, send notifications, etc.)
- Graceful degradation when MCP unavailable

## Troubleshooting

### Tests Failing with "Cannot resolve import"

- Ensure UI dependencies installed: `npm run install:all`
- Check `vitest.config.ts` aliases are correct
- UI deps should be in `ui/node_modules/`

### Extension Not Loading

- Build extension: `npm run build:ext`
- Check output channel: "GatomIA" in VS Code
- Verify VS Code version >= 1.84.0

### Webview Not Rendering

- Build webview: `npm run build:webview`
- Check browser console in webview (Ctrl+Shift+I)
- Verify bridge communication in extension logs

## Recent Changes
- 010-copilot-agents: Added TypeScript 5.3 (target: ES2022, strict mode enabled)
- 001-steering-instructions-rules: Added TypeScript 5.x (strict), target ES2022 + VS Code Extension API, Node.js (extension host), React 18 + Vite (webview), Biome


## Active Technologies
- TypeScript 5.x (strict), target ES2022 + VS Code Extension API, Node.js (extension host), React 18 + Vite (webview), Biome (001-steering-instructions-rules)
- TypeScript 5.3 (target: ES2022, strict mode enabled) (010-copilot-agents)
