# Variables and Linked Script Parameters

[User guide](./USAGE.en.md) · [Flow nodes](./FLOW_NODES.en.md)

## Variable scopes

Open **Appium → Variables** to maintain global variables and the current script's private variables. Each variable has a name, text value and optional sensitive flag. Names start with a letter or underscore and contain only letters, digits and underscores. A private variable takes precedence over a global variable with the same name.

Reference a variable as `{{NAME}}` in supported text fields, such as input, selectors, conditions, log messages and child-script arguments. A missing variable or a circular reference fails rather than silently becoming an empty string. Extracted values are treated as literal text, so text containing `{{...}}` is not evaluated again.

## Extract values and record them

Add **Extract Variable**, select the component and choose an attribute such as `text`, `content-desc`, `checked`, `enabled` or `resource-id`. The value is saved in the current runtime scope. Use **Log Output** to write `{{NAME}}` into the replay log. Runtime values do not overwrite saved preset values.

**Random Value** also writes to a selected preset-variable key. It supports text candidates, integers and UUIDs. A pool configured not to repeat is scoped to its node and replay; exhaustion fails explicitly.

## Pass arguments to linked scripts

A linked script has its own private scope. Configure explicit arguments on **Run Script**:

```json
{
  "parameters": [{ "name": "PROMPT", "value": "{{PROMPT}}" }],
  "returns": [{ "name": "RESULT", "target": "LAST_RESULT" }]
}
```

The argument `PROMPT` is resolved in the caller and passed to the child. The child's `RESULT` is copied back to the caller's `LAST_RESULT` when the child completes normally. A missing return variable is an error. Linked scripts must include all their dependencies when exported or imported together.

## Sensitive values

Sensitive variables are redacted in supported logs and reports and cleared from exported preset values. Sensitive runs also restrict screenshots and recordings. Supply credentials locally on the receiving machine; a cleared value or a redaction marker is not a usable credential. The **Copy for LLM** export also removes detected secrets and does not install exported global presets automatically.
