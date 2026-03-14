'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { MaestroEventBus } = require('../../dist/kernel/event-bus.js');

describe('MaestroEventBus', () => {
  it('on/emit: handler is called with the payload', async () => {
    const bus = new MaestroEventBus();
    const received = [];
    bus.on('test:event', (payload) => { received.push(payload); });
    await bus.emit('test:event', { value: 42 });
    assert.equal(received.length, 1);
    assert.deepEqual(received[0], { value: 42 });
  });

  it('off: handler removed and not called after off()', async () => {
    const bus = new MaestroEventBus();
    const received = [];
    const handler = (p) => received.push(p);
    bus.on('ev', handler);
    await bus.emit('ev', 'first');
    bus.off('ev', handler);
    await bus.emit('ev', 'second');
    assert.equal(received.length, 1);
    assert.equal(received[0], 'first');
  });

  it('once: handler called exactly once across multiple emits', async () => {
    const bus = new MaestroEventBus();
    let callCount = 0;
    bus.once('ping', () => { callCount++; });
    await bus.emit('ping', null);
    await bus.emit('ping', null);
    await bus.emit('ping', null);
    assert.equal(callCount, 1);
  });

  it('emit with no listeners does not throw', async () => {
    const bus = new MaestroEventBus();
    await assert.doesNotReject(() => bus.emit('no-listeners', { x: 1 }));
  });

  it('multiple handlers on same event are all called', async () => {
    const bus = new MaestroEventBus();
    const results = [];
    bus.on('multi', () => results.push('a'));
    bus.on('multi', () => results.push('b'));
    bus.on('multi', () => results.push('c'));
    await bus.emit('multi', null);
    assert.deepEqual(results.sort(), ['a', 'b', 'c']);
  });

  it('clear: removes all persistent and once handlers', async () => {
    const bus = new MaestroEventBus();
    let persistentCalled = false;
    let onceCalled = false;
    bus.on('ev', () => { persistentCalled = true; });
    bus.once('ev', () => { onceCalled = true; });
    bus.clear();
    await bus.emit('ev', null);
    assert.equal(persistentCalled, false);
    assert.equal(onceCalled, false);
  });

  it('once handler receives the correct payload', async () => {
    const bus = new MaestroEventBus();
    let received = null;
    bus.once('data', (p) => { received = p; });
    await bus.emit('data', { msg: 'hello' });
    assert.deepEqual(received, { msg: 'hello' });
  });

  it('handlers on different events do not interfere', async () => {
    const bus = new MaestroEventBus();
    const log = [];
    bus.on('a', () => log.push('a'));
    bus.on('b', () => log.push('b'));
    await bus.emit('a', null);
    assert.deepEqual(log, ['a']);
  });
});
