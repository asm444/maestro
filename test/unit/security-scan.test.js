'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { SecurityScanner } = require('../../dist/modules/verifier/security-scan.js');

/** Writes content to a temp file and returns its path */
function writeTempFile(content) {
  const tmpDir = os.tmpdir();
  const filePath = path.join(tmpDir, `maestro-sec-test-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`);
  fs.writeFileSync(filePath, content, 'utf-8');
  return filePath;
}

describe('SecurityScanner', () => {
  const scanner = new SecurityScanner();
  const tempFiles = [];

  after(() => {
    for (const f of tempFiles) {
      try { fs.unlinkSync(f); } catch { /* ignore */ }
    }
  });

  function tempFile(content) {
    const p = writeTempFile(content);
    tempFiles.push(p);
    return p;
  }

  it('detects AWS access key pattern (AKIA...)', () => {
    const f = tempFile('const key = "AKIAIOSFODNN7EXAMPLE123";');
    const findings = scanner.scanFiles([f]);
    assert.equal(findings.length, 1);
    assert.match(findings[0].pattern, /AWS/i);
    assert.equal(findings[0].severity, 'critical');
  });

  it('detects private key block', () => {
    const f = tempFile('-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA...\n-----END RSA PRIVATE KEY-----');
    const findings = scanner.scanFiles([f]);
    assert.ok(findings.length >= 1);
    assert.equal(findings[0].severity, 'critical');
    assert.match(findings[0].pattern, /private key/i);
  });

  it('detects GitHub personal access token (ghp_)', () => {
    const token = 'ghp_' + 'A'.repeat(36);
    const f = tempFile(`const token = "${token}";`);
    const findings = scanner.scanFiles([f]);
    assert.ok(findings.length >= 1);
    assert.equal(findings[0].severity, 'critical');
    assert.match(findings[0].pattern, /github/i);
  });

  it('does not flag a clean file', () => {
    const f = tempFile('const greeting = "Hello, world!";\nconsole.log(greeting);\n');
    const findings = scanner.scanFiles([f]);
    assert.equal(findings.length, 0);
  });

  it('hasCriticalFindings returns true when critical findings exist', () => {
    const findings = [{ file: 'x.js', line: 1, pattern: 'AWS key', severity: 'critical' }];
    assert.equal(scanner.hasCriticalFindings(findings), true);
  });

  it('hasCriticalFindings returns false for empty array', () => {
    assert.equal(scanner.hasCriticalFindings([]), false);
  });

  it('hasCriticalFindings returns false when only warning-level findings', () => {
    const findings = [{ file: 'x.js', line: 1, pattern: 'bearer token', severity: 'warning' }];
    assert.equal(scanner.hasCriticalFindings(findings), false);
  });

  it('skips lines longer than 2000 characters', () => {
    // Build a line > 2000 chars that embeds an AWS key
    const awsKey = 'AKIAIOSFODNN7EXAMPLE12';
    const padding = 'x'.repeat(2001);
    const f = tempFile(`${padding}${awsKey}\n`);
    const findings = scanner.scanFiles([f]);
    assert.equal(findings.length, 0, 'Long lines should be skipped to prevent ReDoS');
  });

  it('scanFiles with empty array returns empty findings', () => {
    const findings = scanner.scanFiles([]);
    assert.deepEqual(findings, []);
  });

  it('reports correct line number (1-based) for finding', () => {
    const awsKey = 'AKIAIOSFODNN7EXAMPLE12';
    const f = tempFile(`line one\nline two\nconst k = "${awsKey}ZZ";\n`);
    const findings = scanner.scanFiles([f]);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].line, 3);
  });
});
