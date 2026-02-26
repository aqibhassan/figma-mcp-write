---
name: New Tool Proposal
about: Propose a new tool to add to the MCP server
title: "[Tool] "
labels: new-tool
assignees: ""
---

## Tool Name

`my_tool_name`

## Category

Which category should this tool belong to?

- [ ] Layer management
- [ ] Text
- [ ] Styling
- [ ] Layout
- [ ] Components
- [ ] Pages
- [ ] Vectors
- [ ] Export
- [ ] Variables
- [ ] Reading
- [ ] Superpowers

## Description

What does this tool do? Write the description as it would appear in the MCP tool definition (clear enough for Claude to use without docs).

## Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `nodeId` | string | Yes | Target node ID in Figma format (`1234:5678`) |
| | | | |
| | | | |

## Return Value

```json
{
  "nodeId": "1234:5678",
  "name": "NodeName"
}
```

## Use Cases

1. First use case — describe a scenario where this tool is needed
2. Second use case — another scenario
3. How Claude would use this in a compound operation

## Figma API Reference

Which Figma Plugin API methods does this tool use?

- [`figma.getNodeById()`](https://www.figma.com/plugin-docs/api/figma/#getnodebyid)
- Add relevant API links here

## Implementation Notes

Any technical considerations, edge cases, or constraints to be aware of.
