# Commenting Standard

## Principles

- Prefer clear names and small functions over comments that explain obvious code.
- Comment why a non-obvious decision exists, not what each line does.
- Keep comments current when behavior changes.
- Do not add noisy section banners unless they match an existing file style.
- Never place secrets, credentials, tokens, customer private data, or private URLs
  in comments.

## When To Comment

Add a short comment when code includes:

- Business rules that are not obvious from the implementation.
- Integration quirks or third-party API limitations.
- Data-shape conversion between Supabase, local state, and UI types.
- Temporary fallbacks or migration support.
- Risky logic where future edits could break persistence, auth, routing, or
  external integrations.

## When Not To Comment

Avoid comments for:

- Simple imports, props, assignments, or event handlers.
- Repeating function names in prose.
- Explaining standard React, TypeScript, or JavaScript syntax.
- TODOs that do not name a concrete next step.

## TODO Format

Use this format when a follow-up is intentional:

```ts
// TODO(owner/date): Concrete next step and why it is deferred.
```

If there is no known owner, use `team`.

## Documentation Expectations

When code changes affect product behavior, architecture, file relationships, env
vars, integration contracts, or delivery status, update the matching file in
`docs/context/`.
