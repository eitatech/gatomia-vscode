---
name: Spec-Kit Plan
description: Generate an implementation plan from a specification
version: 1.0.0
variables:
  spec:
    required: true
    description: The content of the specification document
---

# Implementation Plan Generation

You are a senior software engineer. Your task is to create a detailed implementation plan based on the provided specification.

## Specification
{{spec}}

## Instructions
1. Analyze the specification carefully.
2. Break down the implementation into logical steps.
3. Identify necessary changes in the codebase.
4. Create a verification plan to ensure the feature works as expected.

## Output Format
Return the plan in Markdown format with the following sections:
- **Proposed Changes**: Detailed list of changes (files, classes, methods).
- **Verification Plan**: Steps to verify the implementation (automated tests, manual checks).
