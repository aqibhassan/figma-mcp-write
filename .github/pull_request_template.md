## What

Brief description of what this PR does.

## Why

Why is this change needed? Link to issue if applicable.

Closes #

## How

How does this work? Describe the approach at a high level.

## Testing

How was this tested?

- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing in Figma Desktop
- [ ] Manual testing in Figma Browser

### Manual test steps

1. Start server with `npm run dev`
2. Open Figma plugin
3. ...

## Checklist

- [ ] Tests pass (`npm test`)
- [ ] TypeScript compiles (`npm run typecheck`)
- [ ] Linting passes (`npm run lint`)
- [ ] Tool descriptions are clear enough for Claude to use without docs
- [ ] Error messages are descriptive (Claude reads them to self-correct)
- [ ] No `any` types used (use `unknown` instead)
- [ ] Node IDs validated against `^\d+:\d+$` pattern
- [ ] Colors accept hex strings (`#RRGGBB` or `#RRGGBBAA`)
- [ ] CHANGELOG.md updated (if user-facing change)
- [ ] Documentation updated (if applicable)

## Screenshots / Recordings

If this changes UI or visual output, include before/after screenshots.
