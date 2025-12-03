// Auto-generated from src/prompts/spec-kit-tasks.prompt.md
// DO NOT EDIT MANUALLY

export const frontmatter = {
  "name": "Spec-Kit Tasks",
  "description": "Generate a task list from an implementation plan",
  "version": "1.0.0",
  "variables": {
    "plan": {
      "required": true,
      "description": "The content of the implementation plan"
    }
  }
};

export const content = "\n# Task List Generation\n\nYou are a project manager. Your task is to convert an implementation plan into a checklist of actionable tasks.\n\n## Implementation Plan\n{{plan}}\n\n## Instructions\n1. Review the implementation plan.\n2. Extract individual tasks.\n3. Order them logically (dependencies first).\n4. Ensure each task is clear and actionable.\n\n## Output Format\nReturn a Markdown checklist.\nExample:\n- [ ] Create database migration\n- [ ] Update API controller\n- [ ] Add unit tests\n";

export default {
  frontmatter,
  content
};
