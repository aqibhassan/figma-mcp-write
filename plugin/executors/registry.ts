// plugin/executors/registry.ts
// Standalone registry — no imports from other executor files.
// Reading/layers/text import from here to avoid circular dependencies.

export type ExecutorFn = (
  params: Record<string, unknown>
) => Promise<{ success: boolean; data?: unknown; error?: string }>;

export const executorRegistry = new Map<string, ExecutorFn>();

export function registerExecutor(name: string, fn: ExecutorFn): void {
  executorRegistry.set(name, fn);
}

export function getExecutor(name: string): ExecutorFn | undefined {
  return executorRegistry.get(name);
}
