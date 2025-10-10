# NextJS Plugin Output - No Detection Example

This shows what happens when the NextJS plugin does NOT detect Next.js in a project.

## Scenario
- No Next.js dependency in package.json
- Could be a different framework (React, Vue, plain HTML, etc.)
- Plugin's `detect()` method returns `false`

## Plugin Output

*No output - the plugin's `compile()` method is never called when detection fails.*

## Detection Log
```
(No log message - plugin detection returned false)
```

## Explanation
When the NextJS plugin's `detect()` method returns `false`, the AgentBoost framework:
1. Does not add this plugin to the detected plugins list
2. Does not call the plugin's `compile()` method
3. Does not include any NextJS-related content in the final AGENTS.md

This means if there's no `next` dependency in package.json (either in dependencies or devDependencies), the NextJS plugin contributes nothing to the output.