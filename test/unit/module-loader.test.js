'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { ModuleLoader } = require('../../dist/kernel/module-loader.js');

/** Creates a minimal mock module */
function makeModule(name, deps = []) {
  const initOrder = [];
  return {
    name,
    version: '1.0.0',
    dependencies: deps,
    initOrder,
    async init(_kernel) { initOrder.push(name); },
    async dispose() {},
  };
}

/** Shared mock kernel */
const MOCK_KERNEL = { bus: null, config: {}, modules: null };

describe('ModuleLoader', () => {
  it('register + get: returns the registered module', () => {
    const loader = new ModuleLoader();
    const mod = makeModule('alpha');
    loader.register(mod);
    assert.equal(loader.get('alpha'), mod);
  });

  it('get non-existent module throws with meaningful message', () => {
    const loader = new ModuleLoader();
    assert.throws(
      () => loader.get('missing'),
      (err) => {
        assert.match(err.message, /not found/i);
        return true;
      }
    );
  });

  it('duplicate registration throws', () => {
    const loader = new ModuleLoader();
    loader.register(makeModule('dup'));
    assert.throws(
      () => loader.register(makeModule('dup')),
      (err) => {
        assert.match(err.message, /already registered/i);
        return true;
      }
    );
  });

  it('topological sort: dependency comes before dependent', async () => {
    const loader = new ModuleLoader();
    const globalOrder = [];
    const base = { name: 'base', version: '1.0.0', dependencies: [], async init() { globalOrder.push('base'); }, async dispose() {} };
    const derived = { name: 'derived', version: '1.0.0', dependencies: ['base'], async init() { globalOrder.push('derived'); }, async dispose() {} };
    loader.register(derived); // register out of order
    loader.register(base);
    await loader.initAll(MOCK_KERNEL);
    assert.equal(globalOrder[0], 'base');
    assert.equal(globalOrder[1], 'derived');
  });

  it('circular dependency throws', () => {
    const loader = new ModuleLoader();
    const a = { name: 'a', version: '1.0.0', dependencies: ['b'], async init() {}, async dispose() {} };
    const b = { name: 'b', version: '1.0.0', dependencies: ['a'], async init() {}, async dispose() {} };
    loader.register(a);
    loader.register(b);
    assert.throws(
      () => loader['topologicalSort'](),
      (err) => {
        assert.match(err.message, /circular/i);
        return true;
      }
    );
  });

  it('initAll calls init only once per module even with diamond dependency', async () => {
    const loader = new ModuleLoader();
    let rootCallCount = 0;
    const root = { name: 'root', version: '1.0.0', dependencies: [], async init() { rootCallCount++; }, async dispose() {} };
    const left = { name: 'left', version: '1.0.0', dependencies: ['root'], async init() {}, async dispose() {} };
    const right = { name: 'right', version: '1.0.0', dependencies: ['root'], async init() {}, async dispose() {} };
    const top = { name: 'top', version: '1.0.0', dependencies: ['left', 'right'], async init() {}, async dispose() {} };
    loader.register(root);
    loader.register(left);
    loader.register(right);
    loader.register(top);
    await loader.initAll(MOCK_KERNEL);
    assert.equal(rootCallCount, 1);
  });

  it('has() returns true for registered module and false otherwise', () => {
    const loader = new ModuleLoader();
    loader.register(makeModule('x'));
    assert.equal(loader.has('x'), true);
    assert.equal(loader.has('y'), false);
  });

  it('listModules returns all registered module names', () => {
    const loader = new ModuleLoader();
    loader.register(makeModule('m1'));
    loader.register(makeModule('m2'));
    const list = loader.listModules();
    assert.ok(list.includes('m1'));
    assert.ok(list.includes('m2'));
    assert.equal(list.length, 2);
  });
});
