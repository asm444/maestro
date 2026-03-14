'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

// We access the internal serializer/parser through StateModule's saveTicket/getTicket
// by exercising the module with a real tmp directory, OR by reaching into the
// compiled module's file and extracting the helpers.
//
// StateModule compiles serializeYaml and parseYaml as module-level functions
// (not exported). We test them indirectly by saving and reloading tickets
// using a real StateModule instance backed by a temp directory.

const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs/promises');
const { StateModule } = require('../../dist/modules/state/index.js');

async function makeStateModule() {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'maestro-yaml-test-'));
  const maestroDir = path.join(tmpDir, '.maestro');
  const mod = new StateModule();
  // Manually init with a stub kernel
  await mod.init({ config: { maestroDir } });
  return { mod, maestroDir, tmpDir };
}

/** Minimal ticket factory */
function baseTicket(overrides = {}) {
  return {
    id: overrides.id || 'YAML-001',
    title: overrides.title || 'Round-trip test',
    department: overrides.department || 'backend',
    priority: 'medium',
    mode: 'sequential',
    repo_paths: overrides.repo_paths || [],
    constraints: overrides.constraints || [],
    definition_of_done: overrides.definition_of_done || [],
    skills_required: overrides.skills_required || [],
    tools_allowed: [],
    validation_commands: overrides.validation_commands || [],
    outputs: overrides.outputs || [],
    status: 'pending',
    retries: overrides.retries !== undefined ? overrides.retries : 0,
    error_history: overrides.error_history || [],
    depends_on: overrides.depends_on || [],
    ...overrides,
  };
}

describe('YAML round-trip (serialize → persist → parse)', () => {
  it('simple ticket round-trips id, title, department, priority, mode', async () => {
    const { mod, tmpDir } = await makeStateModule();
    const original = baseTicket({ id: 'RT-001', title: 'Simple ticket', department: 'frontend' });
    await mod.saveTicket(original);
    const loaded = await mod.getTicket('RT-001');
    assert.equal(loaded.id, 'RT-001');
    assert.equal(loaded.title, 'Simple ticket');
    assert.equal(loaded.department, 'frontend');
    assert.equal(loaded.priority, 'medium');
    assert.equal(loaded.mode, 'sequential');
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('strings "true", "false", "null" are preserved as strings', async () => {
    const { mod, tmpDir } = await makeStateModule();
    const original = baseTicket({
      id: 'RT-002',
      // Embed ambiguous strings inside arrays (they go through serializeYaml quoting)
      constraints: ['true', 'false', 'null'],
    });
    await mod.saveTicket(original);
    const loaded = await mod.getTicket('RT-002');
    assert.deepEqual(loaded.constraints, ['true', 'false', 'null']);
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('empty arrays round-trip as empty arrays', async () => {
    const { mod, tmpDir } = await makeStateModule();
    const original = baseTicket({
      id: 'RT-003',
      repo_paths: [],
      constraints: [],
      definition_of_done: [],
      outputs: [],
    });
    await mod.saveTicket(original);
    const loaded = await mod.getTicket('RT-003');
    assert.deepEqual(loaded.repo_paths, []);
    assert.deepEqual(loaded.constraints, []);
    assert.deepEqual(loaded.definition_of_done, []);
    assert.deepEqual(loaded.outputs, []);
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('array of objects (error_history) round-trips correctly', async () => {
    const { mod, tmpDir } = await makeStateModule();
    const errorHistory = [
      { attempt: 1, timestamp: '2026-01-01T00:00:00Z', error_type: 'build_error', message: 'Cannot find module x' },
      { attempt: 2, timestamp: '2026-01-02T00:00:00Z', error_type: 'test_failure', message: 'AssertionError: expected 1' },
    ];
    const original = baseTicket({ id: 'RT-004', retries: 2, error_history: errorHistory });
    await mod.saveTicket(original);
    const loaded = await mod.getTicket('RT-004');
    assert.equal(loaded.retries, 2);
    assert.equal(loaded.error_history.length, 2);
    assert.equal(loaded.error_history[0].attempt, 1);
    assert.equal(loaded.error_history[0].error_type, 'build_error');
    assert.equal(loaded.error_history[1].attempt, 2);
    assert.equal(loaded.error_history[1].error_type, 'test_failure');
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('numeric retries value is preserved as number', async () => {
    const { mod, tmpDir } = await makeStateModule();
    const original = baseTicket({ id: 'RT-005', retries: 3 });
    await mod.saveTicket(original);
    const loaded = await mod.getTicket('RT-005');
    assert.equal(loaded.retries, 3);
    assert.equal(typeof loaded.retries, 'number');
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('array of strings (repo_paths) round-trips correctly', async () => {
    const { mod, tmpDir } = await makeStateModule();
    const original = baseTicket({
      id: 'RT-006',
      repo_paths: ['src/server/index.ts', 'api/routes.ts', '.github/workflows/ci.yml'],
    });
    await mod.saveTicket(original);
    const loaded = await mod.getTicket('RT-006');
    assert.deepEqual(loaded.repo_paths, ['src/server/index.ts', 'api/routes.ts', '.github/workflows/ci.yml']);
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('status field preserved through round-trip', async () => {
    const { mod, tmpDir } = await makeStateModule();
    const original = baseTicket({ id: 'RT-007', status: 'completed' });
    await mod.saveTicket(original);
    const loaded = await mod.getTicket('RT-007');
    assert.equal(loaded.status, 'completed');
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('getTicket returns null for non-existent ticket', async () => {
    const { mod, tmpDir } = await makeStateModule();
    const loaded = await mod.getTicket('NONEXISTENT-99');
    assert.equal(loaded, null);
    await fs.rm(tmpDir, { recursive: true, force: true });
  });
});
