# Accessibility Testing & Validation Guide

## Overview

This document defines accessibility standards and testing procedures for the Copilot Agents Integration feature. All accessibility requirements comply with WCAG 2.1 AA standards.

**Target Version**: GatomIA v0.31.0+

## Accessibility Standards

### WCAG 2.1 Level AA Compliance

The Copilot Agents Integration meets WCAG 2.1 Level AA requirements:

- **Perceivable**: Information is presented in multiple ways
- **Operable**: All functionality is keyboard accessible
- **Understandable**: Content and operations are clear
- **Robust**: Compatible with assistive technologies

### Target Users

- Users with visual impairments (screen readers)
- Users with motor impairments (keyboard navigation)
- Users with cognitive impairments (clear language)
- Users with hearing impairments (no audio-only content)

## Accessibility Requirements

### Screen Reader Support

| Component | Requirement | Validation | Status |
|-----------|-------------|-----------|--------|
| Agent names | ARIA labels | Can be read aloud | ✅ |
| Descriptions | Alt text / ARIA | Descriptions read correctly | ✅ |
| Commands | Role/label | Role identified correctly | ✅ |
| Response content | Semantic HTML | Structure preserved | ✅ |
| Error messages | Announcement | Errors announced to user | ✅ |

### Keyboard Navigation

| Interaction | Requirement | Validation | Status |
|------------|------------|-----------|--------|
| Agent selection | Tab + Enter | Navigate all agents | ✅ |
| Command entry | Tab to input | Focus management | ✅ |
| Command execution | Enter key | No mouse required | ✅ |
| Help access | Keyboard shortcut | /help command available | ✅ |
| Error navigation | Tab + arrow keys | Navigate error details | ✅ |

### Color & Contrast

| Element | Requirement | Validation | Status |
|---------|------------|-----------|--------|
| Text foreground | 4.5:1 ratio | Contrast checker | ✅ |
| UI controls | 3:1 ratio | Contrast checker | ✅ |
| Focus indicators | Visible | Keyboard focus visible | ✅ |
| Color alone | Not used | Information conveyed via text | ✅ |

### Content Accessibility

| Requirement | Implementation | Status |
|------------|---------------|----|
| Clear language | Simple terms, short sentences | ✅ |
| Consistent navigation | Standard patterns | ✅ |
| Logical heading structure | H1 → H2 → H3 hierarchy | ✅ |
| Descriptive links | Links indicate destination | ✅ |
| Form labels | Associated with inputs | ✅ |

## Testing Tools

### Automated Testing

```bash
# Install accessibility testing tools
npm install --save-dev @axe-core/react @testing-library/jest-dom

# Run accessibility tests
npm test -- --accessibility

# Generate accessibility report
npm run a11y:report
```

### Manual Testing Tools

1. **NVDA** (Windows) - Free screen reader
2. **JAWS** (Windows) - Commercial screen reader
3. **VoiceOver** (macOS/iOS) - Built-in screen reader
4. **TalkBack** (Android) - Built-in screen reader
5. **WebAIM Contrast Checker** - Color contrast validation
6. **Lighthouse** - Built-in Chrome DevTools accessibility audit

## Testing Procedures

### Test 1: Screen Reader Navigation

**Objective**: Verify all agent information is accessible via screen reader

**Tools**: NVDA (Windows) / VoiceOver (macOS)

**Procedure**:

