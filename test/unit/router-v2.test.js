'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { RouterModule } = require('../../dist/modules/router/index.js');
const { DEPARTMENT_SKILLS } = require('../../dist/kernel/types.js');

/** Minimal ticket factory */
function ticket(overrides = {}) {
  return {
    id: 'T-001',
    title: overrides.title || 'generic task',
    department: overrides.department || '',
    priority: 'medium',
    mode: 'sequential',
    repo_paths: overrides.repo_paths || [],
    constraints: [],
    definition_of_done: [],
    skills_required: overrides.skills_required || [],
    tools_allowed: [],
    validation_commands: [],
    outputs: [],
    status: 'pending',
    retries: 0,
    error_history: [],
    depends_on: [],
  };
}

describe('RouterModule', () => {
  const router = new RouterModule();

  it('respects explicit department when it is a valid DEPARTMENTS member', () => {
    const t = ticket({ department: 'frontend', repo_paths: ['src/server/main.ts'] });
    assert.equal(router.routeTicket(t), 'frontend');
  });

  it('invalid explicit department falls through to routing rules', () => {
    const t = ticket({ department: 'unknown-dept', repo_paths: ['src/server/app.ts'] });
    // 'unknown-dept' not in DEPARTMENTS, should route by file path → backend
    const result = router.routeTicket(t);
    assert.equal(result, 'backend');
  });

  it('routes backend files to backend department', () => {
    const t = ticket({ repo_paths: ['src/server/routes.ts', 'api/users.ts'] });
    assert.equal(router.routeTicket(t), 'backend');
  });

  it('routes test files to qa-verifier', () => {
    const t = ticket({ repo_paths: ['test/health.test.js', '__tests__/router.spec.ts'] });
    assert.equal(router.routeTicket(t), 'qa-verifier');
  });

  it('routes Dockerfile to infra-devops', () => {
    const t = ticket({ repo_paths: ['Dockerfile', 'docker-compose.yml'] });
    assert.equal(router.routeTicket(t), 'infra-devops');
  });

  it('routes CI workflow file to infra-devops', () => {
    const t = ticket({ repo_paths: ['.github/workflows/ci.yml'] });
    assert.equal(router.routeTicket(t), 'infra-devops');
  });

  it('routes by keyword "docker" in title to infra-devops', () => {
    const t = ticket({ title: 'Set up docker container for the app' });
    assert.equal(router.routeTicket(t), 'infra-devops');
  });

  it('routes by keyword "api" in title to backend', () => {
    const t = ticket({ title: 'Create REST api endpoint for login' });
    assert.equal(router.routeTicket(t), 'backend');
  });

  it('routes frontend CSS files to frontend', () => {
    const t = ticket({ repo_paths: ['src/components/Button.tsx', 'ui/styles.css'] });
    assert.equal(router.routeTicket(t), 'frontend');
  });

  it('defaults to backend when no patterns or keywords match', () => {
    const t = ticket({ title: 'do something vague', repo_paths: [] });
    assert.equal(router.routeTicket(t), 'backend');
  });

  it('injectSkills adds DEPARTMENT_SKILLS for the resolved department', () => {
    const t = ticket({ repo_paths: ['src/server/index.ts'] });
    const enriched = router.injectSkills(t);
    const expected = DEPARTMENT_SKILLS['backend'];
    for (const skill of expected) {
      assert.ok(enriched.skills_required.includes(skill), `Expected skill "${skill}" to be injected`);
    }
  });

  it('injectSkills preserves existing skills_required without duplicating', () => {
    const t = ticket({ repo_paths: ['src/server/index.ts'], skills_required: ['tdd'] });
    const enriched = router.injectSkills(t);
    const tddCount = enriched.skills_required.filter((s) => s === 'tdd').length;
    assert.equal(tddCount, 1);
  });

  it('injectSkills sets department on the returned ticket', () => {
    const t = ticket({ repo_paths: ['.github/workflows/ci.yml'] });
    const enriched = router.injectSkills(t);
    assert.equal(enriched.department, 'infra-devops');
  });
});
