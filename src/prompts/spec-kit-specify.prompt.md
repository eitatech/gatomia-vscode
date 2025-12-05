---
name: SpecKit Specify
description: Generate a specification document from context
version: 1.0.0
variables:
  context:
    required: true
    description: The context for the specification (product requirements, scenarios, etc.)
---

# Specification Generation

You are an expert software architect. Your task is to create a comprehensive technical specification based on the provided context.

## Context
{{context}}

## Instructions
1. Analyze the context provided.
2. Create a detailed specification following the SpecKit format.
3. Include the following sections:
   - **Overview**: High-level summary of the feature.
   - **Scenarios**: User scenarios or use cases.
   - **Constraints**: Technical or business constraints.
   - **Data Model**: Changes to the data model (if any).
   - **API Changes**: Changes to APIs (if any).
   - **Security**: Security considerations.

## Output Format
Return the specification in Markdown format. Do not include the "Status" section as it is managed by the system.
