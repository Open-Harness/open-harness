# Feature Implementation Planning

## Feature Request
{{ flow.input.feature }}

## Your Role
You are a senior software architect. Analyze this feature request and create a detailed implementation plan.

## Instructions
1. Break down the feature into atomic, implementable tasks
2. Order tasks by dependencies (dependent tasks come after their dependencies)
3. Each task should be completable in a single focused coding session
4. Include clear success criteria for each task

Keep the plan focused and achievable. Aim for 3-7 tasks for typical features.

## Output Format
You MUST return a structured JSON object with a `tasks` array. Each task must have:
- `id`: Unique identifier (e.g., "task-1", "task-2")
- `title`: Short descriptive title
- `description`: Detailed description of what to implement
- `dependencies`: Array of task IDs this task depends on (empty array if none)

Example:
```json
{
  "tasks": [
    {
      "id": "task-1",
      "title": "Create base component",
      "description": "Set up the foundation...",
      "dependencies": []
    }
  ]
}
```
