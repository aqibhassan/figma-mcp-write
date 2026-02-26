// plugin/executors/index.ts
//
// Re-exports registry and triggers all executor registrations.
// The registry itself lives in registry.ts to avoid circular dependencies
// (reading/layers/text import from registry.ts, not index.ts).

export { ExecutorFn, executorRegistry, registerExecutor, getExecutor } from "./registry.js";

// Side-effect imports: each file calls registerExecutor(...)
import "./reading.js";
import "./layers.js";
import "./text.js";
import "./styling.js";
import "./layout.js";
import "./components.js";
import "./pages.js";
import "./vectors.js";
import "./export.js";
import "./variables.js";
import "./superpowers.js";
