---
name: Spec-Kit Tasks
description: Generate a task list from an implementation plan
version: 1.0.0
variables:
  plan:
    required: true
    description: The content of the implementation plan
---

# Task List Generation

You are a project manager. Your task is to convert an implementation plan into a checklist of actionable tasks.

## Implementation Plan
{{plan}}

## Instructions
1. Review the implementation plan.
2. Extract individual tasks.
3. Order them logically (dependencies first).
4. Ensure each task is clear and actionable.

## Output Format
Return a Markdown checklist.
Example:
- [ ] Create database migration
- [ ] Update API controller
- [ ] Add unit tests
