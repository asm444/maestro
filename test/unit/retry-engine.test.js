'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { RetryEngine } = require('../../dist/modules/orchestrator/retry-engine.js');

/** Minimal ticket factory for retry tests */
function ticket(overrides = {}) {
  return {
    id: overrides.id || 'T-001',
    title: overrides.title || 'task',
    department: 'backend',
    priority: 'medium',
    mode: overrides.mode || 'sequential',
    repo_paths: overrides.repo_paths || [],
    constraints: [],
    definition_of_done: [],
    skills_required: [],
    tools_allowed: [],
    validation_commands: [],
    outputs: overrides.outputs || [],
    status: 'pending',
    retries: overrides.retries || 0,
    error_history: overrides.error_history || [],
    depends_on: [],
  };
}

describe('RetryEngine', () => {
  const engine = new RetryEngine(2); // maxRetries = 2

  it('analyzeError classifies AssertionError as test_failure', () => {
    assert.equal(engine.analyzeError('AssertionError: expected 1 to equal 2'), 'test_failure');
  });

  it('analyzeError classifies "FAIL" output as test_failure', () => {
    assert.equal(engine.analyzeError('FAIL src/server.test.js'), 'test_failure');
  });

  it('analyzeError classifies "Cannot find module" as build_error', () => {
    assert.equal(engine.analyzeError('Cannot find module ./missing'), 'build_error');
  });

  it('analyzeError classifies TypeScript error as build_error', () => {
    assert.equal(engine.analyzeError('error TS2345: Argument of type X is not assignable to Y'), 'build_error');
  });

  it('analyzeError classifies ETIMEDOUT as timeout', () => {
    assert.equal(engine.analyzeError('ETIMEDOUT: connection timed out'), 'timeout');
  });

  it('analyzeError classifies SyntaxError as syntax', () => {
    assert.equal(engine.analyzeError('SyntaxError: Unexpected token ;'), 'syntax');
  });

  it('analyzeError falls back to unknown for unrecognized message', () => {
    assert.equal(engine.analyzeError('something totally unexpected happened'), 'unknown');
  });

  it('shouldRetry returns true when retries < maxRetries', () => {
    const t = ticket({ retries: 0 });
    assert.equal(engine.shouldRetry(t, 'some error'), true);
  });

  it('shouldRetry returns false when retries === maxRetries', () => {
    const t = ticket({ retries: 2 });
    assert.equal(engine.shouldRetry(t, 'some error'), false);
  });

  it('shouldRetry returns false when retries > maxRetries', () => {
    const t = ticket({ retries: 5 });
    assert.equal(engine.shouldRetry(t, 'overflow'), false);
  });

  it('buildRetryContext includes error analysis and attempt number', () => {
    const t = ticket({ retries: 1, error_history: [
      { attempt: 1, timestamp: '2026-01-01T00:00:00Z', error_type: 'build_error', message: 'Cannot find module x' },
    ]});
    const ctx = engine.buildRetryContext(t, 'Cannot find module ./utils');
    assert.equal(ctx.attempt, 2);
    assert.equal(typeof ctx.analysis, 'string');
    assert.ok(ctx.analysis.length > 0);
    assert.ok(ctx.enriched_context.includes('build_error'));
    assert.equal(ctx.previous_error, 'Cannot find module ./utils');
  });

  it('createEscalationTicket targets qa-verifier department', () => {
    const original = ticket({ id: 'FEAT-01', title: 'Add login endpoint', error_history: [] });
    const errorHistory = [
      { attempt: 1, timestamp: '2026-01-01T00:00:00Z', error_type: 'build_error', message: 'build failed' },
    ];
    const esc = engine.createEscalationTicket(original, errorHistory);
    assert.equal(esc.department, 'qa-verifier');
  });

  it('createEscalationTicket id contains the original ticket id', () => {
    const original = ticket({ id: 'FEAT-42', title: 'Some feature' });
    const esc = engine.createEscalationTicket(original, []);
    assert.ok(esc.id.includes('FEAT-42'), `Expected ESC id to include "FEAT-42", got: ${esc.id}`);
  });

  it('createEscalationTicket has mode sequential', () => {
    const original = ticket({ mode: 'parallel' });
    const esc = engine.createEscalationTicket(original, []);
    assert.equal(esc.mode, 'sequential');
  });

  it('createEscalationTicket depends_on includes the original ticket id', () => {
    const original = ticket({ id: 'BLD-10' });
    const esc = engine.createEscalationTicket(original, []);
    assert.ok(esc.depends_on.includes('BLD-10'));
  });
});