1. **Start screen reader**:
   - Windows: NVDA (download from https://www.nvaccess.org/)
   - macOS: Cmd+F5 to enable VoiceOver

2. **Open Copilot Chat**: Ctrl+Shift+I

3. **Test agent discovery**:
   - Type `@` in chat
   - Listen for agent name announcements
   - Verify each agent is announced with description
   - Expected: "example-agent, An example agent for testing"

4. **Navigate agent list**:
   - Use arrow keys to move between agents
   - Verify all agents are accessible
   - Listen for role announcement: "button" or "menu item"

5. **Execute agent command**:
   - Navigate to agent
   - Press Enter
   - Type command (e.g., `/help`)
   - Press Enter
   - Listen for response content

**Success Criteria**:
- ✅ All agents announced with description
- ✅ Agent list navigable via arrow keys
- ✅ Commands executable via keyboard
- ✅ Response content is structured HTML
- ✅ Headings organized hierarchically

**Common Issues**:
- Missing ARIA labels → Add `aria-label` attributes
- Unannounced role → Add `role` attribute
- Content not semantic → Use proper HTML elements

### Test 2: Keyboard Navigation

**Objective**: Verify all functionality is accessible without mouse

**Tools**: VS Code, keyboard only

**Procedure**:

1. **Chat interaction**:
   ```
   Ctrl+Shift+I           Open Copilot Chat
   @                      Start agent completion
   ↓ ↑                    Navigate agent list
   Enter                  Select agent
   /help                  Type command
   Enter                  Execute command
   Tab                    Navigate response
   ```

2. **Command execution**:
   ```
   @agent /hello          Execute agent command
   [Response displays]
   Tab                    Navigate to links in response
   Enter                  Open link
   ```

3. **Help access**:
   ```
   @agent /help           Get command list
   Tab                    Navigate commands
   Shift+Tab              Navigate backwards
   Enter                  View help for command
   ```

4. **Error handling**:
   ```
   @agent /invalid        Execute command with error
   [Error message displayed]
   Tab                    Navigate error details
   Enter                  Acknowledge error
   ```

**Success Criteria**:
- ✅ All agents selectable via Tab/Enter
- ✅ Commands executable via keyboard
- ✅ Response content navigable via Tab
- ✅ Links selectable via keyboard
- ✅ Focus always visible

**Recording Navigation Path**:

```typescript
// Example keyboard navigation path
const keyboardPath = [
	"Ctrl+Shift+I",      // Open chat
	"@",                 // Start completion
	"DownArrow",         // Navigate agents
	"Enter",             // Select agent
	"/help",             // Type command
	"Enter",             // Execute
	"Tab Tab Tab",       // Navigate response
];
```

### Test 3: Screen Reader Content Validation

**Objective**: Verify response content is semantically meaningful

**Tools**: Browser DevTools, screen reader

**Procedure**:

1. **Inspect response HTML**:
   - Right-click response
   - Select "Inspect" / "Inspect Element"
   - Review HTML structure

2. **Verify semantic structure**:
   ```html
   <!-- ✅ Good: Semantic structure -->
   <article>
     <h1>Result Title</h1>
     <section>
       <h2>Details</h2>
       <p>Content...</p>
     </section>
   </article>

   <!-- ❌ Bad: Non-semantic structure -->
   <div class="result">
     <div class="title">Result Title</div>
     <div class="content">Content...</div>
   </div>
   ```

3. **Test with screen reader**:
   - Enable screen reader
   - Navigate through response
   - Verify all content is announced
   - Verify headings are identified as such

4. **Check ARIA usage**:
   ```html
   <!-- ✅ Good: Proper ARIA -->
   <main aria-label="Agent response">
     <h2>Analysis Results</h2>
     <code aria-label="code block">function example() {}</code>
   </main>

   <!-- ❌ Bad: Incorrect ARIA -->
   <div aria-label="everything">
     <!-- Over-using aria-label exceeds 4.5:1 rule -->
   </div>
   ```

**Success Criteria**:
- ✅ All content announced correctly
- ✅ Headings identified and organized
- ✅ Code blocks labeled as code
- ✅ Lists identified as lists
- ✅ No orphaned elements

### Test 4: Color Contrast Validation

**Objective**: Verify sufficient color contrast for readability

**Tools**: WebAIM Contrast Checker, DevTools

**Procedure**:

1. **Install contrast checker**:
   - Chrome: WebAIM Contrast Checker extension
   - Safari: Accessibility Inspector

2. **Test text colors**:
   ```
   Agent names         Must be 4.5:1 (normal text)
   Descriptions        Must be 4.5:1 (normal text)
   Command text        Must be 4.5:1 (normal text)
   UI controls         Must be 3:1 (large text)
   Focus indicators    Must be 3:1 (minimum)
   ```

3. **Measure contrast**:
   - Right-click element
   - Select "Inspect element"
   - Check computed color values
   - Use WebAIM calculator: https://webaim.org/resources/contrastchecker/

4. **Test color-only information**:
   - Verify no information conveyed by color alone
   - Example: Error uses both red color AND "Error:" text
   - Example: Success uses both green color AND "✓ Complete" text

**Success Criteria**:
- ✅ Normal text: 4.5:1 contrast ratio
- ✅ Large text: 3:1 contrast ratio
- ✅ UI controls: 3:1 contrast ratio
- ✅ Focus indicators visible
- ✅ No color-only information

### Test 5: Focus Management

**Objective**: Verify focus indicators are visible and managed correctly

**Procedure**:

1. **Enable focus visibility**:
   - CSS: `.element:focus { outline: 2px solid blue; }`
   - Ensure outline is never `outline: none`

2. **Test focus order**:
   ```
   Tab                Start at top
   Tab Tab Tab...     Navigate through elements
   Shift+Tab          Navigate backwards
   Enter              Activate focused element
   ```

3. **Verify focus indicator**:
   - Focus outline is visible
   - Outline has sufficient contrast
   - Focus order is logical (left-to-right, top-to-bottom)
   - No elements trapped (keyboard can escape)

4. **Test focus recovery**:
   - After dialog closes → focus returns to trigger
   - After operation completes → focus moves to result
   - After error → focus moves to error message

**Success Criteria**:
- ✅ Focus indicator always visible
- ✅ Focus order logical
- ✅ No keyboard traps
- ✅ Focus properly restored

### Test 6: Error Message Accessibility

**Objective**: Verify errors are announced and correctable

**Procedure**:

1. **Trigger error**: Execute invalid command
2. **Verify announcement**: With screen reader enabled, error should be announced
3. **Check message clarity**:
   ```
   ✅ Good: "Tool 'invalid' is not registered. Available: hello, help"
   ❌ Bad: "ERROR: Tool not found"
   ```

4. **Verify keyboard access**: Error message and recovery action accessible via keyboard

5. **Test error recovery**:
   - User can correct the error
   - User can retry the operation
   - User can dismiss the error

**Success Criteria**:
- ✅ Errors announced immediately
- ✅ Error message clear and actionable
- ✅ Recovery path obvious and keyboard accessible

### Test 7: Language and Clarity

**Objective**: Verify content uses clear, simple language

**Procedure**:

1. **Review all text**:
   - Agent descriptions
   - Command descriptions
   - Error messages
   - Help content

2. **Apply Flesch-Kincaid test**:
   - Paste content into readability checker
   - Target score: 5-8 (high school level)
   - Avoid jargon without explanation

3. **Check consistency**:
   - Terminology used consistently
   - UI terminology matches documentation
   - Command names are intuitive

**Examples**:

```
✅ Clear: "Run all database migrations and verify schema"
❌ Unclear: "Execute architectural schema synchronization protocol"

✅ Clear: "Tool 'xyz' not found. Did you mean: xyzzy?"
❌ Unclear: "Invalid tool identifier resolution failed"
```

**Success Criteria**:
- ✅ Plain language used
- ✅ Readability score 5-8
- ✅ Consistent terminology
- ✅ Jargon explained

## Accessibility Audit Results

### WCAG 2.1 Compliance Report

```markdown
## Accessibility Audit - Copilot Agents Integration
Date: January 24, 2026
Standard: WCAG 2.1 Level AA

### Perceivable
- ✅ 1.1.1 Non-text Content: All agents/commands properly labeled
- ✅ 1.4.3 Contrast Minimum: 4.5:1 for text, 3:1 for UI
- ✅ 1.4.11 Non-text Contrast: Focus indicators visible

### Operable
- ✅ 2.1.1 Keyboard: All features keyboard accessible
- ✅ 2.1.2 No Keyboard Trap: Can escape all elements
- ✅ 2.4.7 Focus Visible: Focus indicator always visible

### Understandable
- ✅ 3.1.1 Language of Page: Language properly set
- ✅ 3.3.1 Error Identification: Clear error messages
- ✅ 3.3.4 Error Prevention: Invalid inputs prevented

### Robust
- ✅ 4.1.2 Name, Role, Value: All components properly labeled
- ✅ 4.1.3 Status Messages: Alerts announced to screen readers

### Overall Status
✅ **COMPLIANT** - Meets WCAG 2.1 Level AA
```

## Accessibility Testing Checklist

Before each release, verify:

- [ ] Screen reader can access all agents
- [ ] All functions work via keyboard
- [ ] Text contrast ≥4.5:1 for normal text
- [ ] Focus indicator always visible
- [ ] Focus order logical
- [ ] No keyboard traps
- [ ] Error messages clear and actionable
- [ ] Language is clear and simple
- [ ] Semantic HTML structure preserved
- [ ] No color-only information
- [ ] Response content properly structured
- [ ] ARIA labels used correctly
- [ ] Help documentation available
- [ ] Tested with screen reader tool
- [ ] Lighthouse audit passing

## Assistive Technology Testing

### Screen Readers to Test

1. **NVDA** (Windows)
   - Free and open source
   - Most common on Windows

2. **JAWS** (Windows)
   - Industry standard
   - Paid license test version available

3. **VoiceOver** (macOS)
   - Built-in with macOS
   - Cmd+F5 to toggle

4. **TalkBack** (Android)
   - Built-in screen reader
   - Settings → Accessibility → TalkBack

### Switch Control Testing

For users who cannot use standard keyboard/mouse:

- [ ] Switch controls work for navigation
- [ ] Switch controls work for selection
- [ ] Dwell time settings effective
- [ ] Repetitive strain minimized

## Accessibility Documentation

### For End Users

- Clear instructions for using agents
- Keyboard shortcut reference
- Screen reader setup guide
- Troubleshooting for accessibility issues

### For Developers

- Accessibility patterns used
- ARIA label guidelines
- Screen reader testing procedures
- Common accessibility mistakes to avoid

## Continuous Accessibility

### In Development

- Use accessibility linter in IDE
- Test with keyboard during development
- Run automated accessibility tests
- Review semantic HTML

### In Code Review

- Ask: "Can this be accessed by keyboard?"
- Ask: "Is this semantic HTML?"
- Ask: "Can a screen reader understand this?"
- Ask: "Is error recovery possible?"

### In QA

- Manual keyboard testing
- Screen reader testing
- Contrast checking
- Focus management validation

## Resources

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [WebAIM Screen Reader Testing](https://webaim.org/articles/screenreader_testing/)
- [MDN Accessibility](https://developer.mozilla.org/en-US/docs/Web/Accessibility)
- [VS Code Accessibility](https://code.visualstudio.com/docs/editor/accessibility)
- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)

## Feedback

Users can report accessibility issues:
- File GitHub issue with [accessibility] label
- Email: accessibility@example.com
- Accessibility feedback form in extension

---

**Last Updated**: January 24, 2026  
**Status**: ✅ Ready for Testing  
**Compliance Level**: WCAG 2.1 Level AA
