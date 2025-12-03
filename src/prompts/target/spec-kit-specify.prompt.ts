// Auto-generated from src/prompts/spec-kit-specify.prompt.md
// DO NOT EDIT MANUALLY

export const frontmatter = {
  "name": "Spec-Kit Specify",
  "description": "Generate a specification document from context",
  "version": "1.0.0",
  "variables": {
    "context": {
      "required": true,
      "description": "The context for the specification (product requirements, scenarios, etc.)"
    }
  }
};

export const content = "\n# Specification Generation\n\nYou are an expert software architect. Your task is to create a comprehensive technical specification based on the provided context.\n\n## Context\n{{context}}\n\n## Instructions\n1. Analyze the context provided.\n2. Create a detailed specification following the Spec-Kit format.\n3. Include the following sections:\n   - **Overview**: High-level summary of the feature.\n   - **Scenarios**: User scenarios or use cases.\n   - **Constraints**: Technical or business constraints.\n   - **Data Model**: Changes to the data model (if any).\n   - **API Changes**: Changes to APIs (if any).\n   - **Security**: Security considerations.\n\n## Output Format\nReturn the specification in Markdown format. Do not include the \"Status\" section as it is managed by the system.\n";

export default {
  frontmatter,
  content
};
