// src/server/tools/variables.ts

export const VARIABLES_TOOL_NAME = "figma_variables";

export const VARIABLES_TOOL_DESCRIPTION =
  `Manage Figma variables (design tokens). Commands: create_variable, set_variable_value, create_variable_collection, bind_variable. ` +
  `Use create_variable_collection to create a collection with modes (e.g., Light/Dark). ` +
  `Use create_variable to create a color, number, string, or boolean variable in a collection. ` +
  `Use set_variable_value to set a variable's value for a specific mode. ` +
  `Use bind_variable to bind a variable to a node property (e.g., fills, cornerRadius, itemSpacing).`;

export const VARIABLES_TOOL_SCHEMA = {
  type: "object" as const,
  properties: {
    command: {
      type: "string" as const,
      enum: [
        "create_variable",
        "set_variable_value",
        "create_variable_collection",
        "bind_variable",
      ],
      description: "The variable command to execute",
    },
    params: {
      type: "object" as const,
      description:
        "Parameters for the command. " +
        "create_variable_collection: { name, modes?: string[] }. " +
        "create_variable: { name, collectionId, resolvedType: 'COLOR'|'FLOAT'|'STRING'|'BOOLEAN', value? }. " +
        "set_variable_value: { variableId, modeId, value }. " +
        "bind_variable: { nodeId, property, variableId }.",
    },
  },
  required: ["command", "params"],
};

export const VARIABLES_COMMANDS = [
  "create_variable",
  "set_variable_value",
  "create_variable_collection",
  "bind_variable",
];
