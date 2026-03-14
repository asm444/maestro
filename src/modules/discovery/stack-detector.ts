import { readFile, access } from 'fs/promises';
import { join } from 'path';
import type { StackInfo, DetectedCommands } from '../../kernel/index.js';

// ============================================================
// StackDetector — auto-detects language, frameworks, and tools
// ============================================================

interface PackageJson {
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

export class StackDetector {
  /**
   * Detects the technology stack rooted at `repoRoot`.
   * Never throws: missing files are silently treated as absent.
   */
  async detect(repoRoot: string): Promise<StackInfo> {
    const [
      packageJson,
      hasRequirements,
      hasPyproject,
      hasGoMod,
      hasCargo,
      hasPom,
      hasGemfile,
      hasYarnLock,
      hasPnpmLock,
      hasBunLock,
      ciCd,
    ] = await Promise.all([
      this.readPackageJson(repoRoot),
      this.exists(join(repoRoot, 'requirements.txt')),
      this.exists(join(repoRoot, 'pyproject.toml')),
      this.exists(join(repoRoot, 'go.mod')),
      this.exists(join(repoRoot, 'Cargo.toml')),
      this.exists(join(repoRoot, 'pom.xml')),
      this.exists(join(repoRoot, 'Gemfile')),
      this.exists(join(repoRoot, 'yarn.lock')),
      this.exists(join(repoRoot, 'pnpm-lock.yaml')),
      this.exists(join(repoRoot, 'bun.lockb')),
      this.detectCiCd(repoRoot),
    ]);

    const languages: string[] = [];
    const frameworks: string[] = [];
    const package_managers: string[] = [];
    const build_tools: string[] = [];
    const test_frameworks: string[] = [];

    // ── Languages ────────────────────────────────────────────

    if (packageJson) {
      languages.push('javascript');
      // TypeScript presence
      const allDeps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
      };
      if (allDeps['typescript'] || allDeps['ts-node'] || allDeps['tsx']) {
        languages.push('typescript');
      }
    }

    if (hasRequirements || hasPyproject) languages.push('python');
    if (hasGoMod) languages.push('go');
    if (hasCargo) languages.push('rust');
    if (hasPom) languages.push('java');
    if (hasGemfile) languages.push('ruby');

    // ── Package managers ──────────────────────────────────────

    if (packageJson) {
      if (hasBunLock) {
        package_managers.push('bun');
      } else if (hasPnpmLock) {
        package_managers.push('pnpm');
      } else if (hasYarnLock) {
        package_managers.push('yarn');
      } else {
        package_managers.push('npm');
      }
    }
    if (hasRequirements || hasPyproject) package_managers.push('pip');
    if (hasPom) package_managers.push('maven');
    if (hasGemfile) package_managers.push('bundler');

    // ── Frameworks (from package.json deps) ───────────────────

    if (packageJson) {
      const allDeps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
      };

      const frameworkMap: Record<string, string> = {
        react: 'react',
        'react-dom': 'react',
        vue: 'vue',
        '@angular/core': 'angular',
        express: 'express',
        fastify: 'fastify',
        koa: 'koa',
        hapi: 'hapi',
        next: 'next',
        nuxt: 'nuxt',
        '@nuxt/core': 'nuxt',
        svelte: 'svelte',
        '@sveltejs/kit': 'svelte-kit',
        remix: 'remix',
        '@remix-run/react': 'remix',
        nestjs: 'nestjs',
        '@nestjs/core': 'nestjs',
        astro: 'astro',
        vite: 'vite',
        webpack: 'webpack',
        esbuild: 'esbuild',
        rollup: 'rollup',
        parcel: 'parcel',
      };

      const seen = new Set<string>();
      for (const [dep, framework] of Object.entries(frameworkMap)) {
        if (allDeps[dep] && !seen.has(framework)) {
          frameworks.push(framework);
          seen.add(framework);
        }
      }

      // Test frameworks
      const testMap: Record<string, string> = {
        jest: 'jest',
        vitest: 'vitest',
        mocha: 'mocha',
        jasmine: 'jasmine',
        '@playwright/test': 'playwright',
        cypress: 'cypress',
        '@testing-library/react': 'testing-library',
        ava: 'ava',
        tape: 'tape',
        uvu: 'uvu',
      };

