import type { MaestroModule, Kernel } from './types.js';

export class ModuleLoader {
  private modules = new Map<string, MaestroModule>();
  private initialized = new Set<string>();

  register(mod: MaestroModule): void {
    if (this.modules.has(mod.name)) {
      throw new Error(`Module "${mod.name}" already registered`);
    }
    this.modules.set(mod.name, mod);
  }

  get<T extends MaestroModule>(name: string): T {
    const mod = this.modules.get(name);
    if (!mod) {
      throw new Error(`Module "${name}" not found. Available: ${[...this.modules.keys()].join(', ')}`);
    }
    return mod as T;
  }

  has(name: string): boolean {
    return this.modules.has(name);
  }

  async initAll(kernel: Kernel): Promise<void> {
    const sorted = this.topologicalSort();
    for (const name of sorted) {
      await this.initModule(name, kernel);
    }
  }

  async disposeAll(): Promise<void> {
    const sorted = this.topologicalSort().reverse();
    for (const name of sorted) {
      const mod = this.modules.get(name)!;
      await mod.dispose();
      this.initialized.delete(name);
    }
  }

  private async initModule(name: string, kernel: Kernel): Promise<void> {
    if (this.initialized.has(name)) return;

    const mod = this.modules.get(name);
    if (!mod) throw new Error(`Module "${name}" not found`);

    if (mod.dependencies) {
      for (const dep of mod.dependencies) {
        if (!this.modules.has(dep)) {
          throw new Error(`Module "${name}" depends on "${dep}" which is not registered`);
        }
        await this.initModule(dep, kernel);
      }
    }

    await mod.init(kernel);
    this.initialized.add(name);
  }

  private topologicalSort(): string[] {
    const visited = new Set<string>();
    const sorted: string[] = [];
    const visiting = new Set<string>();

    const visit = (name: string): void => {
      if (visited.has(name)) return;
      if (visiting.has(name)) {
        throw new Error(`Circular dependency detected involving "${name}"`);
      }

      visiting.add(name);
      const mod = this.modules.get(name)!;
      if (mod.dependencies) {
        for (const dep of mod.dependencies) {
          visit(dep);
        }
      }
      visiting.delete(name);
      visited.add(name);
      sorted.push(name);
    };

    for (const name of this.modules.keys()) {
      visit(name);
    }

    return sorted;
  }

  listModules(): string[] {
    return [...this.modules.keys()];
  }
}
