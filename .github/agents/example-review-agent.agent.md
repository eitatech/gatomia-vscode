---
name: Example Review Agent
description: Example agent for reviewing specs after clarification. This is a simple template demonstrating custom agent usage with hooks.
---

## User Input

```text
$ARGUMENTS
```

## Review Instructions

This is an example review agent that can be triggered by hooks after spec operations.

### What to Review

When invoked with template variables like `{specId}`, `{newStatus}`, and `{specPath}`, this agent should:

1. **Load the Spec**: Read the spec file at `{specPath}`
2. **Verify Completeness**: Check that all required sections are present
3. **Validate Status**: Confirm the status transition from `{oldStatus}` to `{newStatus}` is appropriate
4. **Check Clarity**: Ensure requirements are specific and testable
5. **Review Success Criteria**: Verify that success criteria are measurable

### Output Format

Provide review feedback in this format:

```markdown
## Spec Review: {specId}

**Status**: ✅ Ready / ⚠️ Needs Work

### Completeness
- [ ] Problem statement defined
- [ ] Success criteria specified
- [ ] User stories documented
- [ ] Technical approach outlined

### Clarity Issues
- List any ambiguous requirements
- Highlight missing details
- Note inconsistencies

### Recommendations
1. Specific actionable improvements
2. Priority areas for clarification
3. Suggested next steps
```

## Example Usage

This agent is designed to be used with hooks:

**Hook Configuration**:
- **Trigger**: After `/speckit.clarify`
- **Action**: Custom Agent → "Example Review Agent"
- **Arguments**: `Please review spec {specId} which changed from {oldStatus} to {newStatus}. File: {specPath}`

**Expected Behavior**: When the clarify operation completes, this agent will automatically review the updated spec and provide structured feedback.
