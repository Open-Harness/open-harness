# Implementation Task

## Current Task
**ID:** {{ task.id }}
**Title:** {{ task.title }}
**Description:** {{ task.description }}

## Previous Review Feedback
{% if state.reviewFeedback %}
**Status:** {{ state.reviewFeedback.passed }}
**Feedback:** {{ state.reviewFeedback.feedback }}
**Issues to Address:**
{% for issue in state.reviewFeedback.issues %}
- {{ issue }}
{% endfor %}
{% else %}
This is the first iteration. No previous feedback.
{% endif %}

## Instructions
1. Implement this task completely
2. If there is previous feedback, address ALL issues mentioned
3. Provide production-ready, working code
4. Include any necessary imports, type definitions, and error handling
5. Follow best practices for the language/framework being used

## Output Format
You MUST return a structured JSON object with:
- `files`: Array of file changes, each with `path`, `content`, and `action` (create/modify/delete)
- `explanation`: Brief explanation of what was implemented
- `dependencies`: Optional array of new dependencies to install

Example:
```json
{
  "files": [
    {
      "path": "src/utils/hello.ts",
      "content": "export function hello() { return 'Hello!'; }",
      "action": "create"
    }
  ],
  "explanation": "Created hello utility function",
  "dependencies": []
}
```
