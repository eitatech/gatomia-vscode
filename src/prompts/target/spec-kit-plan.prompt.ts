// Auto-generated from src/prompts/spec-kit-plan.prompt.md
// DO NOT EDIT MANUALLY

export const frontmatter = {
  "name": "SpecKit Plan",
  "description": "Generate an implementation plan from a specification",
  "version": "1.0.0",
  "variables": {
    "spec": {
      "required": true,
      "description": "The content of the specification document"
    }
  }
};

export const content = "\n# Implementation Plan Generation\n\nYou are a senior software engineer. Your task is to create a detailed implementation plan based on the provided specification.\n\n## Specification\n{{spec}}\n\n## Instructions\n1. Analyze the specification carefully.\n2. Break down the implementation into logical steps.\n3. Identify necessary changes in the codebase.\n4. Create a verification plan to ensure the feature works as expected.\n\n## Output Format\nReturn the plan in Markdown format with the following sections:\n- **Proposed Changes**: Detailed list of changes (files, classes, methods).\n- **Verification Plan**: Steps to verify the implementation (automated tests, manual checks).\n";

export default {
  frontmatter,
  content
};
