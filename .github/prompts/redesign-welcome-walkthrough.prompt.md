---
description: "Redesign the GatomIA Welcome Screen by merging Install Dependencies, Configuration, and Status into a unified Setup Environment view, while keeping Features and Learn as a Walkthrough section."
agent: "agent"
tools: ["codebase", "editFiles", "search", "problems", "runTasks", "usages"]
---

# Redesign Welcome Screen: Setup Environment + Walkthrough

You are a senior VS Code extension engineer and React architect with deep expertise in TypeScript 5.x, VS Code webview APIs, Zustand state management, and VS Code UX guidelines. You have extensive experience designing onboarding flows and multi-step setup screens for developer tools.

## Goal

Redesign the GatomIA Welcome Screen by consolidating its five navigation sections into two clearly scoped top-level sections:

1. **Setup Environment** — a unified, tabbed view merging the current `setup` (Install Dependencies), `configuration`, and `status` sections into a single environment setup experience.
2. **Walkthrough** — keeps the existing `features` and `learning` sections as sub-tabs within a guided walkthrough flow.

The intent is to reduce cognitive load during onboarding: users first fix their environment (one place), then discover the product (one place).

## Current Architecture

The current welcome screen lives in `ui/src/features/welcome/` and has these files:

- `welcome-screen.tsx` — root component with navigation and view routing
- `types.ts` — TypeScript types including `ViewSection` union type
- `stores/welcome-store.ts` — Zustand store managing `currentView` and all state
- `components/setup-section.tsx` — dependency installation (GitHub Copilot Chat, SpecKit, OpenSpec)
- `components/config-section.tsx` — inline configuration editor for workspace paths/settings
- `components/status-section.tsx` — system health, version info, diagnostics
- `components/features-section.tsx` — grouped feature quick-action cards
- `components/learning-section.tsx` — categorized resources with search

The extension side lives in `src/` with:
- `src/panels/welcome-screen-panel.ts` — webview panel manager
- `src/providers/welcome-screen-provider.ts` — state aggregator and message handler
- `src/types/welcome.ts` — shared types mirrored from the webview

## Target Architecture

### Navigation Model

Replace the flat 5-item nav with a 2-item top-level nav, each with internal sub-section tabs:

```
[ Setup Environment ]  [ Walkthrough ]
       ^
       |— Dependencies    (was: setup)
       |— Configuration   (was: configuration)
       |— Status          (was: status)

[ Setup Environment ]  [ Walkthrough ]
                               ^
                               |— Features   (was: features)
                               |— Learn      (was: learning)
```

### New `ViewSection` Type

```typescript
export type TopLevelView = "setup-environment" | "walkthrough";

export type SetupSubView = "dependencies" | "configuration" | "status";
export type WalkthroughSubView = "features" | "learn";

export type ViewSection = SetupSubView | WalkthroughSubView;
```

### Component Strategy

- Create `ui/src/features/welcome/components/setup-environment-section.tsx` — a tabbed container that renders `SetupSection`, `ConfigSection`, or `StatusSection` based on the active sub-tab.
- Create `ui/src/features/welcome/components/walkthrough-section.tsx` — a tabbed container that renders `FeaturesSection` or `LearningSection` based on the active sub-tab.
- Keep all five existing section components unchanged — only their container/routing changes.
- Update `welcome-screen.tsx` to render only two top-level nav buttons and delegate sub-navigation to the container components.
- Update `types.ts` to use the new view model.
- Update `stores/welcome-store.ts` to track both `topLevelView` and `currentView` (sub-section).
- Update `src/types/welcome.ts` to mirror the new type definitions.

## Implementation Steps

Follow these steps in order. After completing each step, verify the TypeScript compiler reports no errors.

### Step 1 — Update Types

Edit `ui/src/features/welcome/types.ts`:

1. Add `TopLevelView`, `SetupSubView`, and `WalkthroughSubView` types.
2. Change `ViewSection` to be `SetupSubView | WalkthroughSubView`.
3. Add `topLevelView: TopLevelView` field to `WelcomeScreenState`.
4. Add `setTopLevelView: (view: TopLevelView) => void` to `WelcomeStore`.
5. Keep backwards compatibility: `currentView` remains as the active sub-section.

Mirror the same changes in `src/types/welcome.ts`.

### Step 2 — Update the Zustand Store

Edit `ui/src/features/welcome/stores/welcome-store.ts`:

1. Add `topLevelView: TopLevelView` to the store state, defaulting to `"setup-environment"`.
2. Add `setTopLevelView` action.
3. When `setTopLevelView("setup-environment")` is called, set `currentView` to `"dependencies"` if it is currently a walkthrough sub-view.
4. When `setTopLevelView("walkthrough")` is called, set `currentView` to `"features"` if it is currently a setup sub-view.
5. Update the `setState` action to handle the new `topLevelView` field from extension messages.

### Step 3 — Create `SetupEnvironmentSection`

Create `ui/src/features/welcome/components/setup-environment-section.tsx`:

- Props: all props needed to pass down to `SetupSection`, `ConfigSection`, and `StatusSection`, plus `activeSubView: SetupSubView` and `onSubViewChange: (view: SetupSubView) => void`.
- Render a secondary tab bar with three buttons: "Dependencies", "Configuration", "Status".
- Render the appropriate section component based on `activeSubView`.
- Use VS Code theme tokens for tab styling consistent with the existing `welcome-nav` pattern.
- The "Dependencies" tab should show a badge if any dependency is not installed (use a red dot indicator).
- The "Status" tab should show a badge if health status is not healthy.
- Export the component and its props interface.

