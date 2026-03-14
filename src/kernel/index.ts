import type { Kernel, MaestroConfig, MaestroModule, EventBus } from './types.js';
import { MaestroEventBus } from './event-bus.js';
import { ModuleLoader } from './module-loader.js';
import { defaultConfig } from './types.js';

export class MaestroKernel implements Kernel {
  readonly bus: EventBus;
  readonly config: MaestroConfig;
  private loader: ModuleLoader;

  constructor(repoRoot: string, configOverrides?: Partial<MaestroConfig>) {
    this.config = { ...defaultConfig(repoRoot), ...configOverrides };
    this.bus = new MaestroEventBus();
    this.loader = new ModuleLoader();
  }

  registerModule(mod: MaestroModule): void {
    this.loader.register(mod);
  }

  getModule<T extends MaestroModule>(name: string): T {
    return this.loader.get<T>(name);
  }

  hasModule(name: string): boolean {
    return this.loader.has(name);
  }

  async boot(): Promise<void> {
    await this.loader.initAll(this);
  }

  async shutdown(): Promise<void> {
    await this.loader.disposeAll();
    (this.bus as MaestroEventBus).clear();
  }

  listModules(): string[] {
    return this.loader.listModules();
  }
}

export { MaestroEventBus } from './event-bus.js';
export { ModuleLoader } from './module-loader.js';
export * from './types.js';
