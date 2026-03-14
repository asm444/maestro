'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { MetricsCollector } = require('../../dist/modules/reporter/metrics-collector.js');

describe('MetricsCollector', () => {
  it('startTimer returns an object with a stop() function', () => {
    const collector = new MetricsCollector();
    const timer = collector.startTimer();
    assert.equal(typeof timer.stop, 'function');
  });

  it('startTimer stop() returns a non-negative elapsed time in ms', async () => {
    const collector = new MetricsCollector();
    const timer = collector.startTimer();
    // small async wait to ensure some ms pass
    await new Promise((resolve) => setTimeout(resolve, 5));
    const elapsed = timer.stop();
    assert.ok(elapsed >= 0, `Expected elapsed >= 0, got ${elapsed}`);
    assert.equal(typeof elapsed, 'number');
  });

  it('startTimer measures at least the delay given', async () => {
    const collector = new MetricsCollector();
    const timer = collector.startTimer();
    await new Promise((resolve) => setTimeout(resolve, 20));
    const elapsed = timer.stop();
    assert.ok(elapsed >= 10, `Expected elapsed >= 10ms, got ${elapsed}`);
  });

  it('aggregate with empty array returns all-zero summary', () => {
    const collector = new MetricsCollector();
    const result = collector.aggregate([]);
    assert.deepEqual(result, {
      avg_duration: 0,
      success_rate: 0,
      total_files: 0,
      total_cycles: 0,
    });
  });

  it('aggregate with a single cycle returns correct values', () => {
    const collector = new MetricsCollector();
    const metrics = [
      { duration_ms: 2000, completed: 3, total_tickets: 4, files_touched: 5, failed: 1, retried: 0, escalated: 0, skills_invoked: [], mcps_used: [] },
    ];
    const result = collector.aggregate(metrics);
    assert.equal(result.avg_duration, 2000);
    assert.equal(result.success_rate, 75); // 3/4 * 100
    assert.equal(result.total_files, 5);
    assert.equal(result.total_cycles, 1);
  });

  it('aggregate averages duration across multiple cycles', () => {
    const collector = new MetricsCollector();
    const metrics = [
      { duration_ms: 1000, completed: 2, total_tickets: 2, files_touched: 3, failed: 0, retried: 0, escalated: 0, skills_invoked: [], mcps_used: [] },
      { duration_ms: 3000, completed: 2, total_tickets: 2, files_touched: 7, failed: 0, retried: 0, escalated: 0, skills_invoked: [], mcps_used: [] },
    ];
    const result = collector.aggregate(metrics);
    assert.equal(result.avg_duration, 2000);
    assert.equal(result.total_files, 10);
    assert.equal(result.total_cycles, 2);
    assert.equal(result.success_rate, 100);
  });

  it('aggregate success_rate is 0 when all tickets failed (total_tickets > 0, completed = 0)', () => {
    const collector = new MetricsCollector();
    const metrics = [
      { duration_ms: 500, completed: 0, total_tickets: 3, files_touched: 0, failed: 3, retried: 0, escalated: 0, skills_invoked: [], mcps_used: [] },
    ];
    const result = collector.aggregate(metrics);
    assert.equal(result.success_rate, 0);
  });

  it('aggregate total_cycles equals the number of metrics entries', () => {
    const collector = new MetricsCollector();
    const entry = { duration_ms: 100, completed: 1, total_tickets: 1, files_touched: 0, failed: 0, retried: 0, escalated: 0, skills_invoked: [], mcps_used: [] };
    const result = collector.aggregate([entry, entry, entry]);
    assert.equal(result.total_cycles, 3);
  });
});
