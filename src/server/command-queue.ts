// src/server/command-queue.ts
import { randomUUID } from "crypto";
import {
  Command,
  CommandResponse,
  createSuccessResponse,
  createErrorResponse,
  DEFAULT_TIMEOUT,
  BULK_TIMEOUT,
  MAX_BATCH_SIZE,
} from "../../shared/protocol.js";

interface PendingCommand {
  resolve: (response: CommandResponse) => void;
  timer: ReturnType<typeof setTimeout>;
}

type CommandListener = (command: Command) => void;

export class CommandQueue {
  private pending = new Map<string, PendingCommand>();
  private listener: CommandListener | null = null;

  get pendingCount(): number {
    return this.pending.size;
  }

  onCommand(listener: CommandListener): void {
    this.listener = listener;
  }

  enqueue(
    type: string,
    params: Record<string, unknown>,
    timeout: number = DEFAULT_TIMEOUT
  ): Promise<CommandResponse> {
    const command: Command = {
      id: randomUUID(),
      type,
      params,
    };

    return new Promise<CommandResponse>((resolvePromise) => {
      const timer = setTimeout(() => {
        this.pending.delete(command.id);
        resolvePromise(
          createErrorResponse(
            command.id,
            `Command '${type}' timed out after ${timeout}ms`
          )
        );
      }, timeout);

      this.pending.set(command.id, { resolve: resolvePromise, timer });

      if (this.listener) {
        this.listener(command);
      }
    });
  }

  enqueueBatch(
    commands: { type: string; params: Record<string, unknown> }[],
    timeout: number = BULK_TIMEOUT
  ): Promise<CommandResponse> {
    if (commands.length > MAX_BATCH_SIZE) {
      const id = randomUUID();
      return Promise.resolve(
        createErrorResponse(
          id,
          `Batch size ${commands.length} exceeds maximum of ${MAX_BATCH_SIZE}`
        )
      );
    }

    const batch: Command[] = commands.map((cmd) => ({
      id: randomUUID(),
      type: cmd.type,
      params: cmd.params,
    }));

    const batchCommand: Command = {
      id: randomUUID(),
      type: "batch",
      params: {},
      batch,
    };

    return new Promise<CommandResponse>((resolvePromise) => {
      const timer = setTimeout(() => {
        this.pending.delete(batchCommand.id);
        resolvePromise(
          createErrorResponse(
            batchCommand.id,
            `Batch command timed out after ${timeout}ms`
          )
        );
      }, timeout);

      this.pending.set(batchCommand.id, { resolve: resolvePromise, timer });

      if (this.listener) {
        this.listener(batchCommand);
      }
    });
  }

  resolve(id: string, data?: unknown): void {
    const pending = this.pending.get(id);
    if (!pending) return;

    clearTimeout(pending.timer);
    this.pending.delete(id);
    pending.resolve(createSuccessResponse(id, data));
  }

  reject(id: string, error: string): void {
    const pending = this.pending.get(id);
    if (!pending) return;

    clearTimeout(pending.timer);
    this.pending.delete(id);
    pending.resolve(createErrorResponse(id, error));
  }

  resolveWithResponse(response: CommandResponse): void {
    const pending = this.pending.get(response.id);
    if (!pending) return;

    clearTimeout(pending.timer);
    this.pending.delete(response.id);
    pending.resolve(response);
  }

  clear(): void {
    for (const [id, pending] of this.pending) {
      clearTimeout(pending.timer);
      pending.resolve(
        createErrorResponse(id, "Command queue cleared — connection lost")
      );
    }
    this.pending.clear();
  }
}
