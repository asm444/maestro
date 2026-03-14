import type { EventBus, EventHandler } from './types.js';

export class MaestroEventBus implements EventBus {
  private listeners = new Map<string, Set<EventHandler>>();
  private onceListeners = new Map<string, Set<EventHandler>>();

  on(event: string, handler: EventHandler): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);
  }

  off(event: string, handler: EventHandler): void {
    this.listeners.get(event)?.delete(handler);
  }

  once(event: string, handler: EventHandler): void {
    if (!this.onceListeners.has(event)) {
      this.onceListeners.set(event, new Set());
    }
    this.onceListeners.get(event)!.add(handler);
  }

  async emit(event: string, payload?: unknown): Promise<void> {
    const handlers = this.listeners.get(event);
    if (handlers) {
      for (const handler of handlers) {
        await handler(payload);
      }
    }

    const onceHandlers = this.onceListeners.get(event);
    if (onceHandlers) {
      for (const handler of onceHandlers) {
        await handler(payload);
      }
      this.onceListeners.delete(event);
    }
  }

  clear(): void {
    this.listeners.clear();
    this.onceListeners.clear();
  }
}
