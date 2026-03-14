import type {
  MaestroModule,
  Kernel,
  DiscoveryResult,
} from '../../kernel/types.js';
import { EVENTS } from '../../kernel/types.js';
import { StackDetector } from './stack-detector.js';
import { McpDetector } from './mcp-detector.js';
import { SkillDetector } from './skill-detector.js';

// ============================================================
// DiscoveryModule — orchestrates all three detectors
// ============================================================

export class DiscoveryModule implements MaestroModule {
  readonly name = 'discovery';
  readonly version = '2.0.0';
  readonly dependencies: string[] = [];

  private kernel!: Kernel;
  private stackDetector = new StackDetector();
  private mcpDetector = new McpDetector();
  private skillDetector = new SkillDetector();

  /** In-memory cache: invalidated by calling discover() again. */
  private cache: DiscoveryResult | null = null;

  async init(kernel: Kernel): Promise<void> {
    this.kernel = kernel;
  }

  async dispose(): Promise<void> {
    this.cache = null;
  }

  // ── Public API ────────────────────────────────────────────────

  /**
   * Runs all three detectors concurrently, caches the result, and
   * emits a 'discovery:complete' event on the kernel bus.
   *
   * Calling discover() again invalidates the previous cache.
   */
  async discover(repoRoot: string): Promise<DiscoveryResult> {
    const [stack, mcps, skills] = await Promise.all([
      this.stackDetector.detect(repoRoot),
      this.mcpDetector.detect(repoRoot),
      this.skillDetector.detect(),
    ]);

    const result: DiscoveryResult = { stack, mcps, skills };

    // Update cache and emit event
    this.cache = result;
    await this.kernel.bus.emit(EVENTS.DISCOVERY_COMPLETE, result);

    return result;
  }

  /**
   * Returns the cached discovery result without re-running detection.
   * Returns null if discover() has never been called.
   */
  getCached(): DiscoveryResult | null {
    return this.cache;
  }

  /**
   * Convenience: returns the cached result or runs discovery if cache is empty.
   */
  async getOrDiscover(repoRoot: string): Promise<DiscoveryResult> {
    if (this.cache) return this.cache;
    return this.discover(repoRoot);
  }
}
