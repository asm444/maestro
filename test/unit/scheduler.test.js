'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { Scheduler } = require('../../dist/modules/orchestrator/scheduler.js');

/** Minimal ticket factory */
function ticket(id, mode, priority = 'medium', depends_on = []) {
  return {
    id,
    title: `Task ${id}`,
    department: 'backend',
    priority,
    mode,
    repo_paths: [],
    constraints: [],
    definition_of_done: [],
    skills_required: [],
    tools_allowed: [],
    validation_commands: [],
    outputs: [],
    status: 'pending',
    retries: 0,
    error_history: [],
    depends_on,
  };
}

describe('Scheduler', () => {
  const scheduler = new Scheduler();

  it('empty ticket list returns empty phases', () => {
    const plan = scheduler.buildExecutionGraph([]);
    assert.deepEqual(plan.phases, []);
  });

  it('single sequential ticket produces one sequential phase', () => {
    const plan = scheduler.buildExecutionGraph([ticket('T1', 'sequential')]);
    assert.equal(plan.phases.length, 1);
    assert.equal(plan.phases[0].mode, 'sequential');
    assert.equal(plan.phases[0].tickets[0].id, 'T1');
  });

  it('two sequential tickets produce two separate phases', () => {
    const plan = scheduler.buildExecutionGraph([
      ticket('S1', 'sequential'),
      ticket('S2', 'sequential'),
    ]);
    assert.equal(plan.phases.length, 2);
    for (const phase of plan.phases) {
      assert.equal(phase.mode, 'sequential');
      assert.equal(phase.tickets.length, 1);
    }
  });

  it('two parallel tickets are grouped into a single parallel phase', () => {
    const plan = scheduler.buildExecutionGraph([
      ticket('P1', 'parallel'),
      ticket('P2', 'parallel'),
    ]);
    assert.equal(plan.phases.length, 1);
    assert.equal(plan.phases[0].mode, 'parallel');
    assert.equal(plan.phases[0].tickets.length, 2);
  });

  it('depends_on: dependent ticket appears in a later phase than its dependency', () => {
    const plan = scheduler.buildExecutionGraph([
      ticket('A', 'sequential'),
      ticket('B', 'sequential', 'medium', ['A']),
    ]);
    // Find phases containing A and B
    const phaseOfA = plan.phases.findIndex((ph) => ph.tickets.some((t) => t.id === 'A'));
    const phaseOfB = plan.phases.findIndex((ph) => ph.tickets.some((t) => t.id === 'B'));
    assert.ok(phaseOfA < phaseOfB, `Expected A (phase ${phaseOfA}) to come before B (phase ${phaseOfB})`);
  });

  it('parallel ticket with depends_on waits until dependency is resolved', () => {
    const plan = scheduler.buildExecutionGraph([
      ticket('BASE', 'sequential'),
      ticket('DEP', 'parallel', 'medium', ['BASE']),
    ]);
    const phaseOfBase = plan.phases.findIndex((ph) => ph.tickets.some((t) => t.id === 'BASE'));
    const phaseOfDep = plan.phases.findIndex((ph) => ph.tickets.some((t) => t.id === 'DEP'));
    assert.ok(phaseOfBase < phaseOfDep);
  });

  it('high priority sequential ticket is scheduled before low priority', () => {
    const plan = scheduler.buildExecutionGraph([
      ticket('LOW', 'sequential', 'low'),
      ticket('HIGH', 'sequential', 'high'),
    ]);
    // HIGH should appear in a phase before LOW
    const phaseOfHigh = plan.phases.findIndex((ph) => ph.tickets.some((t) => t.id === 'HIGH'));
    const phaseOfLow = plan.phases.findIndex((ph) => ph.tickets.some((t) => t.id === 'LOW'));
    assert.ok(phaseOfHigh <= phaseOfLow, `HIGH (phase ${phaseOfHigh}) should not come after LOW (phase ${phaseOfLow})`);
  });

  it('all tickets are included in the resulting phases', () => {
    const tickets = [
      ticket('X1', 'parallel'),
      ticket('X2', 'parallel'),
      ticket('X3', 'sequential'),
    ];
    const plan = scheduler.buildExecutionGraph(tickets);
    const allIds = plan.phases.flatMap((ph) => ph.tickets.map((t) => t.id));
    assert.ok(allIds.includes('X1'));
    assert.ok(allIds.includes('X2'));
    assert.ok(allIds.includes('X3'));
    assert.equal(allIds.length, 3);
  });

  it('ticket with external depends_on (not in batch) is scheduled freely', () => {
    // EXTERN-ID is not in the batch — should be treated as already resolved
    const plan = scheduler.buildExecutionGraph([
      ticket('T', 'sequential', 'medium', ['EXTERN-ID']),
    ]);
    assert.equal(plan.phases.length, 1);
    assert.equal(plan.phases[0].tickets[0].id, 'T');
  });
});