      const seenTest = new Set<string>();
      for (const [dep, tf] of Object.entries(testMap)) {
        if (allDeps[dep] && !seenTest.has(tf)) {
          test_frameworks.push(tf);
          seenTest.add(tf);
        }
      }
    }

    // Python-specific frameworks (presence of requirements.txt only, no parsing)
    // For a deeper check we'd parse requirements.txt — deferred to future.
    if (hasPyproject) {
      frameworks.push('python-project');
    }

    // ── Build tools ───────────────────────────────────────────

    if (packageJson?.devDependencies?.['webpack'] || packageJson?.dependencies?.['webpack']) {
      build_tools.push('webpack');
    }
    if (packageJson?.devDependencies?.['vite'] || packageJson?.dependencies?.['vite']) {
      build_tools.push('vite');
    }
    if (packageJson?.devDependencies?.['esbuild'] || packageJson?.dependencies?.['esbuild']) {
      build_tools.push('esbuild');
    }
    if (packageJson?.devDependencies?.['rollup'] || packageJson?.dependencies?.['rollup']) {
      build_tools.push('rollup');
    }
    if (packageJson?.devDependencies?.['turbo'] || packageJson?.dependencies?.['turbo']) {
      build_tools.push('turborepo');
    }
    if (hasGoMod) build_tools.push('go-build');
    if (hasCargo) build_tools.push('cargo-build');
    if (hasPom) build_tools.push('maven-build');

    // ── Detected commands ─────────────────────────────────────

    const detected_commands = this.extractCommands(packageJson);

    return {
      languages: [...new Set(languages)],
      frameworks: [...new Set(frameworks)],
      package_managers: [...new Set(package_managers)],
      build_tools: [...new Set(build_tools)],
      test_frameworks: [...new Set(test_frameworks)],
      ci_cd: ciCd,
      detected_commands,
    };
  }

  // ── Private helpers ─────────────────────────────────────────

  private async readPackageJson(repoRoot: string): Promise<PackageJson | null> {
    try {
      const raw = await readFile(join(repoRoot, 'package.json'), 'utf-8');
      return JSON.parse(raw) as PackageJson;
    } catch {
      return null;
    }
  }

  private async exists(path: string): Promise<boolean> {
    try {
      await access(path);
      return true;
    } catch {
      return false;
    }
  }

  private extractCommands(pkg: PackageJson | null): DetectedCommands {
    if (!pkg?.scripts) return {};

    const scripts = pkg.scripts;
    const commands: DetectedCommands = {};

    // Map common script name patterns to canonical command names
    const candidates: Record<string, string[]> = {
      lint:  ['lint', 'eslint', 'tslint', 'check', 'typecheck'],
      test:  ['test', 'test:unit', 'test:all', 'spec'],
      build: ['build', 'build:prod', 'compile', 'tsc', 'bundle'],
      start: ['start', 'serve', 'dev', 'dev:start'],
    };

    for (const [canonical, names] of Object.entries(candidates)) {
      for (const name of names) {
        if (scripts[name]) {
          commands[canonical] = `npm run ${name}`;
          break;
        }
      }
    }

    // Expose all scripts verbatim under their original names too
    for (const [name] of Object.entries(scripts)) {
      if (!(name in commands)) {
        commands[name] = `npm run ${name}`;
      }
    }

    return commands;
  }

  private async detectCiCd(repoRoot: string): Promise<string[]> {
    const markers: Array<{ path: string; label: string }> = [
      { path: join(repoRoot, '.github', 'workflows'), label: 'github-actions' },
      { path: join(repoRoot, '.gitlab-ci.yml'),       label: 'gitlab-ci' },
      { path: join(repoRoot, 'Jenkinsfile'),           label: 'jenkins' },
      { path: join(repoRoot, '.circleci'),             label: 'circleci' },
      { path: join(repoRoot, '.travis.yml'),           label: 'travis-ci' },
      { path: join(repoRoot, 'bitbucket-pipelines.yml'), label: 'bitbucket-pipelines' },
      { path: join(repoRoot, 'azure-pipelines.yml'),   label: 'azure-pipelines' },
      { path: join(repoRoot, '.buildkite'),            label: 'buildkite' },
    ];

    const results = await Promise.all(
      markers.map(async ({ path, label }) => ({
        label,
        found: await this.exists(path),
      })),
    );

    return results.filter((r) => r.found).map((r) => r.label);
  }
}
