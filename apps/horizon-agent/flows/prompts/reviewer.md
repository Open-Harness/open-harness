# Code Review

## Task Being Reviewed
**ID:** {{ task.id }}
**Title:** {{ task.title }}
**Description:** {{ task.description }}

## Implementation to Review
{{ coder.text }}

## Review Criteria
1. **Correctness:** Does the implementation fully satisfy the task requirements?
2. **Code Quality:** Is the code clean, readable, and maintainable?
3. **Edge Cases:** Are error conditions and edge cases handled appropriately?
4. **Best Practices:** Does it follow language/framework conventions?
5. **Completeness:** Is anything missing that the task description requires?

## Instructions
- Be thorough but fair in your review
- Only fail the implementation if there are genuine issues
- Provide specific, actionable feedback for any issues found
- If the code is production-ready, approve it

## Output Format
You MUST return a structured JSON object with:
- `passed`: Boolean - true if the implementation is approved, false if it needs changes
- `feedback`: String summary of your review
- `issues`: Array of specific issues to address (empty if passed)

Example (passing):
```json
{
  "passed": true,
  "feedback": "Implementation is complete and follows best practices.",
  "issues": []
}
```

Example (failing):
```json
{
  "passed": false,
  "feedback": "Implementation has issues that need to be addressed.",
  "issues": ["Missing error handling for null input", "Function name should be camelCase"]
}
```