### Step 4 — Create `WalkthroughSection`

Create `ui/src/features/welcome/components/walkthrough-section.tsx`:

- Props: all props needed to pass down to `FeaturesSection` and `LearningSection`, plus `activeSubView: WalkthroughSubView` and `onSubViewChange: (view: WalkthroughSubView) => void`.
- Render a secondary tab bar with two buttons: "Features", "Learn".
- Render `FeaturesSection` or `LearningSection` based on `activeSubView`.
- Use consistent styling with `SetupEnvironmentSection`.
- Export the component and its props interface.

### Step 5 — Update `WelcomeScreen`

Edit `ui/src/features/welcome/welcome-screen.tsx`:

1. Replace the 5-button `<nav>` with a 2-button nav: `Setup Environment` and `Walkthrough`.
2. Import and use `SetupEnvironmentSection` and `WalkthroughSection` instead of the individual section components in the `<main>` area.
3. Wire `topLevelView` and `setTopLevelView` from the store.
4. Derive `activeSetupSubView` (default `"dependencies"`) and `activeWalkthroughSubView` (default `"features"`) from `currentView`.
5. Pass the appropriate sub-view and change handler to each container component.
6. Update the `scrollToSection` function to compute both `topLevelView` and `currentView` from a given section name, for backwards compatibility with the `welcome/navigate-section` message.
7. Keep all existing message handlers (`handleInstallDependency`, `handleUpdateConfig`, etc.) — no changes to the message protocol.

### Step 6 — Update `welcome/navigate-section` Message Handling

The extension sends `welcome/navigate-section` messages with values from the old `ViewSection` union. Map old section names to the new two-level model:

```typescript
const SECTION_MAP: Record<string, { top: TopLevelView; sub: ViewSection }> = {
  setup: { top: "setup-environment", sub: "dependencies" },
  configuration: { top: "setup-environment", sub: "configuration" },
  status: { top: "setup-environment", sub: "status" },
  features: { top: "walkthrough", sub: "features" },
  learning: { top: "walkthrough", sub: "learn" },
};
```

Apply this mapping in `scrollToSection` and in the `welcome/state` message handler.

### Step 7 — Update Extension Types (if needed)

Check `src/types/welcome.ts` and `src/providers/welcome-screen-provider.ts`. If they reference old section names as literals or in arrays:

1. Update `ViewSection` to match the new union.
2. Add the `topLevelView` field to `WelcomeScreenState`.
3. Update any navigation section validation logic.

Do NOT change the message protocol (`welcome/navigate-section` values) — the extension can continue sending old section names; the webview will map them.

### Step 8 — Write Tests

For each new container component (`setup-environment-section.tsx`, `walkthrough-section.tsx`), create a corresponding test file following the project's Vitest conventions:

- `tests/unit/webview/setup-environment-section.test.tsx`
- `tests/unit/webview/walkthrough-section.test.tsx`

Each test file must cover:
- Renders the correct sub-section given `activeSubView`
- Calls `onSubViewChange` when a sub-tab is clicked
- Shows the dependency badge when a required dependency is missing (for `SetupEnvironmentSection`)
- Shows the health badge when status is not healthy (for `SetupEnvironmentSection`)

Also add tests to the store unit tests covering `setTopLevelView` behavior and automatic `currentView` correction.

## Constraints and Requirements

- **TypeScript strict mode**: No `any`, all props fully typed, no implicit returns of undefined in typed functions.
- **Kebab-case file names**: All new files must use kebab-case (e.g., `setup-environment-section.tsx`).
- **No protocol changes**: Do not modify any `welcome/*` message types or the extension-side message handling. All changes are purely UI/state.
- **VS Code theming**: Use `-var(--vscode-*)` CSS custom properties throughout. No hard-coded colors.
- **Accessibility**: New tab bars must use `role="tablist"` / `role="tab"` / `aria-selected` / `aria-controls` patterns.
- **Backward compatibility**: The `welcome/state` message still sets `currentView` using the old section names. The webview must handle both old and new values gracefully.
- **YAGNI**: Do not refactor the individual section components. Only the navigation layer and container components change.
- **No silent failures**: Log unexpected section names to the console with `[WelcomeScreen]` prefix.

## Acceptance Criteria

- [ ] Navigation shows exactly two top-level buttons: "Setup Environment" and "Walkthrough"
- [ ] Clicking "Setup Environment" shows a sub-nav with "Dependencies", "Configuration", "Status"
- [ ] Clicking "Walkthrough" shows a sub-nav with "Features", "Learn"
- [ ] The correct section component renders for each sub-nav selection
- [ ] A visual badge appears on "Dependencies" sub-tab when any required dependency is not installed
- [ ] A visual badge appears on "Status" sub-tab when system health is not healthy
- [ ] `welcome/navigate-section` messages with old section names still navigate to the correct view
- [ ] `npm run check` passes with no lint or format errors
- [ ] All new and existing tests pass
- [ ] No TypeScript compiler errors

## Output

After completing all steps, summarize:

1. All files created or modified
2. Any decisions made about ambiguous requirements
3. Any assumptions about backwards compatibility
4. Suggested follow-up improvements (but do NOT implement them unless asked)
